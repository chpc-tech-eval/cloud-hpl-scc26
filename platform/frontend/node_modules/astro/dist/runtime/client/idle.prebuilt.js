/**
* This file is prebuilt from packages/astro/src/runtime/client/idle.ts
* Do not edit this directly, but instead edit that file and rerun the prebuild
* to generate this file.
*/
export default `(function(){let e=(e,t)=>{let n=async()=>{await(await e())()},r=typeof t.value==\`object\`?t.value:void 0,i={timeout:r==null?void 0:r.timeout};\`requestIdleCallback\`in window?window.requestIdleCallback(n,i):setTimeout(n,i.timeout||200)};(self.Astro||(self.Astro={})).idle=e,window.dispatchEvent(new Event(\`astro:idle\`))})();`;
