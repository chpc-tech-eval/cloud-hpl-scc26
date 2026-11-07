export function getImageServiceConfig(service, target) {
	const resolved = "runtime" in service ? service[target] : service;
	// The schema defaults `config` once, so a service set by an integration may not have it.
	return {
		...resolved,
		config: resolved.config ?? {}
	};
}
