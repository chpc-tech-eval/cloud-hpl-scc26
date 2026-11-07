export function getAstroMetadata(modInfo) {
	if (modInfo.meta?.astro) {
		return modInfo.meta.astro;
	}
	return undefined;
}
export function createDefaultAstroMetadata() {
	return {
		hydratedComponents: [],
		clientOnlyComponents: [],
		serverComponents: [],
		scripts: [],
		propagation: "none",
		containsHead: false,
		pageOptions: {}
	};
}
