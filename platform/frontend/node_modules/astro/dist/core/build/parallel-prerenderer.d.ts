import type { AstroSettings } from '../../types/astro.js';
import type { AstroPrerenderer, PrerenderRenderMetadata, StaticPathsMetadata } from '../../types/public/integrations.js';
import type { AstroLoggerMessage } from '../logger/core.js';
import type { BuildInternals } from './internal.js';
import type { PageBuildData, StaticBuildOptions } from './types.js';
export interface ParallelPrerenderWorkerData {
    entryUrl: string;
    pagesByKeys: Array<[string, Pick<PageBuildData, 'styles'>]>;
    pageScript: string | undefined;
    scripts: AstroSettings['scripts'];
    redirectPage: boolean;
}
export interface SerializedWorkerError {
    message: string;
    name?: string;
    stack?: string;
    type?: string;
    title?: string;
    hint?: string;
    frame?: string;
    loc?: unknown;
    id?: string;
}
interface RenderWorkerRequest {
    type: 'render';
    id: number;
    url: string;
    routeId: number;
    routeData?: string;
    staticPath?: string;
}
interface DiscoverWorkerRequest {
    type: 'discover';
    id: number;
}
export type PrerenderWorkerRequest = RenderWorkerRequest | DiscoverWorkerRequest;
export interface SerializedRoute {
    id: number;
    data: string;
}
export interface DiscoveredPath {
    pathname: string;
    routeId: number;
    cacheKey?: string;
    staticPath?: string;
}
export type WorkerMessage = {
    buildMetadata?: StaticPathsMetadata;
} & ({
    type: 'ready';
} | {
    type: 'log';
    log: AstroLoggerMessage;
} | {
    type: 'startup-error';
    error: SerializedWorkerError;
} | {
    type: 'paths';
    id: number;
    paths: DiscoveredPath[];
    routes: SerializedRoute[];
    metadata?: StaticPathsMetadata;
} | {
    type: 'result';
    id: number;
    response: {
        body: ArrayBuffer | null;
        status: number;
        statusText: string;
        headers: [string, string][];
    };
    metadata?: PrerenderRenderMetadata;
} | {
    type: 'error';
    id: number;
    error: SerializedWorkerError;
});
interface ParallelPrerendererOptions {
    internals: BuildInternals;
    options: StaticBuildOptions;
    prerenderOutputDir: URL;
}
export interface ParallelPrerenderer extends AstroPrerenderer {
    workerCount: number;
    finish: () => Promise<StaticPathsMetadata>;
}
export declare function createParallelPrerenderer({ internals, options, prerenderOutputDir, }: ParallelPrerendererOptions): ParallelPrerenderer;
export {};
