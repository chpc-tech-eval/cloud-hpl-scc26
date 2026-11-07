export function normalizeCacheProviderConfig(provider) {
	return {
		name: provider.name,
		entrypoint: provider.entrypoint instanceof URL ? provider.entrypoint.href : provider.entrypoint,
		config: provider.config
	};
}
/**
* Normalize a route rule to extract cache options.
*/
export function normalizeRouteRuleCacheOptions(rule) {
	if (!rule) return undefined;
	if (rule.maxAge === undefined && rule.swr === undefined && rule.tags === undefined) {
		return undefined;
	}
	return {
		maxAge: rule.maxAge,
		swr: rule.swr,
		tags: rule.tags
	};
}
/**
* Extract cache routes from the `routeRules` config.
*/
export function extractCacheRoutesFromRouteRules(routeRules) {
	if (!routeRules) return undefined;
	const cacheRoutes = {};
	for (const [pattern, rule] of Object.entries(routeRules)) {
		const cacheOptions = normalizeRouteRuleCacheOptions(rule);
		if (cacheOptions) {
			cacheRoutes[pattern] = cacheOptions;
		}
	}
	return Object.keys(cacheRoutes).length > 0 ? cacheRoutes : undefined;
}
export function cacheConfigToManifest(cacheConfig, routeRulesConfig) {
	if (!cacheConfig?.provider) {
		return undefined;
	}
	const provider = normalizeCacheProviderConfig(cacheConfig.provider);
	const routes = extractCacheRoutesFromRouteRules(routeRulesConfig);
	return {
		provider: provider.entrypoint,
		options: provider.config,
		routes
	};
}
