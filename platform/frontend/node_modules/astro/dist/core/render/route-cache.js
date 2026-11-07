import { getEnvironment } from "../environment/index.js";
import { getLogger } from "../logger/manifest-logger.js";
import { createManifestMemo } from "../manifest/memo.js";
import { stringifyParams } from "../routing/params.js";
import { validateDynamicRouteModule, validateGetStaticPathsResult } from "../routing/validation.js";
import { generatePaginateFunction } from "./paginate.js";
export async function callGetStaticPaths({ mod, route, routeCache, ssr, base, trailingSlash }) {
	const cached = routeCache.get(route);
	if (!mod) {
		throw new Error("This is an error caused by Astro and not your code. Please file an issue.");
	}
	// After HMR, `mod` is a new object from a fresh import(). If the cached
	// entry was produced by a previous module instance, treat it as stale so
	// getStaticPaths() is re-called with the updated module.
	if (cached?.staticPaths && cached.mod === mod) {
		return cached.staticPaths;
	}
	validateDynamicRouteModule(mod, {
		ssr,
		route
	});
	// No static paths in SSR mode or for internal routes. Return an empty RouteCacheEntry.
	if (ssr && !route.prerender || route.origin === "internal") {
		const entry = Object.assign([], { keyed: new Map() });
		// Store `mod` alongside the entry so the fast-path above hits on
		// subsequent requests; otherwise `cached.mod === mod` is always false
		// in SSR and we re-enter this branch, triggering the "route cache
		// overwritten" warning on every request after the first.
		routeCache.set(route, {
			...cached,
			mod,
			staticPaths: entry
		});
		return entry;
	}
	const keyedStaticPaths = await computeStaticPaths(mod, route, base, trailingSlash);
	routeCache.set(route, {
		mod,
		staticPaths: keyedStaticPaths
	});
	return keyedStaticPaths;
}
/** Replaces a partial entry with the full result, sharing one `getStaticPaths()` call between concurrent misses. */
export function completeStaticPaths({ route, routeCache, base, trailingSlash }) {
	const cached = routeCache.get(route);
	if (!cached?.partial) return undefined;
	cached.complete ??= computeStaticPaths(cached.mod, route, base, trailingSlash).then((staticPaths) => {
		routeCache.set(route, {
			mod: cached.mod,
			staticPaths
		});
		return staticPaths;
	});
	return cached.complete;
}
async function computeStaticPaths(mod, route, base, trailingSlash) {
	let staticPaths = [];
	// Add a check here to make TypeScript happy.
	// This is already checked in validateDynamicRouteModule().
	if (!mod.getStaticPaths) {
		throw new Error("Unexpected Error.");
	}
	// Calculate your static paths.
	staticPaths = await mod.getStaticPaths({
		// Q: Why the cast?
		// A: So users downstream can have nicer typings, we have to make some sacrifice in our internal typings, which necessitate a cast here
		paginate: generatePaginateFunction(route, base, trailingSlash),
		routePattern: route.route
	});
	validateGetStaticPathsResult(staticPaths, route);
	const keyedStaticPaths = staticPaths;
	keyedStaticPaths.keyed = new Map();
	for (const sp of keyedStaticPaths) {
		const paramsKey = stringifyParams(sp.params, route, trailingSlash);
		keyedStaticPaths.keyed.set(paramsKey, sp);
	}
	return keyedStaticPaths;
}
/**
* Manage the route cache, responsible for caching data related to each route,
* including the result of calling getStaticPaths(). This gives route matching,
* params/props resolution, and prerender generation a shared static-path table.
*
* In dev, this cache intentionally survives requests. It is invalidated by route
* module identity changes after HMR or by explicit cache clears from content data
* changes, not by each request. Dev route matching can call getStaticPaths()
* before rendering, and render-time props resolution may ask for it again.
*/
export class RouteCache {
	logger;
	cache = {};
	runtimeMode;
	constructor(logger, runtimeMode = "production") {
		this.logger = logger;
		this.runtimeMode = runtimeMode;
	}
	/** Clear the cache. */
	clearAll() {
		this.cache = {};
	}
	set(route, entry) {
		const key = this.key(route);
		// NOTE: This shouldn't be called on an already-cached component.
		// Warn here so that an unexpected double-call of getStaticPaths()
		// isn't invisible and developer can track down the issue.
		const existing = this.cache[key];
		if (this.runtimeMode === "production" && existing?.staticPaths && !existing.partial) {
			this.logger.warn(null, `Internal Warning: route cache overwritten. (${key})`);
		}
		this.cache[key] = entry;
	}
	get(route) {
		return this.cache[this.key(route)];
	}
	key(route) {
		return `${route.route}_${route.component}`;
	}
}
const routeCaches = createManifestMemo((manifest) => new RouteCache(getLogger(manifest), getEnvironment(manifest).runtimeMode));
/**
* The `RouteCache` for a manifest. Cleared via
* `getRouteCache(manifest).clearAll()` on dev `astro:content-changed`.
*/
export function getRouteCache(manifest) {
	return routeCaches.get(manifest);
}
export function findPathItemByKey(staticPaths, params, route, logger, trailingSlash) {
	const paramsKey = stringifyParams(params, route, trailingSlash);
	const matchedStaticPath = staticPaths.keyed.get(paramsKey);
	if (matchedStaticPath) {
		return matchedStaticPath;
	}
	logger.debug("router", `findPathItemByKey() - Unexpected cache miss looking for ${paramsKey}`);
}
