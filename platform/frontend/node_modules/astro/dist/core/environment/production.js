import { RedirectSinglePageBuiltModule } from "../redirects/index.js";
import { createAssetLink, createModuleScriptElement, createStylesheetElementSet } from "../render/ssr-element.js";
import { getDefaultRoutes } from "../routing/default.js";
import { getFallbackRoute, routeIsFallback, routeIsRedirect } from "../routing/helpers.js";
import { createRewriteRouteValidator } from "../routing/rewrite-validate.js";
import { findRouteToRewrite } from "../routing/rewrite.js";
// Production behavior reads nothing but the manifest, which is what makes it
// a safe default when no environment is registered — a bare `FetchState`
// works with no setup.
async function getModuleForRoute(manifest, route) {
	for (const defaultRoute of getDefaultRoutes(manifest)) {
		if (route.component === defaultRoute.component) {
			return { page: () => Promise.resolve(defaultRoute.instance) };
		}
	}
	let routeToProcess = route;
	if (routeIsRedirect(route)) {
		if (route.redirectRoute) {
			// This is a static redirect
			routeToProcess = route.redirectRoute;
		} else {
			// This is an external redirect, so we return a component stub
			return RedirectSinglePageBuiltModule;
		}
	} else if (routeIsFallback(route)) {
		// This is an i18n fallback route
		routeToProcess = getFallbackRoute(route, manifest.routes);
	}
	if (manifest.pageMap) {
		const importComponentInstance = manifest.pageMap.get(routeToProcess.component);
		if (!importComponentInstance) {
			throw new Error(`Unexpectedly unable to find a component instance for route ${route.route}`);
		}
		return await importComponentInstance();
	} else if (manifest.pageModule) {
		return manifest.pageModule;
	}
	throw new Error("Astro couldn't find the correct page to render, probably because it wasn't correctly mapped for SSR usage. This is an internal error, please file an issue.");
}
async function getComponentByRoute(manifest, routeData) {
	const module = await getModuleForRoute(manifest, routeData);
	return module.page();
}
/**
* The production / bundled environment — the default when nothing is
* registered. A stateless module constant derived from the manifest alone.
*/
export const productionEnvironment = {
	name: "production",
	runtimeMode: "production",
	defaultStreaming: () => true,
	async resolve(manifest, specifier) {
		if (!(specifier in manifest.entryModules)) {
			throw new Error(`Unable to resolve [${specifier}]`);
		}
		const bundlePath = manifest.entryModules[specifier];
		if (bundlePath.startsWith("data:") || bundlePath.length === 0) {
			return bundlePath;
		} else {
			return createAssetLink(bundlePath, manifest.base, manifest.assetsPrefix);
		}
	},
	async headElements(manifest, routeData) {
		const { assetsPrefix, base } = manifest;
		const routeInfo = manifest.routes.find((route) => route.routeData.route === routeData.route);
		// may be used in the future for handling rel=modulepreload, rel=icon, rel=manifest etc.
		const links = new Set();
		const scripts = new Set();
		const styles = createStylesheetElementSet(routeInfo?.styles ?? [], base, assetsPrefix);
		for (const script of routeInfo?.scripts ?? []) {
			if ("stage" in script) {
				if (script.stage === "head-inline") {
					scripts.add({
						props: {},
						children: script.children
					});
				}
			} else {
				scripts.add(createModuleScriptElement(script, base, assetsPrefix));
			}
		}
		return {
			links,
			styles,
			scripts
		};
	},
	// The manifest's componentMetadata fallback stays in `createResult`.
	componentMetadata() {},
	getComponentByRoute,
	getModuleForRoute,
	async tryRewrite(manifest, payload, request) {
		const { newUrl, pathname, routeData } = await findRouteToRewrite({
			payload,
			request,
			// RAW manifest routes, NOT the derived route table: production
			// manifests deliberately do not carry
			// the default 404 route (`createRoutesList` ensures it in dev only),
			// and `findRouteToRewrite` gives an existing `/404` list entry
			// precedence over dynamic routes that also match the path — so the
			// ensured table would let the synthetic default-404 entry shadow a
			// catch-all route on an explicit rewrite to `/404`. The no-match
			// fallback already returns `DEFAULT_404_ROUTE`, so the raw list loses
			// nothing.
			routes: manifest.routes.map((r) => r.routeData),
			trailingSlash: manifest.trailingSlash,
			buildFormat: manifest.buildFormat,
			base: manifest.base,
			outDir: manifest.serverLike ? manifest.buildClientDir : manifest.outDir,
			validate: createRewriteRouteValidator(manifest, getComponentByRoute)
		});
		const componentInstance = await getComponentByRoute(manifest, routeData);
		return {
			newUrl,
			pathname,
			componentInstance,
			routeData
		};
	},
	getRenderers(manifest) {
		return manifest.renderers;
	},
	errorStrategy: "default",
	rendersRedirectPage: () => false,
	injectCspMetaTagsOnErrorPages: false,
	logRequest() {}
};
