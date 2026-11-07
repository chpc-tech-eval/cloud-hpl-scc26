import type { ImageServiceConfig, ImageServiceTargets } from '../../types/public/config.js';
import type { ImageConfig } from '../services/service.js';
export declare function getImageServiceConfig(service: ImageServiceConfig | ImageServiceTargets, target: 'build' | 'runtime'): ImageConfig['service'];
