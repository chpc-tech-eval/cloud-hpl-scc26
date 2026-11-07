import { parentPort, workerData } from "node:worker_threads";
import { parse, stringify } from "devalue";
import { StaticPaths } from "../../runtime/prerender/static-paths.js";
import { PAGE_SCRIPT_ID } from "../../vite-plugin-scripts/index.js";
import { deserializeRouteData, serializeRouteData } from "../app/manifest.js";
import { renderForPrerender } from "../app/prerender.js";
import { ensureAsyncRenderScope } from "../render-scope/node-scope.js";
import { createRequest } from "../request.js";
const port = parentPort;
const data = workerData;
const renderScope = ensureAsyncRenderScope();
const workerCollectors = {
	staticImages: [],
	referencedImages: new Set()
};
function postMessage(message, transfer = []) {
	const { staticImages, referencedImages } = workerCollectors;
	if (staticImages.length > 0 || referencedImages.size > 0) {
		message.buildMetadata = {
			staticImages,
			referencedImages: [...referencedImages]
		};
		workerCollectors.staticImages = [];
		workerCollectors.referencedImages = new Set();
	}
	port.postMessage(message, transfer);
}
function serialize(value) {
	try {
		return stringify(value);
	} catch {
		return undefined;
	}
}
function serializeError(error) {
	if (!(error instanceof Error)) return { message: String(error) };
	const record = error;
	return {
		message: error.message,
		name: error.name,
		stack: error.stack,
		type: typeof record.type === "string" ? record.type : undefined,
		title: typeof record.title === "string" ? record.title : undefined,
		hint: typeof record.hint === "string" ? record.hint : undefined,
		frame: typeof record.frame === "string" ? record.frame : undefined,
		loc: record.loc,
		id: typeof record.id === "string" ? record.id : undefined
	};
}
async function start() {
	const { app } = await import(data.entryUrl);
	app.setInternals({
		pagesByKeys: new Map(data.pagesByKeys),
		entrySpecifierToBundleMap: new Map(data.pageScript ? [[PAGE_SCRIPT_ID, data.pageScript]] : undefined)
	});
	app.setOptions({
		settings: {
			scripts: data.scripts,
			redirectPage: data.redirectPage
		},
		logger: { options: { destination: { write(log) {
			postMessage({
				type: "log",
				log
			});
		} } } }
	});
	const routes = new Map();
	async function discover(id) {
		const { paths, metadata } = await new StaticPaths(app).getAllWithMetadata();
		const routeIds = new Map();
		const discoveredRoutes = [];
		const discoveredPaths = paths.map(({ pathname, route, cacheKey }) => {
			let routeId = routeIds.get(route);
			if (routeId === undefined) {
				routeId = routeIds.size + 1;
				routeIds.set(route, routeId);
				routes.set(routeId, route);
				discoveredRoutes.push({
					id: routeId,
					data: JSON.stringify(serializeRouteData(route, app.manifest.trailingSlash))
				});
			}
			const staticPath = app.routeCache.get(route)?.staticPaths.keyed.get(pathname);
			return {
				pathname,
				routeId,
				cacheKey,
				staticPath: staticPath && serialize(staticPath)
			};
		});
		postMessage({
			type: "paths",
			id,
			paths: discoveredPaths,
			routes: discoveredRoutes,
			metadata
		});
	}
	async function render({ id, url, routeId, routeData, staticPath }) {
		if (routeData !== undefined) routes.set(routeId, deserializeRouteData(JSON.parse(routeData)));
		const route = routes.get(routeId);
		if (staticPath) await app.addStaticPath(route, parse(staticPath));
		const request = createRequest({
			url,
			headers: {},
			logger: app.logger,
			isPrerendered: true,
			routePattern: route.component
		});
		const { response, metadata } = await renderForPrerender(app, request, { routeData: route });
		const body = response.body === null ? null : await response.arrayBuffer();
		postMessage({
			type: "result",
			id,
			response: {
				body,
				status: response.status,
				statusText: response.statusText,
				headers: [...response.headers]
			},
			metadata
		}, body ? [body] : []);
	}
	async function handle(message) {
		try {
			if (message.type === "discover") await discover(message.id);
			else await render(message);
		} catch (error) {
			postMessage({
				type: "error",
				id: message.id,
				error: serializeError(error)
			});
		}
	}
	port.on("message", (message) => {
		void renderScope.run(workerCollectors, () => handle(message));
	});
	postMessage({ type: "ready" });
}
renderScope.run(workerCollectors, start).catch((error) => {
	postMessage({
		type: "startup-error",
		error: serializeError(error)
	});
});
