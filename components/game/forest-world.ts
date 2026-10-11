import * as THREE from 'three';
import {W,H,props,rng} from '@/lib/game';

export const groundY=(x:number,z:number)=>Math.sin(x*.006)*Math.cos(z*.005)*8+Math.sin(z*.013+x*.002)*2;
export const pathDistance=(x:number,z:number)=>Math.min(Math.abs(z-(1120-x*.44+Math.sin(x*.004)*70)),Math.abs(z-(110+x*.57+Math.sin(x*.004)*40)));
type Instance={x:number;y:number;z:number;sx:number;sy:number;sz:number;ry?:number;rz?:number;color:number};
const greens=[0x254e3b,0x305f42,0x3b6945,0x416e46,0x527749];
export function createForest(scene:THREE.Scene,seed:number,lightweight:boolean,preview=false){
 const random=rng(seed),resources:(THREE.BufferGeometry|THREE.Material|THREE.Texture)[]=[];
 const chunks:{mesh:THREE.InstancedMesh;x:number;z:number;detail:boolean}[]=[];
 const detailScale=lightweight?0.45:preview?0.62:0.8;
 function material(color:number,options:THREE.MeshStandardMaterialParameters={}){const m=new THREE.MeshStandardMaterial({color,roughness:.96,...options});resources.push(m);return m;}
 function addInstances(items:Instance[],geometry:THREE.BufferGeometry,mat:THREE.Material,cast=true,detail=false){
  resources.push(geometry);const bins=new Map<string,Instance[]>(),group=new THREE.Group(),dummy=new THREE.Object3D(),tint=new THREE.Color();
  for(const p of items){const key=`${Math.floor(p.x/280)},${Math.floor(p.z/280)}`;if(!bins.has(key))bins.set(key,[]);bins.get(key)!.push(p);}
  for(const batch of bins.values()){const mesh=new THREE.InstancedMesh(geometry,mat,batch.length);batch.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.sx,p.sy,p.sz);dummy.rotation.set(0,p.ry||0,p.rz||0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,tint.set(p.color));});mesh.castShadow=cast;mesh.receiveShadow=true;mesh.computeBoundingSphere();mesh.matrixAutoUpdate=false;group.add(mesh);chunks.push({mesh,x:mesh.boundingSphere!.center.x,z:mesh.boundingSphere!.center.z,detail});}
  group.matrixAutoUpdate=false;scene.add(group);return group;
 }
 // The gentle ground needs very few polygons in the CPU fallback. Keep its
 // organic texture; a dense terrain grid was spending most of each frame here.
 const terrain=new THREE.PlaneGeometry(W+1000,H+1000,lightweight?18:52,lightweight?14:42);terrain.rotateX(-Math.PI/2);terrain.translate(W/2,0,H/2);const positions=terrain.attributes.position;
 for(let i=0;i<positions.count;i++)positions.setY(i,groundY(positions.getX(i),positions.getZ(i)));terrain.computeVertexNormals();resources.push(terrain);
 const canvas=document.createElement('canvas');canvas.width=lightweight?768:preview?1152:1536;canvas.height=lightweight?614:preview?922:1229;const ctx=canvas.getContext('2d')!,pixels=ctx.createImageData(canvas.width,canvas.height);
 for(let z=0;z<canvas.height;z++)for(let x=0;x<canvas.width;x++){const wx=x/canvas.width*(W+1000)-500,wz=z/canvas.height*(H+1000)-500;const n=(Math.sin(wx*.025+Math.sin(wz*.014))+Math.cos(wz*.041-wx*.008))*.5;const dirt=1-THREE.MathUtils.smoothstep(pathDistance(wx,wz),22,66),grain=(random()-.5)*17;const i=(z*canvas.width+x)*4;pixels.data[i]=37+n*8+dirt*40+grain;pixels.data[i+1]=57+n*10+dirt*7+grain;pixels.data[i+2]=35+n*5+dirt*9+grain;pixels.data[i+3]=255;}
 ctx.putImageData(pixels,0,0);for(let i=0;i<(lightweight?4500:preview?8500:16000);i++){ctx.fillStyle=['#a58b6144','#121c1870','#9ea46922','#4d562a66'][i%4];ctx.save();ctx.translate(random()*canvas.width,random()*canvas.height);ctx.rotate(random()*6);ctx.beginPath();ctx.ellipse(0,0,1+random()*2,.4+random(),0,0,Math.PI*2);ctx.fill();ctx.restore();}
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;resources.push(map);const ground=new THREE.Mesh(terrain,material(0xffffff,{map}));ground.receiveShadow=true;scene.add(ground);
 const barkCanvas=document.createElement('canvas');barkCanvas.width=128;barkCanvas.height=256;const bc=barkCanvas.getContext('2d')!;bc.fillStyle='#776553';bc.fillRect(0,0,128,256);for(let i=0;i<230;i++){bc.strokeStyle=i%3?'#3d372d77':'#b0a17d55';bc.lineWidth=1+random()*2;const x=random()*128,y=random()*256;bc.beginPath();bc.moveTo(x,y);bc.lineTo(x+random()*5-2,y+20+random()*90);bc.stroke();}const barkMap=new THREE.CanvasTexture(barkCanvas);barkMap.colorSpace=THREE.SRGBColorSpace;resources.push(barkMap);
 const trunks:Instance[]=[],limbs:Instance[]=[],oakLeaves:Instance[]=[],pineLeaves:Instance[]=[],rocks:Instance[]=[],grass:Instance[]=[],ferns:Instance[]=[],flowers:Instance[]=[];
 const ps=props(seed);const forestProps=[...ps];for(let i=0;i<(preview?120:180);i++){const edge=i%4,x=edge===0?-70-random()*340:edge===1?W+70+random()*340:random()*W,y=edge===2?-70-random()*340:edge===3?H+70+random()*340:random()*H;forestProps.push({x,y,kind:'pine',size:90+random()*65});}
 for(const p of forestProps){const y=groundY(p.x,p.y),height=p.size*2.8;
  if(p.kind==='tree'||p.kind==='pine'){
   trunks.push({x:p.x,y:y+height*.46,z:p.y,sx:p.kind==='pine'?7:9,sy:height*.92,sz:p.kind==='pine'?7:9,ry:random()*6,color:0xa89a7b});
   for(let j=0;j<4;j++){const a=j*Math.PI/2+random()*.25;limbs.push({x:p.x+Math.sin(a)*9,y:y+7,z:p.y+Math.cos(a)*9,sx:3,sy:26,sz:3,ry:a,rz:1.1,color:0x665a43});}
   if(p.kind==='pine')for(let j=0;j<7;j++)pineLeaves.push({x:p.x,y:y+height*(.32+j*.092),z:p.y,sx:p.size*(.61-j*.065),sy:height*.33,sz:p.size*(.61-j*.065),ry:random()*6,color:greens[j%greens.length]});
   else for(let j=0;j<6;j++){const a=j*2.4,ox=Math.sin(a)*p.size*.37,oz=Math.cos(a)*p.size*.37;limbs.push({x:p.x+ox*.45,y:y+height*(.61+(j%2)*.08),z:p.y+oz*.45,sx:3,sy:p.size*.63,sz:3,ry:a,rz:.8,color:0x716448});oakLeaves.push({x:p.x+ox,y:y+height*(.77+(j%3)*.072),z:p.y+oz,sx:p.size*.52,sy:p.size*.36,sz:p.size*.46,ry:a,color:greens[j%5]});}
  }else if(p.kind==='bush')for(let j=0;j<5;j++)oakLeaves.push({x:p.x+Math.sin(j*2.4)*16,y:y+12,z:p.y+Math.cos(j*2.4)*16,sx:18,sy:15,sz:17,color:greens[(j+1)%5]});
  else if(p.kind==='rock'){rocks.push({x:p.x,y:y+13,z:p.y,sx:29,sy:23,sz:26,ry:random()*6,color:0x737a6d});oakLeaves.push({x:p.x-3,y:y+25,z:p.y,sx:19,sy:4,sz:15,color:0x527044});}
  else{const hollow=new THREE.Mesh(new THREE.TorusGeometry(21,5,6,18),material(0x776342));hollow.rotation.x=-Math.PI/2;hollow.position.set(p.x,y+3,p.y);scene.add(hollow);resources.push(hollow.geometry);const inside=new THREE.Mesh(new THREE.CircleGeometry(19,18),material(0x101c17));inside.rotation.x=-Math.PI/2;inside.position.set(p.x,y+1,p.y);scene.add(inside);resources.push(inside.geometry);}
 }
 const bark=material(lightweight?0x776553:0xffffff,lightweight?{}:{map:barkMap});addInstances(trunks,new THREE.CylinderGeometry(.47,1,1,lightweight?6:9,1),bark);addInstances(limbs,new THREE.CylinderGeometry(.25,1,1,lightweight?4:6),material(0xffffff));
 const foliage=material(0xffffff);const oaks=addInstances(oakLeaves,new THREE.IcosahedronGeometry(1,lightweight?0:1),foliage);oaks.userData.canopy=true;
 const pineGeo=new THREE.ConeGeometry(1,1,lightweight?5:9,1);const pa=pineGeo.attributes.position;for(let i=0;i<pa.count;i++){const py=pa.getY(i),factor=py>.4?1:.82+random()*.29;pa.setXYZ(i,pa.getX(i)*factor,py+(py<.4?(random()-.5)*.12:0),pa.getZ(i)*factor);}pineGeo.computeVertexNormals();const pines=addInstances(pineLeaves,pineGeo,foliage);pines.userData.canopy=true;addInstances(rocks,new THREE.IcosahedronGeometry(1,lightweight?0:1),material(0xffffff));
 const grassCount=Math.round((lightweight?420:preview?900:2200)*detailScale);
 for(let i=0;i<grassCount;i++){const x=35+random()*(W-70),z=35+random()*(H-70);if(pathDistance(x,z)<34)continue;grass.push({x,y:groundY(x,z),z,sx:2.4+random()*2.5,sy:5+random()*7,sz:2.2+random()*2.5,ry:random()*6,color:greens[i%5]});if(i%Math.max(16,Math.round(35/detailScale))===0)ferns.push({x,y:groundY(x,z)+7,z,sx:10+random()*4,sy:12+random()*4,sz:10+random()*4,ry:random()*6,color:0x58814b});if(i%Math.max(56,Math.round(180/detailScale))===0)flowers.push({x,y:groundY(x,z)+9,z,sx:1.2+random()*.5,sy:1.3+random()*.7,sz:1.2+random()*.5,color:0xb5ae8a});}
 const blade=new THREE.BufferGeometry();blade.setAttribute('position',new THREE.Float32BufferAttribute([-1,0,0,0,1,0,.12,0,0, 0,0,-1,0,.8,0,0,0,.18, -.7,0,-.4,.1,.75,.3,.1,0,.1],3));blade.computeVertexNormals();addInstances(lightweight?[]:grass,blade,material(0xffffff,{side:THREE.DoubleSide}),false,true);addInstances(lightweight?[]:ferns,new THREE.ConeGeometry(1,1,7,1,true),material(0xffffff,{side:THREE.DoubleSide}),false,true);addInstances(lightweight?[]:flowers,new THREE.SphereGeometry(1,5,3),material(0xffffff),false,true);
 // Dappled forest light and drifting fireflies, kept to a single instanced draw.
 const motes:Instance[]=Array.from({length:lightweight?0:Math.round((preview?35:70)*detailScale)},()=>({x:random()*W,y:20+random()*120,z:random()*H,sx:.7,sy:.7,sz:.7,color:0xffd682}));const glow=new THREE.MeshBasicMaterial({color:0xffd682,transparent:true,opacity:.7}),moteGeometry=new THREE.SphereGeometry(1,4,3);resources.push(glow,moteGeometry);const motesMesh=new THREE.InstancedMesh(moteGeometry,glow,motes.length),dummy=new THREE.Object3D();motesMesh.frustumCulled=false;scene.add(motesMesh);let lastX=-10000,lastZ=-10000,lastRange=0,lastMote=0; return{update(time:number,x:number,z:number,range:number){
  if(Math.hypot(x-lastX,z-lastZ)>35||range!==lastRange){for(const c of chunks)c.mesh.visible=Math.hypot(c.x-x,c.z-z)<(c.detail?Math.min(range,360):range)+200;lastX=x;lastZ=z;lastRange=range;}
  if(!lightweight&&time-lastMote>.08){let count=0;for(let i=0;i<motes.length;i++){const p=motes[i];if(Math.hypot(p.x-x,p.z-z)>360)continue;dummy.position.set(p.x+Math.sin(time*.25+i)*12,p.y+Math.sin(time*.7+i)*4,p.z+Math.cos(time*.3+i)*10);dummy.scale.setScalar(.7+Math.sin(time*1.5+i)*.22);dummy.updateMatrix();motesMesh.setMatrixAt(count++,dummy.matrix);}motesMesh.count=count;motesMesh.instanceMatrix.needsUpdate=true;lastMote=time;}
 },dispose(){resources.forEach(r=>r.dispose());scene.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});}};
}
