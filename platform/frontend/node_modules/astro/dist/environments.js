import { ASTRO_VITE_ENVIRONMENT_NAMES } from "./core/constants.js";
export function isAstroServerEnvironment(environment) {
	return environment.name === ASTRO_VITE_ENVIRONMENT_NAMES.ssr || environment.name === ASTRO_VITE_ENVIRONMENT_NAMES.prerender || environment.name === ASTRO_VITE_ENVIRONMENT_NAMES.astro;
}
export function isAstroClientEnvironment(environment) {
	return environment.name === ASTRO_VITE_ENVIRONMENT_NAMES.client;
}
