import { getEnvironment } from "../../core/environment/index.js";
import { stringifyParams } from "../../core/routing/params.js";
import { getFallbackRoute, routeIsFallback, routeIsRedirect } from "../../core/routing/helpers.js";
import { callGetStaticPaths, getRouteCache } from "../../core/render/route-cache.js";
import { collectPrerenderMetadata } from "../../core/render-scope/collect.js";
/**
* Collects all static paths for prerendering.
* Handles calling getStaticPaths on each route and populating the route cache.
*/
export class StaticPaths {
	#app;
	constructor(app) {
		this.#app = app;
	}
	/**
	* Get all static paths for prerendering with their associated routes.
	* This avoids needing to re-match routes later, which can be incorrect due to route priority.
	*/
	async getAll() {
		const allPaths = [];
		const manifest = this.#app.manifest;
		// Collect routes to generate (mirrors retrieveRoutesToGenerate)
		const routesToGenerate = [];
		for (const { routeData } of manifest.routes) {
			// Skip non-prerendered routes
			if (!routeData.prerender) continue;
			// Include redirects
			if (routeIsRedirect(routeData)) {
				routesToGenerate.push(routeData);
				continue;
			}
			// Include fallbacks if i18n has fallback configured
			if (routeIsFallback(routeData) && manifest.i18n?.fallback) {
				routesToGenerate.push(routeData);
				continue;
			}
			// Regular page
			routesToGenerate.push(routeData);
		}
		// Get paths for each route (mirrors getPathsForRoute)
		for (const route of routesToGenerate) {
			// Also process fallback routes
			for (const currentRoute of eachRouteInRouteData(route)) {
				const paths = await this.#getPathsForRoute(currentRoute);
				// Use a loop instead of spread operator (allPaths.push(...paths)) to avoid
				// "Maximum call stack size exceeded" error with large arrays (issue #15578).
				// The spread operator tries to pass all array elements as individual arguments,
				// which hits the call stack limit when dealing with 100k+ routes.
				for (const path of paths) {
					allPaths.push(path);
				}
			}
		}
		return allPaths;
	}
	/**
	* Like `getAll()`, but also returns the images used while computing the paths
	* (e.g. by calling `getImage()` in `getStaticPaths()`), so Astro can generate them.
	*
	* A custom prerenderer can return this result from its own `getStaticPaths()`.
	*/
	async getAllWithMetadata(options = {}) {
		const { value: paths, metadata } = await collectPrerenderMetadata(() => this.getAll(), undefined, options);
		return {
			paths,
			metadata: metadata && {
				staticImages: metadata.staticImages,
				referencedImages: metadata.referencedImages
			}
		};
	}
	/**
	* Get paths for a single route.
	* Note: Does not filter duplicates - that's handled by generate.ts with conflict detection.
	*/
	async #getPathsForRoute(route) {
		const paths = [];
		const manifest = this.#app.manifest;
		// Prefer the app's own accessors (they run inside the app's module
		// graph — see the StaticPathsApp docs); fall back to the
		// manifest-keyed functional core for `{ manifest }`-only callers.
		const routeCache = this.#app.routeCache ?? getRouteCache(manifest);
		// Static route - single pathname
		if (route.pathname) {
			paths.push({
				pathname: route.pathname,
				route
			});
			return paths;
		}
		// Dynamic route - need to call getStaticPaths.
		// getComponentByRoute handles redirects and fallbacks.
		const componentInstance = this.#app.getComponentByRoute ? await this.#app.getComponentByRoute(route) : await getEnvironment(manifest).getComponentByRoute(manifest, route);
		// Determine which route to use for getStaticPaths
		const routeToProcess = routeIsRedirect(route) ? route.redirectRoute : routeIsFallback(route) ? getFallbackRoute(route, manifest.routes) : route;
		const actualRoute = routeToProcess ?? route;
		// Use callGetStaticPaths to populate the route cache
		const staticPaths = await callGetStaticPaths({
			mod: componentInstance,
			route: actualRoute,
			routeCache,
			ssr: manifest.serverLike,
			base: manifest.base,
			trailingSlash: manifest.trailingSlash
		});
		// Convert params to pathnames using stringifyParams
		for (const staticPath of staticPaths) {
			const pathname = stringifyParams(staticPath.params, route, manifest.trailingSlash);
			paths.push({
				pathname,
				route,
				cacheKey: staticPath.cacheKey === undefined ? undefined : String(staticPath.cacheKey)
			});
		}
		return paths;
	}
}
/**
* Yields the route and its fallback routes
*/
function* eachRouteInRouteData(route) {
	yield route;
	for (const fallbackRoute of route.fallbackRoutes) {
		yield fallbackRoute;
	}
}
