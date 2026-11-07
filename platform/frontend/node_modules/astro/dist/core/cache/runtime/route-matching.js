import { removeLeadingForwardSlash } from "@astrojs/internal-helpers/path";
import { getParts } from "../../routing/parts.js";
import { getPattern } from "../../routing/pattern.js";
import { routeComparator } from "../../routing/priority.js";
/**
* Compile config-level cache route patterns into RegExps.
* The result is memoized on the pipeline — this function is only called once,
* on the first request that needs route matching.
* Returns compiled patterns sorted by Astro's standard route priority (most specific first).
*/
export function compileCacheRoutes(routes, base, trailingSlash) {
	const compiled = Object.entries(routes).map(([path, options]) => {
		const segments = removeLeadingForwardSlash(path).split("/").filter(Boolean).map((s) => getParts(s, path));
		const pattern = getPattern(segments, base, trailingSlash);
		return {
			pattern,
			options,
			segments,
			route: path
		};
	});
	// Sort using Astro's standard route priority comparator
	// routeComparator expects objects with `segments`, `route`, and `type`
	compiled.sort((a, b) => routeComparator({
		segments: a.segments,
		route: a.route,
		type: "page"
	}, {
		segments: b.segments,
		route: b.route,
		type: "page"
	}));
	return compiled;
}
/**
* Called per-request to find the first matching cache rule for a given pathname.
*/
export function matchCacheRoute(pathname, compiledRoutes) {
	for (const route of compiledRoutes) {
		if (route.pattern.test(pathname)) return route.options;
	}
	return null;
}
