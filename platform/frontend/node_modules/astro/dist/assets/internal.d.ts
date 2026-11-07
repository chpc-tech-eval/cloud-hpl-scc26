import type { AstroRuntimeLogger } from '../types/public/context.js';
import type { AstroAdapterClientConfig } from '../types/public/integrations.js';
import { type ImageConfig, type ImageService } from './services/service.js';
import { type GetImageResult, type UnresolvedImageTransform } from './types.js';
export { verifyOptions } from './services/service.js';
export declare const cssFitValues: string[];
export declare function getConfiguredImageService(): Promise<ImageService>;
/** Test-only: override the image service `getImage()` uses. */
export declare function setConfiguredImageService(service: ImageService | undefined): void;
export declare function getImage(options: UnresolvedImageTransform, imageConfig: ImageConfig & AstroAdapterClientConfig, logger: AstroRuntimeLogger): Promise<GetImageResult>;
