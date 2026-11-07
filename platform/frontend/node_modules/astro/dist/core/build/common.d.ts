import type { AstroConfig } from '../../types/public/config.js';
import type { RouteData, RouteType } from '../../types/public/internal.js';
export declare function pathToDirectoryURL(path: string): URL;
export declare function getOutFolder({ outRoot, buildFormat, pathname, routeData, }: {
    outRoot: URL;
    buildFormat: NonNullable<AstroConfig['build']>['format'];
    pathname: string;
    routeData: RouteData;
}): URL;
export declare function getOutFile(buildFormat: NonNullable<AstroConfig['build']>['format'], outFolder: URL, pathname: string, routeData: RouteData): URL;
/**
 * Ensures the `outDir` is within `process.cwd()`. If not it will fall back to `<cwd>/.astro`.
 * This is used for static `ssrBuild` so the output can access node_modules when we import
 * the output files. A hardcoded fallback dir is fine as it would be cleaned up after build.
 */
export declare function getOutDirWithinCwd(outDir: URL): URL;
export declare function getUrlForPath(pathname: string, base: string, origin: string, format: AstroConfig['build']['format'], trailingSlash: AstroConfig['trailingSlash'], routeType: RouteType, isIndex: boolean): URL;
