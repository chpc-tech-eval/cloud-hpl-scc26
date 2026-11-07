/**
 * This file is prebuilt from packages/astro/src/runtime/client/media.ts
 * Do not edit this directly, but instead edit that file and rerun the prebuild
 * to generate this file.
 */
declare const _default: "(function(){let e=(e,t)=>{let n=async()=>{await(await e())()};if(t.value){let e=matchMedia(t.value);e.matches?n():e.addEventListener(`change`,n,{once:!0})}};(self.Astro||(self.Astro={})).media=e,window.dispatchEvent(new Event(`astro:media`))})();";
export default _default;
