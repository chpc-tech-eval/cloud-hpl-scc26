import type { AstroLogger } from '../../../core/logger/core.js';
import type { FontResolver } from '../definitions.js';
import type { ResolvedFontFamily } from '../types.js';
/**
 * Warns about values configured for a family that its provider can't serve, eg. a weight
 * or a subset a font family does not have. We only check values that are explicitly
 * configured: defaults are handled by providers themselves.
 */
export declare function validateFamilyProperties({ family, fontResolver, logger, bold, }: {
    family: ResolvedFontFamily;
    fontResolver: FontResolver;
    logger: AstroLogger;
    bold: (input: string) => string;
}): Promise<void>;
