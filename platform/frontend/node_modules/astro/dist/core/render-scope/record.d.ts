import type { SerializedStaticImage } from '../../assets/types.js';
/**
 * Records that a content entry was rendered, keyed by its root-relative
 * `filePath`. No-op outside of a collecting render (dev, production SSR,
 * module top-level).
 */
export declare function recordContentEntryRender(filePath: string | undefined): void;
export declare function isCollectingStaticImages(): boolean;
/** Keeps repeats; `collectPrerenderMetadata()` dedupes them. */
export declare function recordStaticImage(image: SerializedStaticImage): void;
/** Records an untransformed image reference against the active render. */
export declare function recordReferencedImage(fsPath: string): void;
