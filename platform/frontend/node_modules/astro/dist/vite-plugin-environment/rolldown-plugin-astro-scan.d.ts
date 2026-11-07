import type { Plugin } from 'vite';
/**
 * Replaces Vite's regex-based `.astro` dependency scan with the scripts the Astro compiler hoists,
 * which are the same scripts `vite-plugin-astro` serves as `?astro&type=script` modules. Markup-like
 * text in frontmatter or template expressions is never mistaken for a script, and scripts Astro
 * renders inline (`is:inline`, or any attribute other than `src`) are not scanned.
 *
 * @see https://github.com/withastro/astro/issues/18068
 */
export declare function rolldownAstroClientScanPlugin(): Plugin;
