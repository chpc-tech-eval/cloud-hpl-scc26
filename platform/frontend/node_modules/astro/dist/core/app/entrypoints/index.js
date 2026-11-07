export { App } from "../app.js";
export { BaseApp } from "../base.js";
export { fromRoutingStrategy, toRoutingStrategy } from "../common.js";
export { createConsoleLogger } from "../../logger/impls/console.js";
export { deserializeManifest, deserializeRouteData, deserializeRouteInfo, serializeRouteData, serializeRouteInfo } from "../manifest.js";
export { getInstalledRenderScope, installRenderScope } from "../../render-scope/scope.js";
/** @deprecated `getImage()` records the images it resolves. */
export { recordStaticImage } from "../../render-scope/record.js";
export { collectPrerenderMetadata } from "../../render-scope/collect.js";
export { renderForPrerender } from "../prerender.js";
