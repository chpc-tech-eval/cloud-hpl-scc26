export const IMAGE_ASSET_IMPORT = `import { createImageAsset as __astro_createImageAsset } from "astro/assets/image-asset";`;
// Callers must also emit IMAGE_ASSET_IMPORT.
export function getImageAssetCode(js, metadata, fsPath, track) {
	return js`__astro_createImageAsset(${metadata}, ${fsPath}, ${track})`;
}
export function getImageAssetModule(metadata, fsPath, track) {
	return `${IMAGE_ASSET_IMPORT}\nexport default __astro_createImageAsset(${JSON.stringify(metadata)}, ${JSON.stringify(fsPath)}, ${track});`;
}
