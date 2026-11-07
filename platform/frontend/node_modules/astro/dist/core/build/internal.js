import { prependForwardSlash, removeFileExtension } from "../path.js";
import { viteID } from "../util.js";
/**
* Creates internal maps used to coordinate the CSS and HTML plugins.
* @returns {BuildInternals}
*/
export function createBuildInternals() {
	return {
		clientInput: new Set(),
		cssModuleToChunkIdMap: new Map(),
		prerenderCssAssetByModuleKey: new Map(),
		inlinedScripts: new Map(),
		entrySpecifierToBundleMap: new Map(),
		prerenderOnlyEntrySpecifiers: new Set(),
		pagesByKeys: new Map(),
		pagesByViteID: new Map(),
		pagesByClientOnly: new Map(),
		pagesByScriptId: new Map(),
		pagesByHydratedComponent: new Map(),
		propagatedStylesMap: new Map(),
		discoveredHydratedComponents: new Map(),
		discoveredClientOnlyComponents: new Map(),
		discoveredScripts: new Set(),
		staticFiles: new Set(),
		componentMetadata: new Map(),
		astroActionsEntryPoint: undefined,
		middlewareEntryPoint: undefined,
		loggerEntryPoint: undefined,
		clientChunksAndAssets: new Set(),
		ssrAssetsPerEnvironment: new Map()
	};
}
/**
* Gets or creates the set of SSR assets for a given environment.
* Handles type casting from Vite's string environment name to AstroEnvironmentNames.
*/
export function getOrCreateSSRAssets(internals, envName) {
	const key = envName;
	let assets = internals.ssrAssetsPerEnvironment.get(key);
	if (!assets) {
		assets = new Set();
		internals.ssrAssetsPerEnvironment.set(key, assets);
	}
	return assets;
}
/**
* Gets the set of SSR assets for a given environment, or an empty set if none exist.
*/
export function getSSRAssets(internals, envName) {
	return internals.ssrAssetsPerEnvironment.get(envName) ?? new Set();
}
export function trackPageData(internals, _component, pageData, componentModuleId, componentURL) {
	pageData.moduleSpecifier = componentModuleId;
	internals.pagesByKeys.set(pageData.key, pageData);
	internals.pagesByViteID.set(viteID(componentURL), pageData);
}
/**
* Tracks client-only components to the pages they are associated with.
*/
export function trackClientOnlyPageDatas(internals, pageData, clientOnlys) {
	for (const clientOnlyComponent of clientOnlys) {
		let pageDataSet;
		// clientOnlyComponent will be similar to `/@fs{moduleID}`
		if (internals.pagesByClientOnly.has(clientOnlyComponent)) {
			pageDataSet = internals.pagesByClientOnly.get(clientOnlyComponent);
		} else {
			pageDataSet = new Set();
			internals.pagesByClientOnly.set(clientOnlyComponent, pageDataSet);
		}
		pageDataSet.add(pageData);
	}
}
/**
* Tracks scripts to the pages they are associated with.
*/
export function trackScriptPageDatas(internals, pageData, scriptIds) {
	for (const scriptId of scriptIds) {
		let pageDataSet;
		if (internals.pagesByScriptId.has(scriptId)) {
			pageDataSet = internals.pagesByScriptId.get(scriptId);
		} else {
			pageDataSet = new Set();
			internals.pagesByScriptId.set(scriptId, pageDataSet);
		}
		pageDataSet.add(pageData);
	}
}
/**
* Tracks hydrated components to the pages they are associated with.
*/
export function trackHydratedComponentPageDatas(internals, pageData, hydratedComponents) {
	for (const hydratedComponent of hydratedComponents) {
		let pageDataSet;
		if (internals.pagesByHydratedComponent.has(hydratedComponent)) {
			pageDataSet = internals.pagesByHydratedComponent.get(hydratedComponent);
		} else {
			pageDataSet = new Set();
			internals.pagesByHydratedComponent.set(hydratedComponent, pageDataSet);
		}
		pageDataSet.add(pageData);
	}
}
export function* getPageDatasByClientOnlyID(internals, viteid) {
	const pagesByClientOnly = internals.pagesByClientOnly;
	if (pagesByClientOnly.size) {
		// 1. Try the viteid
		let pageBuildDatas = pagesByClientOnly.get(viteid);
		// 2. Try prepending /@fs
		if (!pageBuildDatas) {
			let pathname = `/@fs${prependForwardSlash(viteid)}`;
			pageBuildDatas = pagesByClientOnly.get(pathname);
		}
		// 3. Remove the file extension
		// BUG! The compiler partially resolves .jsx to remove the file extension so we have to check again.
		// We should probably get rid of all `@fs` usage and always fully resolve via Vite,
		// but this would be a bigger change.
		if (!pageBuildDatas) {
			let pathname = `/@fs${prependForwardSlash(removeFileExtension(viteid))}`;
			pageBuildDatas = pagesByClientOnly.get(pathname);
		}
		if (pageBuildDatas) {
			for (const pageData of pageBuildDatas) {
				yield pageData;
			}
		}
	}
}
export function getPageDataByViteID(internals, viteid) {
	if (internals.pagesByViteID.has(viteid)) {
		return internals.pagesByViteID.get(viteid);
	}
	return undefined;
}
export function hasPrerenderedPages(internals) {
	for (const pageData of internals.pagesByKeys.values()) {
		if (pageData.route.prerender) {
			return true;
		}
	}
	return false;
}
