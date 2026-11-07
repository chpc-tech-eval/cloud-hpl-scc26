import nodeFs from "node:fs";
import * as vite from "vite";
import { runHookConfigDone, runHookConfigSetup, runHookServerDone, runHookServerStart } from "../../integrations/hooks.js";
import { devServerAppReadySymbol } from "../constants.js";
import { createVite } from "../create-vite.js";
import { createRoutesList } from "../routing/create-manifest.js";
import { getPrerenderDefault } from "../../prerender/utils.js";
import { syncInternal } from "../sync/index.js";
import { warnMissingAdapter } from "./adapter-validation.js";
export async function createContainer({ isRestart = false, logger, inlineConfig, settings, fs = nodeFs }) {
	// Initialize
	settings = await runHookConfigSetup({
		settings,
		command: "dev",
		logger,
		isRestart
	});
	const { base, server: { host, headers, open: serverOpen, allowedHosts, port } } = settings.config;
	// serverOpen = true, isRestart = false
	// when astro dev --open command is run the first time
	// expected behavior: spawn a new tab
	// ------------------------------------------------------
	// serverOpen = true, isRestart = true
	// when config file is saved
	// expected behavior: do not spawn a new tab
	// ------------------------------------------------------
	// Non-config files don't reach this point
	const isServerOpenURL = typeof serverOpen === "string" && !isRestart;
	const isServerOpenBoolean = serverOpen && !isRestart;
	// Open server to the correct path. We pass the `base` here as we didn't pass the
	// base to the initial Vite config
	const open = isServerOpenURL ? serverOpen : isServerOpenBoolean ? base : false;
	// The client entrypoint for renderers. Since these are imported dynamically
	// we need to tell Vite to preoptimize them.
	const rendererClientEntries = settings.renderers.map((r) => r.clientEntrypoint).filter(Boolean);
	// Set the initial buildOutput default before runHookConfigDone, so that
	// setAdapter() inside astro:config:done can upgrade it to 'server'.
	// This matches the ordering in the build path (packages/astro/src/core/build/index.ts).
	if (!settings.adapter?.adapterFeatures?.buildOutput) {
		settings.buildOutput = getPrerenderDefault(settings.config) ? "static" : "server";
	}
	// Create the route manifest already outside of Vite so that `runHookConfigDone` can use it to inform integrations of the build output
	await runHookConfigDone({
		settings,
		logger,
		command: "dev"
	});
	warnMissingAdapter(logger, settings);
	const mode = inlineConfig?.mode ?? "development";
	const initialRoutesList = await createRoutesList({
		settings,
		fsMod: nodeFs
	}, logger, { dev: true });
	const viteConfig = await createVite({
		server: {
			host,
			headers,
			open,
			allowedHosts,
			port
		},
		optimizeDeps: { include: rendererClientEntries }
	}, {
		settings,
		logger,
		mode,
		command: "dev",
		fs,
		sync: false,
		routesList: initialRoutesList
	});
	const viteServer = await vite.createServer(viteConfig);
	await syncInternal({
		settings,
		mode,
		logger,
		skip: {
			content: !isRestart,
			cleanup: true
		},
		force: inlineConfig?.force,
		command: "dev",
		watcher: viteServer.watcher
	});
	const container = {
		inlineConfig: inlineConfig ?? {},
		fs,
		logger,
		restartInFlight: false,
		settings,
		viteServer,
		handle(req, res) {
			viteServer.middlewares.handle(req, res, Function.prototype);
		},
		close() {
			return closeContainer(container);
		}
	};
	return container;
}
async function closeContainer({ viteServer, settings, logger }) {
	// Background app setup uses the runnable environment's module runner. Let it
	// settle before Vite disconnects that runner so shutdown cannot strand an
	// in-flight module import.
	await viteServer[devServerAppReadySymbol];
	await viteServer.close();
	await runHookServerDone({
		config: settings.config,
		logger
	});
}
export async function startContainer({ settings, viteServer, logger }) {
	const { port } = settings.config.server;
	await viteServer.listen(port);
	const devServerAddressInfo = viteServer.httpServer.address();
	await runHookServerStart({
		config: settings.config,
		address: devServerAddressInfo,
		logger
	});
	return devServerAddressInfo;
}
