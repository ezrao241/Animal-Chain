import * as THREE from 'three';
// A CPU projection fallback for devices without WebGL. It draws the same articulated
// meshes in perspective, not sprite images; GPU-capable devices use WebGLRenderer.
type Face={points:number[];depth:number;color:string;opacity:number;texture?:HTMLCanvasElement;uv?:number[];fog:number};
const world=new THREE.Vector3(),v1=new THREE.Vector3(),v2=new THREE.Vector3(),v3=new THREE.Vector3(),normal=new THREE.Vector3(),edge=new THREE.Vector3(),center=new THREE.Vector3(),color=new THREE.Color(),instanceColor=new THREE.Color(),projection=new THREE.Matrix4(),matrix=new THREE.Matrix4(),instance=new THREE.Matrix4();
const light=new THREE.Vector3(-.45,.82,.35).normalize();
const frustum=new THREE.Frustum(),bounds=new THREE.Sphere();
export class SoftwareRenderer{
 readonly isSoftwareRenderer=true;domElement:HTMLCanvasElement;shadowMap={enabled:false,type:THREE.PCFSoftShadowMap};outputColorSpace:string='';toneMapping:THREE.ToneMapping=THREE.NoToneMapping;toneMappingExposure=1;private ctx:CanvasRenderingContext2D;private width=1;private height=1;private alpha:boolean;private frame=0;private pixelRatio=1;
 constructor({alpha=false}:{alpha?:boolean}={}){this.alpha=alpha;this.domElement=document.createElement('canvas');this.ctx=this.domElement.getContext('2d',{alpha})!;}
 setPixelRatio(ratio:number){this.pixelRatio=ratio;}setSize(w:number,h:number){this.width=Math.max(1,Math.floor(w*this.pixelRatio));this.height=Math.max(1,Math.floor(h*this.pixelRatio));this.domElement.width=this.width;this.domElement.height=this.height;}
 setAnimationLoop(callback:((time:number)=>void)|null){cancelAnimationFrame(this.frame);if(!callback)return;let previous=0;const loop=(t:number)=>{if(t-previous>=32){previous=t;callback(t);}this.frame=requestAnimationFrame(loop);};this.frame=requestAnimationFrame(loop);}
 render(scene:THREE.Scene,camera:THREE.Camera){
 scene.updateMatrixWorld();camera.updateMatrixWorld();projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);const ctx=this.ctx,w=this.width,h=this.height,fog=scene.fog instanceof THREE.Fog?scene.fog:null;
 if(this.alpha)ctx.clearRect(0,0,w,h);else{ctx.fillStyle=scene.background instanceof THREE.Color?scene.background.getStyle():'#405f46';ctx.fillRect(0,0,w,h);}
 const faces:Face[]=[];
 const collect=(mesh:THREE.Mesh,transform:THREE.Matrix4,tint?:THREE.Color)=>{
 const geo=(mesh.userData.softwareGeometry||(mesh.userData.far&&world.setFromMatrixPosition(transform).distanceToSquared(camera.position)>10000?mesh.userData.far:mesh.geometry)) as THREE.BufferGeometry;const positions=geo.attributes.position;if(!positions)return;
 if(!geo.boundingSphere)geo.computeBoundingSphere();bounds.copy(geo.boundingSphere!).applyMatrix4(transform);if(!frustum.intersectsSphere(bounds))return;
 const material=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material) as THREE.MeshStandardMaterial;if(material.fog!==false&&fog&&bounds.center.distanceTo(camera.position)-bounds.radius>fog.far)return;const base=material.color||new THREE.Color(0xffffff);const indices=geo.index,vertexColors=geo.attributes.color;const n=indices?indices.count:positions.count;
 for(let i=0;i<n;i+=3){const ia=indices?indices.getX(i):i,ib=indices?indices.getX(i+1):i+1,ic=indices?indices.getX(i+2):i+2;
 v1.fromBufferAttribute(positions,ia).applyMatrix4(transform);v2.fromBufferAttribute(positions,ib).applyMatrix4(transform);v3.fromBufferAttribute(positions,ic).applyMatrix4(transform);
 if(v1.distanceToSquared(camera.position)>(camera as THREE.PerspectiveCamera).far**2&&v2.distanceToSquared(camera.position)>(camera as THREE.PerspectiveCamera).far**2&&v3.distanceToSquared(camera.position)>(camera as THREE.PerspectiveCamera).far**2&&material.fog!==false)continue;
 normal.subVectors(v2,v1).cross(edge.subVectors(v3,v1)).normalize();center.copy(v1).add(v2).add(v3).multiplyScalar(1/3);if(material.side!==THREE.DoubleSide&&normal.dot(edge.subVectors(camera.position,center))<=0)continue;
 color.copy(base);if(tint)color.multiply(tint);if(vertexColors){color.setRGB((vertexColors.getX(ia)+vertexColors.getX(ib)+vertexColors.getX(ic))/3,(vertexColors.getY(ia)+vertexColors.getY(ib)+vertexColors.getY(ic))/3,(vertexColors.getZ(ia)+vertexColors.getZ(ib)+vertexColors.getZ(ic))/3);}
 const illumination=('isMeshBasicMaterial' in material)?1:.58+Math.max(0,normal.dot(light))*.6;color.multiplyScalar(illumination);
 const fogAmount=fog?THREE.MathUtils.smoothstep(center.distanceTo(camera.position),fog.near,fog.far):0;if(fog)color.lerp(fog.color,fogAmount);
 // Clip against the near plane, rather than deleting a whole ground triangle
 // when one vertex is behind the chase camera.
 const uv=geo.attributes.uv,indices3=[ia,ib,ic];let polygon=[v1,v2,v3].map((v,j)=>({v:v.clone().applyMatrix4(camera.matrixWorldInverse),u:uv?uv.getX(indices3[j]):0,w:uv?1-uv.getY(indices3[j]):0}));
 const near=-(camera as THREE.PerspectiveCamera).near,clipped:typeof polygon=[];
 for(let j=0;j<polygon.length;j++){const a=polygon[j],b=polygon[(j+1)%polygon.length],ain=a.v.z<=near,bin=b.v.z<=near;if(ain)clipped.push(a);if(ain!==bin){const t=(near-a.v.z)/(b.v.z-a.v.z);clipped.push({v:a.v.clone().lerp(b.v,t),u:a.u+(b.u-a.u)*t,w:a.w+(b.w-a.w)*t});}}
 polygon=clipped;for(const p of polygon)p.v.applyMatrix4(camera.projectionMatrix);
 for(let j=1;j<polygon.length-1;j++){const triangle=[polygon[0],polygon[j],polygon[j+1]];if(triangle.every(p=>p.v.z>1))continue;const points=triangle.flatMap(p=>[(p.v.x*.5+.5)*w,(-p.v.y*.5+.5)*h]);if(points.every(Number.isFinite))faces.push({texture:material.map?.image instanceof HTMLCanvasElement?material.map.image:undefined,uv:uv?triangle.flatMap(p=>[p.u,p.w]):undefined,points,depth:triangle.reduce((n,p)=>n+p.v.z,0)/3,color:color.getStyle(),opacity:material.opacity,fog:fogAmount});}
 }
 };
 scene.traverseVisible(object=>{if(!(object instanceof THREE.Mesh)||object.userData.softwareSkip)return;if(object instanceof THREE.InstancedMesh){if(!object.boundingSphere)object.computeBoundingSphere();bounds.copy(object.boundingSphere!).applyMatrix4(object.matrixWorld);if(!frustum.intersectsSphere(bounds))return;for(let i=0;i<object.count;i++){object.getMatrixAt(i,instance);matrix.multiplyMatrices(object.matrixWorld,instance);if(object.instanceColor)object.getColorAt(i,instanceColor);else instanceColor.set(0xffffff);collect(object,matrix,instanceColor);}}else collect(object,object.matrixWorld);});
 faces.sort((a,b)=>b.depth-a.depth);for(const face of faces){if(face.texture&&face.uv){const p=face.points,uv=face.uv,tw=face.texture.width,th=face.texture.height;const u0=uv[0]*tw,v0=uv[1]*th,u1=uv[2]*tw,v1=uv[3]*th,u2=uv[4]*tw,v2=uv[5]*th;const den=u0*(v1-v2)+u1*(v2-v0)+u2*(v0-v1);if(Math.abs(den)>.001){const a=(p[0]*(v1-v2)+p[2]*(v2-v0)+p[4]*(v0-v1))/den,b=(p[1]*(v1-v2)+p[3]*(v2-v0)+p[5]*(v0-v1))/den,c=(p[0]*(u2-u1)+p[2]*(u0-u2)+p[4]*(u1-u0))/den,d=(p[1]*(u2-u1)+p[3]*(u0-u2)+p[5]*(u1-u0))/den,e=(p[0]*(u1*v2-u2*v1)+p[2]*(u2*v0-u0*v2)+p[4]*(u0*v1-u1*v0))/den,f=(p[1]*(u1*v2-u2*v1)+p[3]*(u2*v0-u0*v2)+p[5]*(u0*v1-u1*v0))/den;const cx=(p[0]+p[2]+p[4])/3,cy=(p[1]+p[3]+p[5])/3;ctx.save();ctx.beginPath();for(let k=0;k<3;k++){const xx=p[k*2],yy=p[k*2+1],n=Math.hypot(xx-cx,yy-cy)||1;const xx2=xx+(xx-cx)/n*.7,yy2=yy+(yy-cy)/n*.7;if(k===0)ctx.moveTo(xx2,yy2);else ctx.lineTo(xx2,yy2);}ctx.closePath();ctx.clip();ctx.transform(a,b,c,d,e,f);ctx.drawImage(face.texture,0,0);ctx.restore();}continue;}ctx.globalAlpha=face.opacity;ctx.fillStyle=face.color;ctx.beginPath();ctx.moveTo(face.points[0],face.points[1]);ctx.lineTo(face.points[2],face.points[3]);ctx.lineTo(face.points[4],face.points[5]);ctx.closePath();ctx.fill();if(face.opacity===1){ctx.strokeStyle=face.color;ctx.lineWidth=.55;ctx.stroke();}}ctx.globalAlpha=1;
 }
 dispose(){cancelAnimationFrame(this.frame);}forceContextLoss(){}
}
let webglAvailable:boolean|undefined;
export function createRenderer(options:THREE.WebGLRendererParameters={}){if(webglAvailable!==false){try{const renderer=new THREE.WebGLRenderer(options);webglAvailable=true;return renderer;}catch{webglAvailable=false;}}return new SoftwareRenderer({alpha:options.alpha});}
