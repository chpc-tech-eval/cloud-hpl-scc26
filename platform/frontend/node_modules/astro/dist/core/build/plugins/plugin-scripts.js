import { shouldInlineAsset } from "./util.js";
import { ASTRO_VITE_ENVIRONMENT_NAMES } from "../../constants.js";
export function chunkHasDynamicImports(output, getModuleInfo) {
	return output.dynamicImports.length > 0 || output.moduleIds.some((id) => (getModuleInfo(id)?.dynamicallyImportedIds.length ?? 0) > 0);
}
export function shouldInlineScriptChunk(output, { discoveredScripts, importedIds, assetInlineLimit, getModuleInfo }) {
	const facadeModuleId = output.facadeModuleId;
	if (facadeModuleId === null) return false;
	return discoveredScripts.has(facadeModuleId) && !importedIds.has(output.fileName) && output.imports.length === 0 && !chunkHasDynamicImports(output, getModuleInfo) && shouldInlineAsset(output.code, output.fileName, assetInlineLimit);
}
/**
* Inline scripts from Astro files directly into the HTML.
*/
export function pluginScripts(internals) {
	let assetInlineLimit;
	return {
		name: "@astro/plugin-scripts",
		applyToEnvironment(environment) {
			return environment.name === ASTRO_VITE_ENVIRONMENT_NAMES.client;
		},
		configResolved(config) {
			assetInlineLimit = config.build.assetsInlineLimit;
		},
		generateBundle: {
			// Let Vite replace preload markers before copying chunk code into HTML.
			order: "post",
			async handler(_options, bundle) {
				const outputs = Object.values(bundle);
				// Track ids that are imported by chunks so we don't inline scripts that are imported
				const importedIds = new Set();
				for (const output of outputs) {
					if (output.type === "chunk") {
						for (const id of output.imports) {
							importedIds.add(id);
						}
					}
				}
				const getModuleInfo = this.getModuleInfo.bind(this);
				for (const output of outputs) {
					// Try to inline scripts that don't import anything as is within the inline limit
					if (output.type === "chunk" && shouldInlineScriptChunk(output, {
						discoveredScripts: internals.discoveredScripts,
						importedIds,
						assetInlineLimit,
						getModuleInfo
					})) {
						internals.inlinedScripts.set(output.facadeModuleId, output.code.trim());
						delete bundle[output.fileName];
					}
				}
			}
		}
	};
}
