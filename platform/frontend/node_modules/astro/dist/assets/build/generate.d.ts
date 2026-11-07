import type { StaticBuildOptions } from '../../core/build/types.js';
import { type AstroLogger } from '../../core/logger/core.js';
import type { MapValue } from '../../type-utils.js';
import type { AstroConfig } from '../../types/public/config.js';
import type { ImageConfig, LocalImageService } from '../services/service.js';
import type { AssetsGlobalStaticImagesList, SerializedStaticImage } from '../types.js';
type AssetEnv = {
    logger: AstroLogger;
    getImageService: () => Promise<LocalImageService>;
    referencedImages: ReadonlySet<string>;
    isSSR: boolean;
    count: {
        total: number;
        current: number;
    };
    useCache: boolean;
    assetsCacheDir: URL;
    serverRoot: URL;
    clientRoot: URL;
    imageConfig: ImageConfig;
    assetsFolder: AstroConfig['build']['assets'];
};
export declare function prepareAssetsGenerationEnv(options: StaticBuildOptions, totalCount: number, { loadImageService, referencedImages, }: {
    loadImageService: () => Promise<LocalImageService>;
    referencedImages: ReadonlySet<string>;
}): Promise<AssetEnv>;
export declare function generateImagesForPath(originalFilePath: string, transformsAndPath: MapValue<AssetsGlobalStaticImagesList>, env: AssetEnv): Promise<void>;
export declare class StaticImageRegistry {
    readonly images: AssetsGlobalStaticImagesList;
    readonly referencedImages: Set<string>;
    addStaticImages(images: Iterable<SerializedStaticImage> | undefined): void;
    addReferencedImages(fsPaths: Iterable<string> | undefined): void;
    addMetadata(metadata: {
        staticImages?: SerializedStaticImage[];
        referencedImages?: string[];
    } | undefined): void;
    addStaticImageList(list: AssetsGlobalStaticImagesList): void;
}
export {};
