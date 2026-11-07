import os from "node:os";
import { Worker } from "node:worker_threads";
import { PAGE_SCRIPT_ID } from "../../vite-plugin-scripts/index.js";
import { deserializeRouteData } from "../app/manifest.js";
import { getUrlForPath } from "./common.js";
function resolveParallelPrerenderWorkers(parallelPrerender) {
	if (typeof parallelPrerender === "object" && parallelPrerender.workers !== undefined) {
		return parallelPrerender.workers;
	}
	return Math.max(1, os.availableParallelism() - 1);
}
function deserializeError(serialized) {
	return Object.assign(new Error(serialized.message), serialized);
}
class PrerenderWorkerPool {
	#workers = [];
	#queue = [];
	#inFlight = new Map();
	#nextRequestId = 1;
	#routes = new WeakMap();
	#staticPathsByRequest = new Map();
	#closing = false;
	#buildMetadata = {
		staticImages: [],
		referencedImages: []
	};
	#workerConcurrency;
	#workerData;
	#options;
	constructor(workerConcurrency, workerData, options) {
		this.#workerConcurrency = workerConcurrency;
		this.#workerData = workerData;
		this.#options = options;
	}
	get buildMetadata() {
		return {
			staticImages: this.#buildMetadata.staticImages,
			referencedImages: [...new Set(this.#buildMetadata.referencedImages)]
		};
	}
	async start(workerCount) {
		try {
			await Promise.all(Array.from({ length: workerCount }, () => this.#startWorker()));
		} catch (error) {
			await this.close();
			throw error;
		}
	}
	async getStaticPaths() {
		const discoveryWorker = this.#workers[0];
		const result = await this.#send(discoveryWorker, { type: "discover" });
		if (result.type !== "paths") throw new Error(`Unexpected worker message: ${result.type}`);
		const routes = new Map();
		for (const serialized of result.routes) {
			const route = deserializeRouteData(JSON.parse(serialized.data));
			routes.set(serialized.id, route);
			this.#routes.set(route, serialized);
			discoveryWorker.knownRouteIds.add(serialized.id);
		}
		const { config } = this.#options.settings;
		const paths = result.paths.map((path) => {
			const route = routes.get(path.routeId);
			if (path.staticPath) {
				const url = getUrlForPath(path.pathname, config.base, this.#options.origin, config.build.format, config.trailingSlash, route.type, route.isIndex);
				this.#staticPathsByRequest.set(`${path.routeId}:${url.href}`, path.staticPath);
			}
			return {
				pathname: path.pathname,
				route,
				cacheKey: path.cacheKey
			};
		});
		return {
			paths,
			metadata: result.metadata
		};
	}
	render(request, routeData) {
		const route = this.#routes.get(routeData);
		if (!route) {
			return Promise.reject(new Error(`Route ${routeData.route} was not returned by getStaticPaths()`));
		}
		const key = `${route.id}:${request.url}`;
		const staticPath = this.#staticPathsByRequest.get(key);
		this.#staticPathsByRequest.delete(key);
		return new Promise((resolve, reject) => {
			this.#queue.push({
				url: request.url,
				route,
				staticPath,
				discoveryWorkerOnly: !routeData.pathname && !staticPath,
				resolve,
				reject
			});
			this.#pump();
		});
	}
	async close() {
		this.#closing = true;
		const error = new Error("The parallel prerender worker pool was closed");
		for (const job of this.#queue.splice(0)) job.reject(error);
		for (const request of this.#inFlight.values()) request.reject(error);
		this.#inFlight.clear();
		await Promise.all(this.#workers.map(({ worker }) => worker.terminate()));
		this.#workers = [];
	}
	async #startWorker() {
		const worker = new Worker(new URL("./prerender-worker.js", import.meta.url), { workerData: this.#workerData });
		const state = {
			worker,
			failed: false,
			active: 0,
			knownRouteIds: new Set()
		};
		this.#workers.push(state);
		await new Promise((resolve, reject) => {
			worker.on("message", (message) => {
				this.#addBuildMetadata(message.buildMetadata);
				switch (message.type) {
					case "ready":
						resolve();
						return;
					case "startup-error":
						state.failed = true;
						reject(deserializeError(message.error));
						return;
					case "log":
						this.#options.logger.options.destination.write(message.log);
						return;
					case "paths":
					case "result":
					case "error": this.#settle(state, message);
				}
			});
			worker.on("error", (error) => {
				reject(error);
				this.#failWorker(state, error);
			});
			worker.on("exit", (code) => {
				const error = new Error(`Parallel prerender worker exited unexpectedly with code ${code}`);
				reject(error);
				if (!this.#closing) this.#failWorker(state, error);
			});
		});
	}
	#settle(state, message) {
		const request = this.#inFlight.get(message.id);
		if (!request) return;
		this.#inFlight.delete(message.id);
		state.active--;
		if (message.type === "error") request.reject(deserializeError(message.error));
		else request.resolve(message);
		this.#pump();
	}
	#send(state, request) {
		const id = this.#nextRequestId++;
		return new Promise((resolve, reject) => {
			state.worker.postMessage({
				...request,
				id
			});
			state.active++;
			this.#inFlight.set(id, {
				worker: state,
				resolve,
				reject
			});
		});
	}
	#addBuildMetadata(metadata) {
		if (metadata?.staticImages) this.#buildMetadata.staticImages.push(...metadata.staticImages);
		if (metadata?.referencedImages) {
			this.#buildMetadata.referencedImages.push(...metadata.referencedImages);
		}
	}
	#failWorker(state, error) {
		if (state.failed) return;
		state.failed = true;
		for (const [id, request] of this.#inFlight) {
			if (request.worker !== state) continue;
			this.#inFlight.delete(id);
			request.reject(error);
		}
		const discoveryWorkerFailed = state === this.#workers[0];
		const allFailed = this.#workers.every((worker) => worker.failed);
		this.#queue = this.#queue.filter((job) => {
			if (!allFailed && !(discoveryWorkerFailed && job.discoveryWorkerOnly)) return true;
			job.reject(error);
			return false;
		});
		this.#pump();
	}
	#pump() {
		if (this.#closing) return;
		this.#queue = this.#queue.filter((job) => {
			const state = this.#pickWorker(job);
			if (!state) return true;
			this.#assign(state, job);
			return false;
		});
	}
	#pickWorker(job) {
		const [discoveryWorker, ...renderWorkers] = this.#workers;
		const available = (state) => !state.failed && state.active < this.#workerConcurrency;
		if (!job.discoveryWorkerOnly) {
			let best;
			for (const state of renderWorkers) {
				if (available(state) && (!best || state.active < best.active)) best = state;
			}
			if (best) return best;
		}
		return available(discoveryWorker) ? discoveryWorker : undefined;
	}
	#assign(state, job) {
		const isDiscoveryWorker = state === this.#workers[0];
		const request = {
			type: "render",
			url: job.url,
			routeId: job.route.id,
			routeData: state.knownRouteIds.has(job.route.id) ? undefined : job.route.data,
			// The discovery worker already holds every item in its route cache.
			staticPath: isDiscoveryWorker ? undefined : job.staticPath
		};
		state.knownRouteIds.add(job.route.id);
		this.#send(state, request).then((message) => {
			if (message.type !== "result") throw new Error(`Unexpected worker message: ${message.type}`);
			const { body, ...init } = message.response;
			job.resolve({
				response: new Response(body, init),
				metadata: message.metadata
			});
		}).catch(job.reject);
	}
}
export function createParallelPrerenderer({ internals, options, prerenderOutputDir }) {
	const { config } = options.settings;
	const workerCount = resolveParallelPrerenderWorkers(config.experimental.parallelPrerender);
	let pool;
	return {
		name: "astro:parallel",
		workerCount,
		async setup() {
			pool = new PrerenderWorkerPool(config.build.concurrency, {
				entryUrl: new URL(internals.prerenderEntryFileName, prerenderOutputDir).toString(),
				pagesByKeys: [...internals.pagesByKeys].map(([key, page]) => [key, { styles: page.styles }]),
				pageScript: internals.entrySpecifierToBundleMap.get(PAGE_SCRIPT_ID),
				scripts: options.settings.scripts,
				redirectPage: config.experimental.redirectPage
			}, options);
			await pool.start(workerCount);
		},
		getStaticPaths() {
			return pool.getStaticPaths();
		},
		render(request, { routeData }) {
			return pool.render(request, routeData);
		},
		async finish() {
			if (!pool) return {
				staticImages: [],
				referencedImages: []
			};
			await pool.close();
			return pool.buildMetadata;
		},
		async teardown() {
			await pool?.close();
		}
	};
}
