import { ASTRO_VITE_ENVIRONMENT_NAMES } from "../core/constants.js";
import { patchOverlay } from "../core/errors/overlay.js";
export function vitePluginAstroServerClient() {
	return {
		name: "astro:server-client",
		applyToEnvironment(environment) {
			return environment.name === ASTRO_VITE_ENVIRONMENT_NAMES.client;
		},
		transform: {
			filter: { id: /vite\/dist\/client\/client\.mjs/ },
			handler(code) {
				// Replace the Vite overlay with ours
				return patchOverlay(code);
			}
		}
	};
}
