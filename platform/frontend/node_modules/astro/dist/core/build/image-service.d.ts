import type * as vite from 'vite';
import { type LocalImageService } from '../../assets/services/service.js';
import type { AstroSettings } from '../../types/astro.js';
export declare function getImageServiceEnvironmentOptions(settings: AstroSettings): vite.EnvironmentOptions;
export declare function pluginImageServiceEntry(): vite.Plugin;
export declare function loadBuildImageService(builder: vite.ViteBuilder, settings: AstroSettings): Promise<LocalImageService>;
