import { renderForPrerender } from "../app/prerender.js";
import { StaticPaths } from "../../runtime/prerender/static-paths.js";
/**
* Creates the default prerenderer that uses Node to import the bundle and render pages.
* This is used when no custom prerenderer is set by an adapter.
*/
export function createDefaultPrerenderer({ internals, options, prerenderOutputDir }) {
	const prerenderer = {
		name: "astro:default",
		async setup() {
			// Import the prerender entry bundle
			const prerenderEntryFileName = internals.prerenderEntryFileName;
			if (!prerenderEntryFileName) {
				throw new Error(`Prerender entry filename not found in build internals. This is likely a bug in Astro.`);
			}
			const prerenderEntryUrl = new URL(prerenderEntryFileName, prerenderOutputDir);
			const { app } = await import(prerenderEntryUrl.toString());
			app.setInternals(internals);
			app.setOptions({
				settings: {
					scripts: options.settings.scripts,
					redirectPage: options.settings.config.experimental.redirectPage
				},
				logger: options.logger
			});
			// Rebuilds in one process reuse the cached module, and its stale static paths.
			app.routeCache.clearAll();
			prerenderer.app = app;
		},
		async getStaticPaths() {
			const staticPaths = new StaticPaths(prerenderer.app);
			return staticPaths.getAllWithMetadata();
		},
		async render(request, { routeData }) {
			return renderForPrerender(prerenderer.app, request, { routeData });
		},
		async teardown() {
			// No cleanup needed for default prerenderer
		}
	};
	return prerenderer;
}
