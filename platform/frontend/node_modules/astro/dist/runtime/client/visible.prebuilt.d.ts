/**
 * This file is prebuilt from packages/astro/src/runtime/client/visible.ts
 * Do not edit this directly, but instead edit that file and rerun the prebuild
 * to generate this file.
 */
declare const _default: "(function(){let e=(e,t,n)=>{let r=async()=>{await(await e())()},i=typeof t.value==`object`?t.value:void 0,a={rootMargin:i==null?void 0:i.rootMargin},o=new IntersectionObserver(e=>{for(let t of e)if(t.isIntersecting){o.disconnect(),r();break}},a);for(let e of n.children)o.observe(e)};(self.Astro||(self.Astro={})).visible=e,window.dispatchEvent(new Event(`astro:visible`))})();";
export default _default;
