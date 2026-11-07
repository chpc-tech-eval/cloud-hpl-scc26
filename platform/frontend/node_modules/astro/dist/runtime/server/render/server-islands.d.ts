import type { SSRResult } from '../../../types/public/internal.js';
import { type ThinHead } from './astro/head-and-content.js';
import type { RenderDestination } from './common.js';
import { type ComponentSlots } from './slot.js';
export declare function containsServerDirective(props: Record<string | number, any>): boolean;
export declare class ServerIslandComponent {
    result: SSRResult;
    props: Record<string | number, any>;
    slots: ComponentSlots;
    displayName: string;
    hostId: string | undefined;
    islandContent: string | undefined;
    componentPath: string | undefined;
    componentExport: string | undefined;
    componentId: string | undefined;
    private initPromise;
    constructor(result: SSRResult, props: Record<string | number, any>, slots: ComponentSlots, displayName: string);
    /**
     * Pre-renders the island slots and records its CSP script hashes. Runs once;
     * later calls (every head-collection pass revisits all propagators) return
     * the first result.
     */
    init(): Promise<ThinHead>;
    private initImpl;
    render(destination: RenderDestination): Promise<void>;
    getComponentPath(): string;
    getComponentExport(): string;
    getHostId(): Promise<string>;
    getIslandContent(): Promise<string>;
}
export declare const renderServerIslandRuntime: () => string;
