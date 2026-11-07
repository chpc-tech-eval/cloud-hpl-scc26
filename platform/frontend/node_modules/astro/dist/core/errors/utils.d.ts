import type { YAMLParseError } from '@astrojs/internal-helpers/yaml';
import type { TomlError } from 'smol-toml';
import type { ErrorPayload as ViteErrorPayload } from 'vite';
export { isYAMLParseError } from '@astrojs/internal-helpers/yaml-error';
/**
 * Get the line and character based on the offset
 * @param offset The index of the position
 * @param text The text for which the position should be retrieved
 */
export declare function positionAt(offset: number, text: string): {
    line: number;
    column: number;
};
/** Format YAML exceptions as Vite errors */
export declare function formatYAMLParseError(e: YAMLParseError): ViteErrorPayload['err'];
export declare function isTOMLError(err: unknown): err is TomlError;
/** Format TOML exceptions as Vite errors */
export declare function formatTOMLError(e: TomlError): ViteErrorPayload['err'];
/** Coalesce any throw variable to an Error instance. */
export declare function createSafeError(err: any): Error;
export declare function normalizeLF(code: string): string;
