import type { AssetsPrefix } from '../../core/app/types.js';
import type { ImageTransform, SerializedStaticImage } from '../types.js';
/** Output layout of build-time images. */
export interface StaticImageConfig {
    base: string;
    assetsPrefix?: AssetsPrefix;
    assetsDir: string;
}
export interface ResolveStaticImageOptions extends StaticImageConfig {
    serviceEntrypoint: string;
    assetQueryParams?: URLSearchParams;
}
export declare function resolveStaticImage(options: ImageTransform, hashProperties: string[], originalFSPath: string | undefined, config: ResolveStaticImageOptions): {
    url: string;
    image: SerializedStaticImage;
};
