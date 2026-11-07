import { createSatteriMdxProcessor } from "./mdx/create-processor.js";
import { createSatteriMarkdownProcessor } from "./satteri-processor.js";
/**
* Use the Sätteri Markdown processor for `markdown.processor`. Extend the pipeline
* with mdast or hast plugins, or toggle Markdown features.
*
* ```js
* import { satteri } from '@astrojs/markdown-satteri';
*
* export default defineConfig({
*   markdown: {
*     processor: satteri({ features: { directive: true } }),
*   },
* });
* ```
*/
export function satteri(opts = {}) {
	const processor = {
		name: "satteri",
		options: {
			mdastPlugins: [...opts.mdastPlugins ?? []],
			hastPlugins: [...opts.hastPlugins ?? []],
			// Default to `{}` so integrations can write `options.features.gfm = false`
			// without an `??=` check.
			features: { ...opts.features }
		},
		createRenderer(shared) {
			return createSatteriMarkdownProcessor({
				...shared,
				mdastPlugins: processor.options.mdastPlugins,
				hastPlugins: processor.options.hastPlugins,
				features: processor.options.features
			});
		},
		async createMdxRenderer(shared, mdx) {
			return createSatteriMdxProcessor(shared, mdx, processor.options);
		}
	};
	return processor;
}
export function isSatteriProcessor(p) {
	return p.name === "satteri";
}
