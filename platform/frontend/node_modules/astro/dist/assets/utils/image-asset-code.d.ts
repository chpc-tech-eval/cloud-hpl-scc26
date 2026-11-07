import type { JavaScriptFragment, JavaScriptTag } from 'devalue';
import type { ImageMetadata } from '../types.js';
export declare const IMAGE_ASSET_IMPORT = "import { createImageAsset as __astro_createImageAsset } from \"astro/assets/image-asset\";";
export declare function getImageAssetCode(js: JavaScriptTag, metadata: Omit<ImageMetadata, 'fsPath'>, fsPath: string, track: boolean): JavaScriptFragment;
export declare function getImageAssetModule(metadata: Omit<ImageMetadata, 'fsPath'>, fsPath: string, track: boolean): string;
