import { normalizePath } from "vite";
import { runHookServerSetup } from "../integrations/hooks.js";
/** Connect Astro integrations into Vite, as needed. */
export default function astroIntegrationsContainerPlugin({ settings, logger }) {
	let server;
	return {
		name: "astro:integration-container",
		async configureServer(_server) {
			server = _server;
			if (_server.config.isProduction) return;
			await runHookServerSetup({
				config: settings.config,
				server: _server,
				logger
			});
		},
		async buildStart() {
			if (settings.injectedRoutes.length === settings.resolvedInjectedRoutes.length) return;
			settings.resolvedInjectedRoutes = await Promise.all(settings.injectedRoutes.map((route) => resolveEntryPoint(route, server, this)));
		}
	};
}
async function resolveEntryPoint(route, server, pluginContext) {
	const entrypoint = route.entrypoint.toString();
	// In dev, resolve through the SSR environment's plugin container to avoid
	// triggering the client dep optimizer's registerMissingImport, which can
	// race against optimizer init and corrupt the metadata cache.
	// In build, this.resolve() is safe since there's no dep optimizer race.
	let resolvedId;
	if (server) {
		const resolved = await server.environments.ssr.pluginContainer.resolveId(entrypoint);
		resolvedId = resolved?.id;
	} else {
		resolvedId = await pluginContext.resolve(entrypoint).then((res) => res?.id).catch(() => undefined);
	}
	if (!resolvedId) return route;
	const resolvedEntryPoint = new URL(`file://${normalizePath(resolvedId)}`);
	return {
		...route,
		resolvedEntryPoint
	};
}
