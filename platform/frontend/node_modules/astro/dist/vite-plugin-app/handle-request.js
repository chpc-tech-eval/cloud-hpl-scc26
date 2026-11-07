import { removeTrailingForwardSlash } from "@astrojs/internal-helpers/path";
import { shouldAppendForwardSlash } from "../core/build/util.js";
import { clientLocalsSymbol } from "../core/constants.js";
import { getEnvironment, setEnvironment } from "../core/environment/index.js";
import { createSafeError } from "../core/errors/index.js";
import { setLogger } from "../core/logger/manifest-logger.js";
import { createRequest } from "../core/request.js";
import { validateAndDecodePathname } from "../core/util/pathname.js";
import { SERIALIZED_MANIFEST_ID } from "../manifest/serialized.js";
import { recordServerError } from "../vite-plugin-astro-server/error.js";
import { runWithErrorHandling } from "../vite-plugin-astro-server/index.js";
import { handle500Response, writeSSRResult } from "../vite-plugin-astro-server/response.js";
/**
* The manifest object most recently evaluated by each environment's module
* runner. In dev the manifest module is invalidated whenever a src file
* changes, so re-evaluations produce NEW manifest objects that back
* `new FetchState(request)` inside the fetchable graph (ambient resolution).
* Composition (environment record + logger) is re-registered for each new
* object so those states behave like this environment's app. Keyed by the
* ModuleLoader because each runnable environment (ssr, prerender) has its own
* loader, graph, and manifest instance.
*/
const runnerManifests = new WeakMap();
/**
* Loads the user's `src/fetch.ts` (via `virtual:astro:fetchable`) and sets it
* as the fetch handler. Called on every request so that HMR invalidation of
* the virtual module is picked up automatically. Vite caches the module
* internally so repeated calls are cheap.
*/
async function loadFetchHandler(app, loader) {
	try {
		// Keep the runner-graph manifest's composition registered (see
		// `runnerManifests`). Cheap when nothing was invalidated: one cached
		// module lookup and an identity check.
		const { manifest } = await loader.import(SERIALIZED_MANIFEST_ID);
		if (manifest && manifest !== runnerManifests.get(loader) && manifest !== app.manifest) {
			setEnvironment(manifest, getEnvironment(app.manifest));
			setLogger(manifest, app.logger);
			runnerManifests.set(loader, manifest);
		}
	} catch {}
	try {
		const mod = await loader.import("virtual:astro:fetchable");
		if (mod?.default && !mod.isDefaultFetchHandler) {
			app.setFetchHandler(mod.default);
		}
	} catch {}
}
/**
* Handle a dev-server request: the HTTP glue that drives the `DevFacadeApp`
* the way an adapter does — it sits outside the functional core, like the
* node adapter's `serve-app.ts`. The ModuleLoader and AstroSettings are
* closed over at composition time in `createAstroServerApp` and passed as
* `deps`.
*
* @returns Whether or not the request was handled by this handler. If the
* result is not `true`, then the request has not been handled yet and other
* handlers can be run.
*/
export async function handleDevRequest(app, deps, { incomingRequest, incomingResponse, isHttps, prerenderOnly }) {
	const { loader, settings, controller } = deps;
	const manifest = app.manifest;
	// Build a basic origin from the socket protocol and Host header.
	// X-Forwarded-* headers are resolved later inside FetchState, which
	// validates them against allowedDomains and updates the URL. This
	// lets user-provided fetch handlers (src/app.ts) set or modify
	// forwarded headers before FetchState picks them up.
	const protocol = isHttps ? "https" : "http";
	const host = incomingRequest.headers[":authority"] ?? incomingRequest.headers.host;
	const origin = `${protocol}://${host}`;
	const url = new URL(origin + incomingRequest.url);
	let pathname;
	if (manifest.trailingSlash === "never" && !incomingRequest.url) {
		pathname = "";
	} else {
		// We already have a middleware that checks if there's an incoming URL that has invalid URI, so it's safe
		// to only handle paths that exceed the supported decoding depth here.
		try {
			pathname = validateAndDecodePathname(url.pathname);
		} catch {
			pathname = decodeURI(url.pathname);
		}
	}
	// Add config.base back to url before passing it to SSR
	url.pathname = removeTrailingForwardSlash(manifest.base) + url.pathname;
	if (url.pathname.endsWith("/") && !shouldAppendForwardSlash(manifest.trailingSlash, manifest.buildFormat)) {
		url.pathname = url.pathname.slice(0, -1);
	}
	await loadFetchHandler(app, loader);
	// RouteCache is intentionally not cleared per request. devMatch() can use
	// getStaticPaths() to test dynamic route candidates before the later render
	// resolves props from the same static-path table. HMR/content invalidation
	// clears stale entries through module identity checks or content-change events.
	let handled = true;
	await runWithErrorHandling({
		controller,
		pathname,
		async run() {
			const matchedRoute = await app.devMatch(pathname, { prerenderOnly });
			if (!matchedRoute) {
				if (prerenderOnly) {
					// In prerender-only mode, signal that we didn't handle this
					// so the caller can fall through to the SSR handler.
					handled = false;
					return;
				}
				// This should never happen, because ensure404Route will add a 404 route if none exists.
				throw new Error("No route matched, and default 404 route was not found.");
			}
			// When running as the prerender handler, only handle prerendered routes.
			// If the best-matching route is SSR, let the SSR handler handle it instead.
			if (prerenderOnly && !matchedRoute.routeData.prerender) {
				handled = false;
				return;
			}
			// Delay reading the request body until prerenderOnly routing has decided
			// this handler really owns the request. Otherwise a prerender pass that
			// falls through to SSR would exhaust the body stream first.
			let body = undefined;
			if (!(incomingRequest.method === "GET" || incomingRequest.method === "HEAD")) {
				let bytes = [];
				await new Promise((resolve, reject) => {
					incomingRequest.on("data", (part) => {
						bytes.push(part);
					});
					incomingRequest.on("end", resolve);
					// Without this, an errored stream (aborted upload, malformed
					// chunked encoding) never emits 'end' and the request hangs.
					incomingRequest.on("error", reject);
				});
				body = Buffer.concat(bytes);
			}
			// Wire an AbortController to the socket so request.signal
			// reflects client disconnection, matching production behaviour.
			const abortController = new AbortController();
			const socket = incomingRequest.socket;
			const onSocketClose = () => {
				if (!abortController.signal.aborted) {
					abortController.abort();
				}
			};
			if (socket.destroyed) {
				onSocketClose();
			} else {
				socket.on("close", onSocketClose);
			}
			try {
				const request = createRequest({
					url,
					headers: incomingRequest.headers,
					method: incomingRequest.method,
					body,
					logger: app.logger,
					isPrerendered: matchedRoute.routeData.prerender,
					routePattern: matchedRoute.routeData.component,
					init: { signal: abortController.signal }
				});
				// This is required for adapters to set locals in dev mode. They use a dev server middleware to inject locals to the `http.IncomingRequest` object.
				const locals = Reflect.get(incomingRequest, clientLocalsSymbol);
				// Set user specified headers to response object.
				for (const [name, value] of Object.entries(settings.config.server.headers ?? {})) {
					if (value) incomingResponse.setHeader(name, value);
				}
				const clientAddress = incomingRequest.socket.remoteAddress;
				const response = await app.render(request, {
					locals,
					routeData: matchedRoute.routeData,
					clientAddress
				});
				await writeSSRResult(request, response, incomingResponse);
			} finally {
				// Remove the per-request socket listener so it doesn't accumulate
				// across keep-alive requests that reuse the same socket.
				socket.off("close", onSocketClose);
			}
		},
		onError(_err) {
			const error = createSafeError(_err);
			if (loader) {
				const { errorWithMetadata } = recordServerError(loader, manifest, app.logger, error);
				// Dev error overlay.
				handle500Response(loader, incomingResponse, errorWithMetadata);
			}
			return error;
		}
	});
	return handled;
}
