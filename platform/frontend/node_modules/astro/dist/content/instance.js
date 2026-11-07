import { ContentLayer } from "./content-layer.js";
function contentLayerSingleton() {
	let instance = null;
	return {
		init: (options) => {
			instance?.dispose();
			instance = new ContentLayer(options);
			return instance;
		},
		get: () => instance,
		dispose: () => {
			instance?.dispose();
			instance = null;
		}
	};
}
export const globalContentLayer = contentLayerSingleton();
