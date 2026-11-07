export { createCollectImagesPlugin as satteriCollectImagesPlugin, createHeadingIdsPlugin as satteriHeadingIdsPlugin, createImageMarkerPlugin as satteriImageMarkerPlugin, createHighlightPlugin as satteriHighlightPlugin, 
/** @deprecated Renamed to `satteriHighlightPlugin` (it drives both Shiki and Prism). */
 createHighlightPlugin as satteriShikiPlugin, createHighlightFn as satteriCreateHighlightFn, collectHastText as satteriCollectHastText, createSatteriMarkdownProcessor } from "./satteri-processor.js";
export { isSatteriProcessor, satteri } from "./processor.js";
