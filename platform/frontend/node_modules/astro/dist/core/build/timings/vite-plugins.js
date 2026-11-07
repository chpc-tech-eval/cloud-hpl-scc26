import { measure, recordTiming } from "@astrojs/internal-helpers/timings";
const PLUGIN_NAME = "astro:build-timings";
// Environments share plugin objects, so a plugin may be seen once per environment.
const instrumented = new WeakSet();
const TIMED_HOOKS = [
	"resolveId",
	"load",
	"transform",
	"renderChunk",
	"generateBundle",
	"writeBundle",
	"buildStart",
	"buildEnd",
	"closeBundle"
];
const MODULE_ID_ARGUMENT = {
	load: 0,
	transform: 1
};
/** Context methods that run other plugins' hooks, whose time belongs to those plugins. */
const DELEGATING_CONTEXT_METHODS = ["resolve", "load"];
/** Wall-clock time during which at least one delegated call was in flight, so parallel calls count once. */
class DelegatedTime {
	inFlight = 0;
	since = 0;
	total = 0;
	track(fn) {
		if (this.inFlight++ === 0) this.since = performance.now();
		return measure(fn, () => {
			if (--this.inFlight === 0) this.total += performance.now() - this.since;
		});
	}
}
function withDelegationTracking(context, delegated) {
	if (!context || typeof context !== "object") return context;
	let tracked;
	for (const method of DELEGATING_CONTEXT_METHODS) {
		const original = context[method];
		if (typeof original !== "function") continue;
		tracked ??= Object.create(context);
		tracked[method] = (...args) => delegated.track(() => original.apply(context, args));
	}
	return tracked ?? context;
}
function timeHook(pluginName, hookName, handler) {
	const moduleIdArgument = MODULE_ID_ARGUMENT[hookName];
	return function(...args) {
		const moduleId = moduleIdArgument === undefined ? undefined : args[moduleIdArgument];
		const delegated = new DelegatedTime();
		const context = withDelegationTracking(this, delegated);
		return measure(() => handler.apply(context, args), (elapsed) => recordTiming("vite-hook", pluginName, Math.max(elapsed - delegated.total, 0), {
			hook: hookName,
			module: typeof moduleId === "string" ? moduleId : undefined
		}));
	};
}
function instrumentPlugin(plugin) {
	if (instrumented.has(plugin) || Object.isFrozen(plugin)) return;
	instrumented.add(plugin);
	const target = plugin;
	for (const hookName of TIMED_HOOKS) {
		const hook = target[hookName];
		try {
			if (typeof hook === "function") {
				target[hookName] = timeHook(plugin.name, hookName, hook);
			} else if (typeof hook?.handler === "function") {
				target[hookName] = {
					...hook,
					handler: timeHook(plugin.name, hookName, hook.handler)
				};
			}
		} catch {}
	}
}
/** Attributes hook time per plugin, per hook and, for `load` and `transform`, per module. */
export function buildTimingsPlugin() {
	return {
		name: PLUGIN_NAME,
		configResolved(config) {
			for (const plugin of config.plugins) {
				if (plugin.name !== PLUGIN_NAME) instrumentPlugin(plugin);
			}
		}
	};
}
