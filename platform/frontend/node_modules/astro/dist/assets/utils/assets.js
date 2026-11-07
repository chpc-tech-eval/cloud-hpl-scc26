// WeakMap keyed by Environment objects to track emitted asset handles
// Using WeakMap ensures automatic cleanup when environments are garbage collected
const assetHandlesByEnvironment = new WeakMap();
/**
* Gets or creates the handle set for an environment
*/
export function getHandles(env) {
	let handles = assetHandlesByEnvironment.get(env);
	if (!handles) {
		handles = new Set();
		assetHandlesByEnvironment.set(env, handles);
	}
	return handles;
}
/**
* Resets the handle tracking for an environment.
* Called at the start of each build.
*/
export function resetHandles(env) {
	assetHandlesByEnvironment.set(env, new Set());
}
/**
* Emit a client asset and track it for later movement to the client directory.
* Use this instead of pluginContext.emitFile for assets that should
* be moved from the server/prerender directory to the client directory.
*
* Note: The pluginContext is typed as Rolldown.PluginContext for compatibility
* with content entry types, but in practice it will always have the `environment`
* property when running in Vite.
*/
export function emitClientAsset(pluginContext, options) {
	const env = pluginContext.environment;
	const handle = pluginContext.emitFile(options);
	const handles = getHandles(env);
	handles.add(handle);
	return handle;
}
export const ASSETS_ESM_PLUGIN_NAME = "astro:assets:esm";
export function getAssetsPluginApi(plugins) {
	return plugins?.find((plugin) => plugin.name === ASSETS_ESM_PLUGIN_NAME)?.api;
}
/** Keeps an image's original file in the build output, as if its `src` had been read. */
export function markImageReferenced(pluginContext, fsPath) {
	const env = pluginContext.environment;
	getAssetsPluginApi(env?.config.plugins)?.markReferenced(fsPath);
}
