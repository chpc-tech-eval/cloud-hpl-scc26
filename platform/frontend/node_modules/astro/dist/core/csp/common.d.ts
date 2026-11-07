import type { AstroSettings } from '../../types/astro.js';
import type { AstroConfig, CspAlgorithm } from '../../types/public/index.js';
import type { BuildInternals } from '../build/internal.js';
import type { CspDirective, CspHash, CspHashEntry, CspResourceEntry } from './config.js';
type EnabledCsp = Exclude<AstroConfig['security']['csp'], false>;
export declare function shouldTrackCspHashes(csp: any): csp is EnabledCsp;
export declare function getAlgorithm(csp: EnabledCsp): CspAlgorithm;
export declare function getScriptResources(csp: EnabledCsp): CspResourceEntry[];
export declare function getScriptHashes(csp: EnabledCsp): CspHashEntry[];
export declare function getStyleResources(csp: EnabledCsp): CspResourceEntry[];
export declare function getStyleHashes(csp: EnabledCsp): CspHashEntry[];
export declare function getDirectives(settings: AstroSettings): CspDirective[];
export declare function getStrictDynamic(csp: EnabledCsp): boolean;
interface TrackCspHashesOptions {
    internals: BuildInternals;
    settings: AstroSettings;
    algorithm: CspAlgorithm;
    clientRoot: URL;
}
export declare function trackStyleHashes({ internals, settings, algorithm, clientRoot, }: TrackCspHashesOptions): Promise<CspHash[]>;
export declare function trackScriptHashes({ internals, settings, algorithm, clientRoot, }: TrackCspHashesOptions): Promise<CspHash[]>;
export {};
