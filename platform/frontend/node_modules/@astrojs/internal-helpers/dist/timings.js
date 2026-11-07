// Registry-global because each package that records timings may resolve its own copy of this module.
const RECORDER_KEY = Symbol.for("astro.buildTimings");
export function getBuildTimings() {
	return globalThis[RECORDER_KEY];
}
export function setBuildTimings(recorder) {
	globalThis[RECORDER_KEY] = recorder;
}
export function recordTiming(kind, name, duration, meta) {
	getBuildTimings()?.record(kind, name, duration, meta);
}
/** Calls `fn` and reports its elapsed time to `done`, once its promise settles if it returns one. */
export function measure(fn, done) {
	const start = performance.now();
	const finish = () => done(performance.now() - start);
	let result;
	try {
		result = fn();
	} catch (err) {
		finish();
		throw err;
	}
	if (typeof result?.then === "function") {
		return Promise.resolve(result).finally(finish);
	}
	finish();
	return result;
}
export function time(kind, name, fn, meta) {
	const recorder = getBuildTimings();
	if (!recorder) return fn();
	return measure(fn, (elapsed) => recorder.record(kind, name, elapsed, meta));
}
// unified merges plugin options by attacher identity, so a plugin must map to one wrapper per name.
const wrappedPlugins = new WeakMap();
/** Attributes the time a unified plugin's transformer spends on each file to `name`. */
export function timedPlugin(kind, name, plugin) {
	if (!getBuildTimings() || typeof plugin !== "function") return plugin;
	let wrappers = wrappedPlugins.get(plugin);
	if (!wrappers) {
		wrappers = new Map();
		wrappedPlugins.set(plugin, wrappers);
	}
	const key = `${kind}:${name}`;
	const cached = wrappers.get(key);
	if (cached) return cached;
	const wrapper = function(...args) {
		const transformer = plugin.apply(this, args);
		if (typeof transformer !== "function") return transformer;
		// trough picks callback or promise style from the transformer's arity, so the wrapper must match.
		if (transformer.length >= 3) {
			return function(tree, file, next) {
				const start = performance.now();
				return transformer.call(this, tree, file, (...rest) => {
					recordTiming(kind, name, performance.now() - start);
					next(...rest);
				});
			};
		}
		return function(tree, file) {
			return time(kind, name, () => transformer.call(this, tree, file));
		};
	};
	wrappers.set(key, wrapper);
	return wrapper;
}
/** Names a unified plugin the way its package is usually spelled: `rehypeShiki` reads as `rehype-shiki`. */
export function pluggableName(pluggable, index, fallbackPrefix) {
	const entry = Array.isArray(pluggable) ? pluggable[0] : pluggable;
	if (typeof entry === "string") return entry;
	if (typeof entry === "function" && entry.name) {
		return entry.name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
	}
	return `${fallbackPrefix} #${index + 1}`;
}
export function timedPluggableList(kind, list, fallbackPrefix) {
	if (!getBuildTimings()) return list;
	return list.map((pluggable, index) => {
		const name = pluggableName(pluggable, index, fallbackPrefix);
		if (Array.isArray(pluggable)) {
			const [plugin, ...options] = pluggable;
			if (typeof plugin !== "function") return pluggable;
			return [timedPlugin(kind, name, plugin), ...options];
		}
		if (typeof pluggable !== "function") return pluggable;
		return timedPlugin(kind, name, pluggable);
	});
}
// Denied rather than allow-listed, so node types added later are still measured.
const VISITOR_NON_SUBSCRIPTION_KEYS = new Set(["name", "options"]);
function timedVisitFn(kind, name, visit) {
	return function(node, ctx) {
		return time(kind, name, () => visit.call(this, node, ctx));
	};
}
function timedVisitor(kind, name, subscription) {
	if (Array.isArray(subscription)) {
		return subscription.map((entry) => timedVisitor(kind, name, entry));
	}
	if (typeof subscription === "function") return timedVisitFn(kind, name, subscription);
	if (typeof subscription?.visit === "function") {
		return {
			...subscription,
			visit: timedVisitFn(kind, name, subscription.visit)
		};
	}
	return subscription;
}
function timedVisitorPlugin(kind, entry) {
	if (Array.isArray(entry)) return entry.map((child) => timedVisitorPlugin(kind, child));
	// A function is a factory that yields the actual entry once per compile.
	if (typeof entry === "function") return (ctx) => timedVisitorPlugin(kind, entry(ctx));
	if (!entry || typeof entry !== "object") return entry;
	// Copying a class instance would drop its prototype methods.
	const prototype = Object.getPrototypeOf(entry);
	if (prototype !== Object.prototype && prototype !== null) return entry;
	const name = typeof entry.name === "string" ? entry.name : "plugin";
	const wrapped = { ...entry };
	for (const key of Object.keys(entry)) {
		if (VISITOR_NON_SUBSCRIPTION_KEYS.has(key)) continue;
		wrapped[key] = timedVisitor(kind, name, entry[key]);
	}
	return wrapped;
}
/** Attributes the time a Sätteri mdast/hast plugin spends in its visitors to its own name. */
export function timedVisitorPlugins(kind, entries) {
	if (!getBuildTimings()) return entries;
	return entries.map((entry) => timedVisitorPlugin(kind, entry));
}
