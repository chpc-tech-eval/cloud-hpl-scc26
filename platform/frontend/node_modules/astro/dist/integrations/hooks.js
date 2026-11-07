import fsMod from "node:fs";
import { fileURLToPath } from "node:url";
import { time } from "@astrojs/internal-helpers/timings";
import colors from "piccolore";
import { mergeConfig as mergeViteConfig } from "vite";
import astroIntegrationActionsRouteHandler from "../actions/integration.js";
import { isActionsFilePresent } from "../actions/actions-file.js";
import { CONTENT_LAYER_TYPE } from "../content/consts.js";
import { globalContentLayer } from "../content/instance.js";
import { globalContentConfigObserver } from "../content/utils.js";
import { buildClientDirectiveEntrypoint } from "../core/client-directive/index.js";
import { mergeConfig } from "../core/config/merge.js";
import { validateConfigRefined } from "../core/config/validate.js";
import { validateSetAdapter } from "../core/dev/adapter-validation.js";
import { getRouteGenerator } from "../core/routing/generator.js";
import { validateSupportedFeatures } from "./features-validation.js";
import { loadLoggerDestination } from "../core/logger/load.js";
async function withTakingALongTimeMsg({ name, hookName, hookFn, logger, integrationLogger }) {
	const timeout = setTimeout(() => {
		logger.info("build", `Waiting for integration ${colors.bold(JSON.stringify(name))}, hook ${colors.bold(JSON.stringify(hookName))}...`);
	}, 3e3);
	try {
		return await hookFn();
	} catch (err) {
		integrationLogger.error(`An unhandled error occurred while running the ${colors.bold(JSON.stringify(hookName))} hook`);
		throw err;
	} finally {
		clearTimeout(timeout);
	}
}
/** Executes the specified hook of the integration if present, and handles loggers */
async function runHookInternal({ integration, hookName, logger, params }) {
	const hook = integration?.hooks?.[hookName];
	const integrationLogger = getLogger(integration, logger);
	if (hook) {
		await time("integration", integration.name, () => withTakingALongTimeMsg({
			name: integration.name,
			hookName,
			hookFn: () => hook(Object.assign(params(), { logger: integrationLogger })),
			logger,
			integrationLogger
		}), { hook: hookName });
	}
	return { integrationLogger };
}
// Used internally to store instances of loggers.
const Loggers = new WeakMap();
function getLogger(integration, logger) {
	if (Loggers.has(integration)) {
		// SAFETY: we check the existence in the if block
		return Loggers.get(integration);
	}
	const integrationLogger = logger.forkIntegrationLogger(integration.name);
	Loggers.set(integration, integrationLogger);
	return integrationLogger;
}
const serverEventPrefix = "astro-dev-toolbar";
export function getToolbarServerCommunicationHelpers(server) {
	return {
		/**
		* Send a message to the dev toolbar that an app can listen for. The payload can be any serializable data.
		* @param event - The event name
		* @param payload - The payload to send
		*/
		send: (event, payload) => {
			server.environments.client.hot.send(event, payload);
		},
		/**
		* Receive a message from a dev toolbar app.
		* @param event
		* @param callback
		*/
		on: (event, callback) => {
			server.hot.on(event, callback);
		},
		/**
		* Fired when an app is initialized.
		* @param appId - The id of the app that was initialized
		* @param callback - The callback to run when the app is initialized
		*/
		onAppInitialized: (appId, callback) => {
			server.hot.on(`${serverEventPrefix}:${appId}:initialized`, callback);
		},
		/**
		* Fired when an app is toggled on or off.
		* @param appId - The id of the app that was toggled
		* @param callback - The callback to run when the app is toggled
		*/
		onAppToggled: (appId, callback) => {
			server.hot.on(`${serverEventPrefix}:${appId}:toggled`, callback);
		}
	};
}
// Will match any invalid characters (will be converted to _). We only allow a-zA-Z0-9.-_
const SAFE_CHARS_RE = /[^\w.-]/g;
export function normalizeCodegenDir(integrationName) {
	return `./integrations/${integrationName.replace(SAFE_CHARS_RE, "_")}/`;
}
export function normalizeInjectedTypeFilename(filename, integrationName) {
	if (!filename.endsWith(".d.ts")) {
		throw new Error(`Integration ${colors.bold(integrationName)} is injecting a type that does not end with "${colors.bold(".d.ts")}"`);
	}
	return `${normalizeCodegenDir(integrationName)}${filename.replace(SAFE_CHARS_RE, "_")}`;
}
export async function runHookConfigSetup({ settings, command, logger, isRestart = false, fs = fsMod }) {
	// An adapter is an integration, so if one is provided add it to the list of integrations.
	if (settings.config.adapter) {
		settings.config.integrations.unshift(settings.config.adapter);
	}
	const actionsFilename = await isActionsFilePresent(fs, settings.config.srcDir);
	if (actionsFilename) {
		settings.config.integrations.push(astroIntegrationActionsRouteHandler({
			settings,
			filename: actionsFilename
		}));
	}
	let updatedConfig = { ...settings.config };
	let updatedSettings = {
		...settings,
		config: updatedConfig
	};
	let addedClientDirectives = new Map();
	let astroJSXRenderer = null;
	// eslint-disable-next-line @typescript-eslint/prefer-for-of -- We need a for loop to be able to read integrations pushed while the loop is running.
	for (let i = 0; i < updatedConfig.integrations.length; i++) {
		const integration = updatedConfig.integrations[i];
		/**
		* By making integration hooks optional, Astro can now ignore null or undefined Integrations
		* instead of giving an internal error most people can't read
		*
		* This also enables optional integrations, e.g.
		* ```ts
		* integration: [
		*   // Only run `compress` integration in production environments, etc...
		*   import.meta.env.production ? compress() : null
		* ]
		* ```
		*/
		let isLoggerUpdated = false;
		const { integrationLogger } = await runHookInternal({
			integration,
			hookName: "astro:config:setup",
			logger,
			params: () => {
				const hooks = {
					config: updatedConfig,
					command,
					isRestart,
					addRenderer(renderer) {
						if (!renderer.name) {
							throw new Error(`Integration ${colors.bold(integration.name)} has an unnamed renderer.`);
						}
						if (!renderer.serverEntrypoint) {
							throw new Error(`Renderer ${colors.bold(renderer.name)} does not provide a serverEntrypoint.`);
						}
						if (renderer.name === "astro:jsx") {
							astroJSXRenderer = renderer;
						} else {
							updatedSettings.renderers.push(renderer);
						}
					},
					injectScript: (stage, content) => {
						updatedSettings.scripts.push({
							stage,
							content
						});
					},
					updateConfig: (newConfig) => {
						// Logger destination is updated later because it's async
						if (newConfig.logger?.entrypoint) {
							isLoggerUpdated = true;
						}
						updatedConfig = mergeConfig(updatedConfig, newConfig);
						return { ...updatedConfig };
					},
					injectRoute: (injectRoute) => {
						if (injectRoute.entrypoint == null && "entryPoint" in injectRoute) {
							logger.warn(null, `The injected route "${injectRoute.pattern}" by ${integration.name} specifies the entry point with the "entryPoint" property. This property is deprecated, please use "entrypoint" instead.`);
							injectRoute.entrypoint = injectRoute.entryPoint;
						}
						updatedSettings.injectedRoutes.push({
							...injectRoute,
							origin: "external"
						});
					},
					addWatchFile: (path) => {
						updatedSettings.watchFiles.push(path instanceof URL ? fileURLToPath(path) : path);
					},
					addDevToolbarApp: (entrypoint) => {
						updatedSettings.devToolbarApps.push(entrypoint);
					},
					addClientDirective: ({ name, entrypoint }) => {
						if (updatedSettings.clientDirectives.has(name) || addedClientDirectives.has(name)) {
							throw new Error(`The "${integration.name}" integration is trying to add the "${name}" client directive, but it already exists.`);
						}
						// TODO: this should be performed after astro:config:done
						addedClientDirectives.set(name, buildClientDirectiveEntrypoint(name, entrypoint, settings.config.root));
					},
					addMiddleware: ({ order, entrypoint }) => {
						if (typeof updatedSettings.middlewares[order] === "undefined") {
							throw new Error(`The "${integration.name}" integration is trying to add middleware but did not specify an order.`);
						}
						logger.debug("middleware", `The integration ${integration.name} has added middleware that runs ${order === "pre" ? "before" : "after"} any application middleware you define.`);
						updatedSettings.middlewares[order].push(typeof entrypoint === "string" ? entrypoint : fileURLToPath(entrypoint));
					},
					createCodegenDir: () => {
						const codegenDir = new URL(normalizeCodegenDir(integration.name), settings.dotAstroDir);
						fs.mkdirSync(codegenDir, { recursive: true });
						return codegenDir;
					}
				};
				// Public, intentionally undocumented hooks - not subject to semver.
				// Intended for internal integrations (ex. `@astrojs/mdx`),
				// though accessible to integration authors if discovered.
				function addPageExtension(...input) {
					const exts = input.flat(Number.POSITIVE_INFINITY).map((ext) => `.${ext.replace(/^\./, "")}`);
					updatedSettings.pageExtensions.push(...exts);
				}
				function addContentEntryType(contentEntryType) {
					updatedSettings.contentEntryTypes.push(contentEntryType);
				}
				function addDataEntryType(dataEntryType) {
					updatedSettings.dataEntryTypes.push(dataEntryType);
				}
				Object.defineProperty(hooks, "addPageExtension", {
					value: addPageExtension,
					writable: false,
					enumerable: false
				});
				Object.defineProperty(hooks, "addContentEntryType", {
					value: addContentEntryType,
					writable: false,
					enumerable: false
				});
				Object.defineProperty(hooks, "addDataEntryType", {
					value: addDataEntryType,
					writable: false,
					enumerable: false
				});
				return hooks;
			}
		});
		// Add custom client directives to settings, waiting for compiled code by rolldown
		for (const [name, compiled] of addedClientDirectives) {
			updatedSettings.clientDirectives.set(name, await compiled);
		}
		try {
			updatedConfig = await validateConfigRefined(updatedConfig);
			if (isLoggerUpdated) {
				logger.setDestination(await loadLoggerDestination(updatedConfig.logger, updatedConfig.root));
			}
		} catch (error) {
			integrationLogger.error("An error occurred while updating the config");
			throw error;
		}
	}
	// The astro:jsx renderer should come last, to not interfere with others.
	if (astroJSXRenderer) {
		updatedSettings.renderers.push(astroJSXRenderer);
	}
	updatedSettings.config = updatedConfig;
	return updatedSettings;
}
export async function runHookConfigDone({ settings, logger, command }) {
	for (const integration of settings.config.integrations) {
		await runHookInternal({
			integration,
			hookName: "astro:config:done",
			logger,
			params: () => ({
				config: settings.config,
				setAdapter(adapter) {
					validateSetAdapter(logger, settings, adapter, integration.name, command);
					if (adapter.adapterFeatures?.buildOutput !== "static") {
						settings.buildOutput = "server";
					}
					if (!adapter.supportedAstroFeatures) {
						throw new Error(`The adapter ${adapter.name} doesn't provide a feature map. It is required in Astro 4.0.`);
					} else {
						validateSupportedFeatures(adapter.name, adapter.supportedAstroFeatures, settings, logger);
					}
					settings.adapter = adapter;
				},
				injectTypes(injectedType) {
					const normalizedFilename = normalizeInjectedTypeFilename(injectedType.filename, integration.name);
					settings.injectedTypes.push({
						filename: normalizedFilename,
						content: injectedType.content
					});
					// It must be relative to dotAstroDir here and not inside normalizeInjectedTypeFilename
					// because injectedTypes are handled relatively to the dotAstroDir already
					return new URL(normalizedFilename, settings.dotAstroDir);
				},
				get buildOutput() {
					return settings.buildOutput;
				}
			})
		});
	}
}
export async function runHookServerSetup({ config, server, logger }) {
	let refreshContent;
	refreshContent = async (options) => {
		const contentConfig = globalContentConfigObserver.get();
		if (contentConfig.status !== "loaded" || !Object.values(contentConfig.config.collections).some((collection) => collection.type === CONTENT_LAYER_TYPE)) {
			return;
		}
		const contentLayer = await globalContentLayer.get();
		await contentLayer?.sync(options);
	};
	for (const integration of config.integrations) {
		await runHookInternal({
			integration,
			hookName: "astro:server:setup",
			logger,
			params: () => ({
				server,
				toolbar: getToolbarServerCommunicationHelpers(server),
				refreshContent
			})
		});
	}
}
export async function runHookServerStart({ config, address, logger }) {
	for (const integration of config.integrations) {
		await runHookInternal({
			integration,
			hookName: "astro:server:start",
			logger,
			params: () => ({ address })
		});
	}
}
export async function runHookServerDone({ config, logger }) {
	for (const integration of config.integrations) {
		await runHookInternal({
			integration,
			hookName: "astro:server:done",
			logger,
			params: () => ({})
		});
	}
}
export async function runHookBuildStart({ settings, logger }) {
	for (const integration of settings.config.integrations) {
		await runHookInternal({
			integration,
			hookName: "astro:build:start",
			logger,
			params: () => ({ setPrerenderer(prerenderer) {
				settings.prerenderer = prerenderer;
			} })
		});
	}
}
export async function runHookBuildSetup({ config, vite, pages, target, logger }) {
	let updatedConfig = vite;
	for (const integration of config.integrations) {
		await runHookInternal({
			integration,
			hookName: "astro:build:setup",
			logger,
			params: () => ({
				vite,
				pages,
				target,
				updateConfig: (newConfig) => {
					updatedConfig = mergeViteConfig(updatedConfig, newConfig);
					return { ...updatedConfig };
				}
			})
		});
	}
	return updatedConfig;
}
export async function runHookBuildSsr({ config, manifest, logger, middlewareEntryPoint }) {
	for (const integration of config.integrations) {
		await runHookInternal({
			integration,
			hookName: "astro:build:ssr",
			logger,
			params: () => ({
				manifest,
				middlewareEntryPoint
			})
		});
	}
}
export async function runHookBuildGenerated({ settings, logger, routeToHeaders, dir }) {
	for (const integration of settings.config.integrations) {
		await runHookInternal({
			integration,
			hookName: "astro:build:generated",
			logger,
			params: () => ({
				dir,
				routeToHeaders
			})
		});
	}
}
export async function runHookBuildDone({ settings, dir, pages, routes, logger }) {
	await fsMod.promises.mkdir(dir, { recursive: true });
	for (const integration of settings.config.integrations) {
		await runHookInternal({
			integration,
			hookName: "astro:build:done",
			logger,
			params: () => ({
				pages: pages.map((p) => ({ pathname: p })),
				dir,
				assets: new Map(routes.filter((r) => r.distURL !== undefined).map((r) => [r.route, r.distURL]))
			})
		});
	}
}
export async function runHookRouteSetup({ route, settings, logger }) {
	const prerenderChangeLogs = [];
	for (const integration of settings.config.integrations) {
		const originalRoute = { ...route };
		await runHookInternal({
			integration,
			hookName: "astro:route:setup",
			logger,
			params: () => ({ route })
		});
		if (route.prerender !== originalRoute.prerender) {
			prerenderChangeLogs.push({
				integrationName: integration.name,
				value: route.prerender
			});
		}
	}
	if (prerenderChangeLogs.length > 1) {
		logger.debug("router", `The ${route.component} route's prerender option has been changed multiple times by integrations:\n` + prerenderChangeLogs.map((log) => `- ${log.integrationName}: ${log.value}`).join("\n"));
	}
}
export async function runHookRoutesResolved({ routes, settings, logger }) {
	for (const integration of settings.config.integrations) {
		await runHookInternal({
			integration,
			hookName: "astro:routes:resolved",
			logger,
			params: () => ({ routes: routes.map((route) => toIntegrationResolvedRoute(route, settings.config.trailingSlash)) })
		});
	}
}
export function toIntegrationResolvedRoute(route, trailingSlash) {
	return {
		isPrerendered: route.prerender,
		entrypoint: route.component,
		pattern: route.route,
		params: route.params,
		origin: route.origin,
		generate: getRouteGenerator(route.segments, trailingSlash),
		patternRegex: route.pattern,
		segments: route.segments,
		type: route.type,
		pathname: route.pathname,
		redirect: route.redirect,
		redirectRoute: route.redirectRoute ? toIntegrationResolvedRoute(route.redirectRoute, trailingSlash) : undefined,
		fallbackRoutes: route.fallbackRoutes.map((fallbackRoute) => toIntegrationResolvedRoute(fallbackRoute, trailingSlash))
	};
}
