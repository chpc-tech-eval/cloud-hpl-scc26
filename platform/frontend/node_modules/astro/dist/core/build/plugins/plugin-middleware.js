import { vitePluginMiddlewareBuild } from "../../middleware/vite-plugin.js";
import { ASTRO_VITE_ENVIRONMENT_NAMES } from "../../constants.js";
export function pluginMiddleware(internals) {
	const plugin = vitePluginMiddlewareBuild(internals);
	return {
		...plugin,
		applyToEnvironment(environment) {
			return environment.name === ASTRO_VITE_ENVIRONMENT_NAMES.ssr;
		}
	};
}
