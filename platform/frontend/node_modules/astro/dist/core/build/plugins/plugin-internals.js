import { normalizeEntryId } from "./plugin-component-entry.js";
import { ASTRO_VITE_ENVIRONMENT_NAMES } from "../../constants.js";
import { getAssetsPluginApi } from "../../../assets/utils/assets.js";
function getRollupInputAsSet(rollupInput) {
	if (Array.isArray(rollupInput)) {
		return new Set(rollupInput);
	} else if (typeof rollupInput === "string") {
		return new Set([rollupInput]);
	} else if (rollupInput && typeof rollupInput === "object") {
		return new Set(Object.values(rollupInput));
	} else {
		return new Set();
	}
}
export function pluginInternals(options, internals) {
	return {
		name: "@astro/plugin-build-internals",
		applyToEnvironment(environment) {
			return environment.name === ASTRO_VITE_ENVIRONMENT_NAMES.client || environment.name === ASTRO_VITE_ENVIRONMENT_NAMES.ssr || environment.name === ASTRO_VITE_ENVIRONMENT_NAMES.prerender;
		},
		configEnvironment(environmentName) {
			// Prender environment is only enabled during the build
			if (environmentName === ASTRO_VITE_ENVIRONMENT_NAMES.prerender) {
				return {
					build: { rolldownOptions: { 
					// These packages as they're not bundle-friendly. Users with strict package installations
					// need to manually install these themselves if they use the related features.
external: ["sharp"] } },
					resolve: { 
					// Always bundle Astro runtime when building for SSR
noExternal: ["astro", "@astrojs/internal-helpers"] }
				};
			}
		},
		async generateBundle(_options, bundle) {
			// A live set shared by every environment, read once all builds are done.
			internals.referencedImages ??= getAssetsPluginApi(this.environment?.config.plugins)?.referencedImages;
			// Read the rollup input directly from the current environment's config rather than
			// relying on a closure variable from configResolved. With Vite's per-environment config
			// resolution, a shared closure variable would be overwritten by the last environment's
			// configResolved call, causing inputs from one environment (e.g. SSR) to leak into
			// another (e.g. client). This caused server-only modules like @astrojs/node/server.js
			// to be resolved in the client environment, triggering spurious "externalized for
			// browser compatibility" warnings.
			const input = getRollupInputAsSet(this.environment?.config.build.rollupOptions.input);
			const promises = [];
			const mapping = new Map();
			const allInput = new Set([...input, ...internals.clientInput]);
			for (const specifier of allInput) {
				promises.push(this.resolve(specifier).then((result) => {
					if (result) {
						if (mapping.has(result.id)) {
							mapping.get(result.id).add(specifier);
						} else {
							mapping.set(result.id, new Set([specifier]));
						}
					}
				}));
			}
			await Promise.all(promises);
			const isPrerender = this.environment?.name === ASTRO_VITE_ENVIRONMENT_NAMES.prerender;
			for (const [_, chunk] of Object.entries(bundle)) {
				if (chunk.fileName.startsWith(options.settings.config.build.assets)) {
					internals.clientChunksAndAssets.add(chunk.fileName);
				}
				if (chunk.type === "chunk" && chunk.facadeModuleId) {
					const specifiers = mapping.get(chunk.facadeModuleId) || new Set([chunk.facadeModuleId]);
					for (const specifier of specifiers) {
						const normalizedId = normalizeEntryId(specifier);
						internals.entrySpecifierToBundleMap.set(normalizedId, chunk.fileName);
						if (isPrerender) {
							internals.prerenderOnlyEntrySpecifiers.add(normalizedId);
						} else {
							// Present in SSR or client — no longer prerender-only
							internals.prerenderOnlyEntrySpecifiers.delete(normalizedId);
						}
					}
				}
			}
		}
	};
}
