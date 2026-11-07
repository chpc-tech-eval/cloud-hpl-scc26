/**
* See the full Astro Configuration API Documentation
* https://astro.build/config
*/
export function defineConfig(config) {
	return config;
}
/**
* Use Astro to generate a fully resolved Vite config
*/
export function getViteConfig(userViteConfig, inlineAstroConfig = {}) {
	// Return an async Vite config getter which exposes a resolved `mode` and `command`
	return async ({ mode, command }) => {
		// Vite `command` is `serve | build`, but Astro uses `dev | build`
		const cmd = command === "serve" ? "dev" : "build";
		// Use dynamic import to avoid pulling in deps unless used
		const [{ mergeConfig }, { loadOrCreateNodeLogger }, { resolveConfig, createSettings }, { createVite }, { runHookConfigSetup, runHookConfigDone }, { createRoutesList }, { getPrerenderDefault }] = await Promise.all([
			import("vite"),
			import("../core/logger/load.js"),
			import("../core/config/index.js"),
			import("../core/create-vite.js"),
			import("../integrations/hooks.js"),
			import("../core/routing/create-manifest.js"),
			import("../prerender/utils.js")
		]);
		const { astroConfig: config } = await resolveConfig(inlineAstroConfig, cmd);
		const logger = await loadOrCreateNodeLogger(config, inlineAstroConfig);
		let settings = await createSettings(config, inlineAstroConfig.logLevel, userViteConfig.root);
		settings = await runHookConfigSetup({
			settings,
			command: cmd,
			logger
		});
		const routesList = await createRoutesList({ settings }, logger, { dev: true });
		settings.buildOutput = getPrerenderDefault(settings.config) ? "static" : "server";
		const viteConfig = await createVite({}, {
			routesList,
			settings,
			command: cmd,
			logger,
			mode,
			sync: false
		});
		await runHookConfigDone({
			settings,
			logger
		});
		return mergeConfig(viteConfig, userViteConfig);
	};
}
