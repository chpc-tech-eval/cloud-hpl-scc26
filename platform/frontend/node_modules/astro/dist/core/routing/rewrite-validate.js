import { NoMatchingStaticPathFound } from "../errors/errors-data.js";
import { isAstroError } from "../errors/errors.js";
import { getLogger } from "../logger/manifest-logger.js";
import { getProps } from "../render/params-and-props.js";
import { getRouteCache } from "../render/route-cache.js";
/**
* Creates the check `findRouteToRewrite` runs on a dynamic route whose
* `distURL` is empty. Returns `true` when `getStaticPaths()` produces the
* pathname, `false` when it throws `NoMatchingStaticPathFound`, and rethrows
* any other error so a broken `getStaticPaths()` is not hidden as a 404.
*/
export function createRewriteRouteValidator(manifest, getComponentByRoute) {
	return async (route, pathname) => {
		try {
			await getProps({
				mod: await getComponentByRoute(manifest, route),
				routeData: route,
				routeCache: getRouteCache(manifest),
				pathname,
				logger: getLogger(manifest),
				serverLike: manifest.serverLike,
				base: manifest.base,
				trailingSlash: manifest.trailingSlash
			});
			return true;
		} catch (e) {
			if (isAstroError(e) && e.title === NoMatchingStaticPathFound.title) {
				return false;
			}
			throw e;
		}
	};
}
