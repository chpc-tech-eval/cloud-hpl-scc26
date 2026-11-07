import type { BuildTimingsRecorder } from '@astrojs/internal-helpers/timings';
export declare const ACTIVITY_BUCKETS = 22;
export interface TimingSpan {
    id: number;
    parentId: number | null;
    name: string;
    start: number;
    duration: number;
}
export interface WallStat {
    name: string;
    /** Wall-clock time, with overlapping calls counted once. */
    total: number;
    calls: number;
    /** Busy fraction for each equal slice of the build. */
    activity: number[];
}
interface GroupedWallStat extends WallStat {
    children: WallStat[];
}
interface DurationRecord {
    name: string;
    duration: number;
}
interface PageRecord extends DurationRecord {
    route: string;
    cached: boolean;
}
interface ImageRecord extends DurationRecord {
    cached: boolean;
}
interface TimingsSection<T> {
    entries: T[];
    count: number;
    /** Wall-clock time spent in this section, with overlapping work counted once. */
    wallDuration: number;
}
export interface BuildTimingsData {
    root: string;
    output: string;
    totalDuration: number;
    spans: TimingSpan[];
    /** Children are the plugin's hooks. */
    plugins: TimingsSection<GroupedWallStat>;
    /** Children are the plugins that loaded or transformed the module. */
    modules: TimingsSection<GroupedWallStat>;
    /** Children are the integration's hooks. */
    integrations: GroupedWallStat[];
    pages: TimingsSection<PageRecord> & {
        cached: number;
        median: number;
        p95: number;
        /** Time inside the prerenderer, as opposed to the pipeline that writes its output. */
        renderDuration: number;
        renderActivity: number[];
    };
    images: TimingsSection<ImageRecord> & {
        cached: number;
    };
    markdown: {
        plugins: (WallStat & {
            pipeline: 'markdown' | 'mdx';
        })[];
        files: number;
        wallDuration: number;
    };
    highlight: TimingsSection<WallStat> & {
        blocks: number;
    };
    compiler: TimingsSection<DurationRecord>;
}
interface BuildContext {
    root: string;
    output: string;
}
export declare class BuildTimingsCollector implements BuildTimingsRecorder {
    private readonly origin;
    private readonly spans;
    private readonly currentSpan;
    private readonly plugins;
    private readonly modules;
    private readonly integrations;
    private readonly markdownPlugins;
    private readonly mdxPlugins;
    private readonly languages;
    private readonly pages;
    private readonly images;
    private readonly compiledFiles;
    private markdownFiles;
    private readonly pluginWall;
    private readonly moduleWall;
    private readonly pageWall;
    private readonly pageRenderWall;
    private readonly imageWall;
    private readonly markdownWall;
    private readonly compilerWall;
    private readonly highlightWall;
    span<T>(name: string, fn: () => Promise<T>): Promise<T>;
    record(kind: string, name: string, duration: number, meta?: Record<string, any>): void;
    toData(context: BuildContext): BuildTimingsData;
}
export {};
