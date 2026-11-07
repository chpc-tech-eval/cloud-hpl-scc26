import { extname } from "node:path";
import { getAssetsPrefix } from "../assets/utils/getAssetsPrefix.js";
import { createContentDataIncrementalMetadata } from "../core/build/incremental-metadata.js";
import { fileExtension } from "../core/path.js";
import { fileURLToPath } from "node:url";
import { isRunnableDevEnvironment } from "vite";
import { AstroError, AstroErrorData } from "../core/errors/index.js";
import { isMarkdownFile, wrapId } from "../core/util.js";
import { isBuildableCSSRequest } from "../vite-plugin-astro-server/util.js";
import { crawlGraph } from "../vite-plugin-astro-server/vite.js";
import { CONTENT_IMAGE_FLAG, CONTENT_RENDER_FLAG, LINKS_PLACEHOLDER, MARKDOWN_CONTENT_ENTRY_FLAG, PROPAGATED_ASSET_FLAG, STYLES_PLACEHOLDER } from "./consts.js";
import { hasContentFlag } from "./utils.js";
import { joinPaths, prependForwardSlash, slash } from "@astrojs/internal-helpers/path";
import { ASTRO_VITE_ENVIRONMENT_NAMES } from "../core/constants.js";
import { isAstroServerEnvironment } from "../environments.js";
export function astroContentAssetPropagationPlugin({ settings, cssContentCache }) {
	let environment = undefined;
	return {
		name: "astro:content-asset-propagation",
		enforce: "pre",
		resolveId: {
			filter: { id: new RegExp(`(?:\\?|&)(?:${CONTENT_IMAGE_FLAG}|${CONTENT_RENDER_FLAG})(?:&|=|$)`) },
			async handler(id, importer, opts) {
				if (hasContentFlag(id, CONTENT_IMAGE_FLAG)) {
					const [base, query] = id.split("?");
					const params = new URLSearchParams(query);
					const importerParam = params.get("importer");
					const importerPath = importerParam ? fileURLToPath(new URL(importerParam, settings.config.root)) : importer;
					const resolved = await this.resolve(base, importerPath, {
						skipSelf: true,
						...opts
					});
					if (!resolved) {
						throw new AstroError({
							...AstroErrorData.ImageNotFound,
							message: AstroErrorData.ImageNotFound.message(base)
						});
					}
					// Preserve the content image flag in the resolved ID so that downstream plugins
					// (e.g. astro:assets:esm) can detect content collection images and avoid creating
					// full SVG components, which would import from the server runtime and cause a
					// circular module dependency deadlock when combined with top-level await (TLA).
					resolved.id = `${resolved.id}?${CONTENT_IMAGE_FLAG}`;
					return resolved;
				}
				if (hasContentFlag(id, CONTENT_RENDER_FLAG)) {
					const base = id.split("?")[0];
					for (const { extensions, handlePropagation = true } of settings.contentEntryTypes) {
						if (handlePropagation && extensions.includes(extname(base))) {
							return this.resolve(`${base}?${PROPAGATED_ASSET_FLAG}`, importer, {
								skipSelf: true,
								...opts
							});
						}
					}
					// Resolve to the base id (no content flags)
					// if Astro doesn't need to handle propagation.
					return this.resolve(base, importer, {
						skipSelf: true,
						...opts
					});
				}
			}
		},
		configureServer(server) {
			const ssrEnv = server.environments[ASTRO_VITE_ENVIRONMENT_NAMES.ssr];
			if (isRunnableDevEnvironment(ssrEnv)) {
				environment = ssrEnv;
			} else if (isRunnableDevEnvironment(server.environments[ASTRO_VITE_ENVIRONMENT_NAMES.astro])) {
				// When the ssr environment is not a RunnableDevEnvironment (e.g. when using the
				// Cloudflare adapter which runs ssr in workerd), fall back to the 'astro' environment
				// which is always a RunnableDevEnvironment available in dev.
				environment = server.environments[ASTRO_VITE_ENVIRONMENT_NAMES.astro];
			}
		},
		transform: {
			filter: { id: new RegExp(`(?:\\?|&)${PROPAGATED_ASSET_FLAG}(?:&|=|$)`) },
			async handler(_, id) {
				if (hasContentFlag(id, PROPAGATED_ASSET_FLAG)) {
					const basePath = id.split("?")[0];
					// Markdown entries are imported under a dedicated id so `astro:markdown` can tell them
					// apart from Markdown pages and direct imports, which share the bare path.
					const modulePath = isMarkdownFile(basePath) ? `${basePath}?${MARKDOWN_CONTENT_ENTRY_FLAG}` : basePath;
					let stringifiedLinks, stringifiedStyles;
					// We can access the server in dev,
					// so resolve collected styles and scripts here.
					if (isAstroServerEnvironment(this.environment) && environment) {
						if (!environment.moduleGraph.getModuleById(modulePath)?.ssrModule) {
							// Ignore errors here — when using a fallback environment (e.g. the 'astro'
							// env when Cloudflare's ssr env is non-runnable), the module may already be
							// loaded in the fallback env's graph even if this import throws due to
							// concurrent bundle editing.
							await environment.runner.import(modulePath).catch(() => {});
						}
						const { styles, urls, crawledFiles: styleCrawledFiles } = await getStylesForURL(modulePath, environment, cssContentCache);
						// Register files we crawled to be able to retrieve the rendered styles and scripts,
						// as when they get updated, we need to re-transform ourselves.
						// We also only watch files within the user source code, as changes in node_modules
						// are usually also ignored by Vite.
						for (const file of styleCrawledFiles) {
							if (!file.includes("node_modules")) {
								this.addWatchFile(file);
							}
						}
						stringifiedLinks = JSON.stringify([...urls]);
						stringifiedStyles = JSON.stringify(styles.map((s) => ({
							id: s.id,
							content: s.content
						})));
					} else {
						// Otherwise, use placeholders to inject styles and scripts
						// during the production bundle step.
						// @see the `astro:content-build-plugin` below.
						stringifiedLinks = JSON.stringify(LINKS_PLACEHOLDER);
						stringifiedStyles = JSON.stringify(STYLES_PLACEHOLDER);
					}
					const code = `
					async function getMod() {
						return import(${JSON.stringify(modulePath)});
					}
					const collectedLinks = ${stringifiedLinks};
					const collectedStyles = ${stringifiedStyles};
					const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] };
					export default defaultMod;
				`;
					// ^ Use a default export for tools like Markdoc
					// to catch the `__astroPropagation` identifier
					return {
						code,
						map: { mappings: "" },
						meta: createContentDataIncrementalMetadata()
					};
				}
			}
		}
	};
}
const INLINE_QUERY_REGEX = /(?:\?|&)inline(?:$|&)/;
/** Given a filePath URL, crawl Vite's module graph to find all style imports. */
async function getStylesForURL(filePath, environment, cssContentCache) {
	const importedCssUrls = new Set();
	// Map of url to injected style object. Use a `url` key to deduplicate styles
	const importedStylesMap = new Map();
	const crawledFiles = new Set();
	for await (const importedModule of crawlGraph(environment, filePath, false)) {
		if (importedModule.file) {
			crawledFiles.add(importedModule.file);
		}
		if (isBuildableCSSRequest(importedModule.url)) {
			// In dev, we inline all styles if possible
			let css = "";
			// If this is a plain CSS module, the default export should be a string
			if (typeof importedModule.ssrModule?.default === "string") {
				css = importedModule.ssrModule.default;
			} else if (importedModule.id && cssContentCache?.has(importedModule.id)) {
				css = cssContentCache.get(importedModule.id);
			} else {
				let modId = importedModule.url;
				// Mark url with ?inline so Vite will return the CSS as plain string, even for CSS modules
				if (!INLINE_QUERY_REGEX.test(importedModule.url)) {
					if (importedModule.url.includes("?")) {
						modId = importedModule.url.replace("?", "?inline&");
					} else {
						modId += "?inline";
					}
				}
				try {
					// The SSR module is possibly not loaded. Load it if it's null.
					const ssrModule = await environment.runner.import(modId);
					css = ssrModule.default;
				} catch {
					// The module may not be inline-able, e.g. SCSS partials. Skip it as it may already
					// be inlined into other modules if it happens to be in the graph.
					continue;
				}
			}
			importedStylesMap.set(importedModule.url, {
				id: wrapId(importedModule.id ?? importedModule.url),
				url: wrapId(importedModule.url),
				content: css
			});
		}
	}
	return {
		urls: importedCssUrls,
		styles: [...importedStylesMap.values()],
		crawledFiles
	};
}
/**
* Post-build hook that injects propagated styles into content collection chunks.
* Finds chunks with LINKS_PLACEHOLDER and STYLES_PLACEHOLDER, and replaces them
* with actual styles from propagatedStylesMap.
*/
export async function contentAssetsBuildPostHook(base, assetsPrefix, internals, { chunks, mutate }) {
	// Process each chunk that contains placeholder placeholders for styles/links
	for (const chunk of chunks) {
		// Skip chunks that don't have content placeholders to inject
		if (!chunk.code.includes(LINKS_PLACEHOLDER)) continue;
		const entryStyles = new Set();
		const entryLinks = new Set();
		// For each module in this chunk, look up propagated styles from the map
		for (const id of chunk.moduleIds) {
			const entryCss = internals.propagatedStylesMap.get(id);
			if (entryCss) {
				// Collect both inline content and external links
				// TODO: Separating styles and links this way is not ideal. The `entryCss` list is order-sensitive
				// and splitting them into two sets causes the order to be lost, because styles are rendered after
				// links. Refactor this away in the future.
				for (const value of entryCss) {
					if (value.type === "inline") entryStyles.add(value.content);
					if (value.type === "external") {
						let href;
						if (assetsPrefix) {
							const pf = getAssetsPrefix(fileExtension(value.src), assetsPrefix);
							href = joinPaths(pf, slash(value.src));
						} else {
							href = prependForwardSlash(joinPaths(base, slash(value.src)));
						}
						entryLinks.add(href);
					}
				}
			}
		}
		// Replace placeholders with actual styles and links
		let newCode = chunk.code;
		if (entryStyles.size) {
			newCode = newCode.replace(JSON.stringify(STYLES_PLACEHOLDER), JSON.stringify(Array.from(entryStyles)));
		} else {
			// Replace with empty array if no styles found
			newCode = newCode.replace(JSON.stringify(STYLES_PLACEHOLDER), "[]");
		}
		if (entryLinks.size) {
			newCode = newCode.replace(JSON.stringify(LINKS_PLACEHOLDER), JSON.stringify(Array.from(entryLinks)));
		} else {
			// Replace with empty array if no links found
			newCode = newCode.replace(JSON.stringify(LINKS_PLACEHOLDER), "[]");
		}
		// Persist the mutation for writing to disk
		mutate(chunk.fileName, newCode, chunk.prerender);
	}
}
