import { type Plugin } from 'vite';
import type { EnvLoader } from './env-loader.js';
interface EnvPluginOptions {
    envLoader: EnvLoader;
}
export declare function importMetaEnv({ envLoader }: EnvPluginOptions): Plugin;
export {};
