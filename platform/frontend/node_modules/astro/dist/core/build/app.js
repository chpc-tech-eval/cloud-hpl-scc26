import { BaseApp } from "../app/entrypoints/index.js";
import { getEnvironment } from "../environment/index.js";
import { getRouteCache } from "../render/route-cache.js";
import { stringifyParams } from "../routing/params.js";
/**
* The build / prerender facade: a thin shell over the
* build environment record. The two-phase init state (`setInternals` /
* `setOptions`, injected by `createDefaultPrerenderer.setup()` after the
* prerender bundle import) lives in the `BuildEnvironmentSlots` closure
* created by the prerender entrypoint; the facade only forwards across the
* bundle boundary into those slots.
*/
export class BuildApp extends BaseApp {
	#buildEnv;
	constructor(manifest, buildEnv) {
		super(manifest);
		this.#buildEnv = buildEnv;
	}
	isDev() {
		// Preserved quirk: the build app reports dev so shared code paths keep
		// their build-time behavior.
		return true;
	}
	/**
	* Streaming falls through to the environment default
	* (`manifest.serverLike` for the build environment) — we can skip
	* streaming in SSG for performance, as writing strings is faster.
	*/
	resolveStreaming() {
		return undefined;
	}
	setInternals(internals) {
		this.#buildEnv.setInternals(internals);
	}
	setOptions(options) {
		this.#buildEnv.setOptions(options);
		this.logger.setDestination(options.logger.options.destination);
		this.resetAdapterLogger();
	}
	getOptions() {
		return this.#buildEnv.getOptions();
	}
	getSettings() {
		return this.#buildEnv.getSettings();
	}
	/**
	* Route cache and component loader for `StaticPaths`. Defined on the app
	* (rather than reached through the functional core at the call site) so
	* they execute inside the prerender bundle's module graph: the default
	* prerenderer constructs `StaticPaths` from a different bundle, whose
	* copies of the core modules hold separate per-manifest state.
	*/
	get routeCache() {
		return getRouteCache(this.manifest);
	}
	getComponentByRoute(routeData) {
		return getEnvironment(this.manifest).getComponentByRoute(this.manifest, routeData);
	}
	async addStaticPath(routeData, item) {
		const mod = await this.getComponentByRoute(routeData);
		const key = stringifyParams(item.params, routeData, this.manifest.trailingSlash);
		const cached = this.routeCache.get(routeData);
		if (cached?.mod === mod) {
			if (cached.staticPaths.keyed.has(key)) return;
			cached.staticPaths.push(item);
			cached.staticPaths.keyed.set(key, item);
			return;
		}
		const staticPaths = Object.assign([item], { keyed: new Map([[key, item]]) });
		this.routeCache.set(routeData, {
			mod,
			staticPaths,
			partial: true
		});
	}
	logRequest(_options) {}
}
