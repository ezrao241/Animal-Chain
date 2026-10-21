// Test-only module hooks: give app/api/game/route.ts an in-memory stand-in for Cloudflare's D1 binding and resolve the
// '@/' path alias, so the real request handler runs under node --test.
export async function resolve(specifier,context,next){
 if(specifier==='cloudflare:workers')return{url:new URL('./fake-workers.mjs',import.meta.url).href,shortCircuit:true};
 if(specifier.startsWith('@/'))return next(new URL('../'+specifier.slice(2)+(/\.\w+$/.test(specifier)?'':'.ts'),import.meta.url).href,context);
 return next(specifier,context);
}
