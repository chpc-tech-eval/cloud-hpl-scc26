/**
* The channel is a write-once immutable *conduit* shared so every compiled copy
* of this module resolves the same AsyncLocalStorage instance (the prerender
* runtime is bundled, so the build orchestrator and the bundled runtime hold
* different module instances of this file); all mutable per-render state lives
* in stores reachable only through async execution context. Never installed in
* dev or production SSR runtimes. It holds no state, so it stays installed across builds.
*/
const SCOPE_KEY = Symbol.for("astro:render-scope");
/**
* Installs a render scope on the process-wide channel and returns the installed
* scope. First-wins: when a scope is already installed (possibly by another
* module instance), the existing scope is returned and the argument discarded,
* so callers that both awaited an import converge on one scope.
*/
export function installRenderScope(scope) {
	const host = globalThis;
	const existing = host[SCOPE_KEY];
	if (existing) return existing;
	Object.defineProperty(host, SCOPE_KEY, {
		value: scope,
		configurable: true,
		writable: false,
		enumerable: false
	});
	return scope;
}
/** The installed render scope, or `undefined` when none was installed. */
export function getInstalledRenderScope() {
	return globalThis[SCOPE_KEY];
}
/** Test-only: remove the installed scope so unit tests can reset the channel. */
export function uninstallRenderScope() {
	delete globalThis[SCOPE_KEY];
}
/** The current render's collectors store, or `undefined` when not collecting. */
export function getRenderCollectors() {
	return getInstalledRenderScope()?.getStore();
}
