import { ASTRO_VITE_ENVIRONMENT_NAMES } from "../core/constants.js";
import { convertPathToPattern } from "tinyglobby";
import { fileURLToPath } from "node:url";
import { rolldownAstroClientScanPlugin } from "./rolldown-plugin-astro-scan.js";
// These specifiers are usually dependencies written in CJS, but loaded through Vite's transform
// pipeline, which Vite doesn't support in development time. This hardcoded list temporarily
// fixes things until Vite can properly handle them, or when they support ESM.
const ONLY_DEV_EXTERNAL = ["prismjs/components/index.js", "string-width"];
const ALWAYS_NOEXTERNAL = [
	"astro",
	"astro/components",
	"@nanostores/preact",
	"@fontsource/*",
	"neotraverse"
];
/**
* This plugin is responsible of setting up the environments of the vite server, such as
* dependencies, SSR, etc.
*
*/
export function vitePluginEnvironment({ command, settings, astroPkgsConfig }) {
	const srcDirPattern = convertPathToPattern(fileURLToPath(settings.config.srcDir));
	return {
		name: "astro:environment",
		configEnvironment(environmentName, _options) {
			const finalEnvironmentOptions = {
				optimizeDeps: {
					include: [],
					exclude: []
				},
				resolve: { 
				// Astro imports in third-party packages should use the same version as root
dedupe: ["astro"] }
			};
			if (environmentName === ASTRO_VITE_ENVIRONMENT_NAMES.ssr || environmentName === ASTRO_VITE_ENVIRONMENT_NAMES.astro || environmentName === ASTRO_VITE_ENVIRONMENT_NAMES.prerender || environmentName === ASTRO_VITE_ENVIRONMENT_NAMES.client) {
				if (_options.resolve?.noExternal !== true) {
					finalEnvironmentOptions.resolve.noExternal = [...ALWAYS_NOEXTERNAL, ...astroPkgsConfig.ssr.noExternal];
					finalEnvironmentOptions.resolve.external = [...command === "dev" ? ONLY_DEV_EXTERNAL : [], ...astroPkgsConfig.ssr.external];
				}
				if (_options.optimizeDeps?.noDiscovery === false) {
					finalEnvironmentOptions.optimizeDeps = {
						// Server modules must be scanned before a request starts because late dependency
						// optimization reloads workerd modules during the request.
						// https://github.com/withastro/astro/issues/18130
						entries: [`${srcDirPattern}**/*.{ts,js,mjs,mts,jsx,tsx,vue,svelte,html,astro,mdx}`],
						// Vite does not classify .mts files as scannable unless the extension is explicit.
						extensions: [".mts"],
						include: [],
						exclude: []
					};
				}
			}
			if (environmentName === ASTRO_VITE_ENVIRONMENT_NAMES.client) {
				finalEnvironmentOptions.optimizeDeps = {
					include: ["astro > html-escaper", "astro/runtime/client/dev-toolbar/entrypoint.js"],
					exclude: [
						"astro:*",
						"virtual:astro:*",
						"astro/virtual-modules/prefetch.js"
					],
					// .astro files can't be rendered on the client, but Vite's dep
					// scanner extracts their <script> tags to discover client-side
					// imports. Without .astro here, deps reachable only through
					// <script> (e.g. workspace packages and their transitive deps)
					// are missed during the initial scan, causing late re-optimization
					// that 504s already-served modules like the dev toolbar.
					entries: [`${srcDirPattern}**/*.{jsx,tsx,vue,svelte,html,astro,mdx}`],
					rolldownOptions: { plugins: [rolldownAstroClientScanPlugin()] }
				};
			}
			return finalEnvironmentOptions;
		}
	};
}
