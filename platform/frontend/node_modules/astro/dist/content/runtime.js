import { escape } from "html-escaper";
import * as z from "zod/v4";
import { createSvgComponent } from "../assets/runtime.js";
import { imageSrcToImportId } from "../assets/utils/resolveImports.js";
import { recordContentEntryRender } from "../core/render-scope/record.js";
import { AstroError, AstroErrorData } from "../core/errors/index.js";
import { isRemotePath, prependForwardSlash } from "../core/path.js";
import { createComponent, createHeadAndContent, renderComponent, renderScriptElement, renderTemplate, renderUniqueStylesheet, render as serverRender, unescapeHTML } from "../runtime/server/index.js";
import { defineCollection as defineCollectionOrig } from "./config.js";
import { globalDataStore } from "./data-store.js";
import { LiveCollectionCacheHintError, LiveCollectionError, LiveCollectionValidationError, LiveEntryNotFoundError } from "./loaders/errors.js";
export { LiveCollectionError, LiveCollectionCacheHintError, LiveEntryNotFoundError, LiveCollectionValidationError };
const cacheHintSchema = z.object({
	tags: z.array(z.string()).optional(),
	lastModified: z.date().optional()
});
async function parseLiveEntry(entry, schema, collection) {
	try {
		const parsed = await z.safeParseAsync(schema, entry.data);
		if (!parsed.success) {
			return { error: new LiveCollectionValidationError(collection, entry.id, parsed.error) };
		}
		if (entry.cacheHint) {
			const cacheHint = cacheHintSchema.safeParse(entry.cacheHint);
			if (!cacheHint.success) {
				return { error: new LiveCollectionCacheHintError(collection, entry.id, cacheHint.error) };
			}
			entry.cacheHint = cacheHint.data;
		}
		return { entry: {
			...entry,
			data: parsed.data
		} };
	} catch (error) {
		return { error: new LiveCollectionError(collection, `Unexpected error parsing entry ${entry.id} in collection ${collection}`, error) };
	}
}
export function createGetCollection({ liveCollections, logger }) {
	return async function getCollection(collection, filter) {
		if (collection in liveCollections) {
			throw new AstroError({
				...AstroErrorData.UnknownContentCollectionError,
				message: `Collection "${collection}" is a live collection. Use getLiveCollection() instead of getCollection().`
			});
		}
		const hasFilter = typeof filter === "function";
		const store = await globalDataStore.get();
		if (await store.hasCollection(collection)) {
			// @ts-expect-error	virtual module
			const { default: imageAssetMap } = await import("astro:asset-imports");
			const result = [];
			for (const rawEntry of await store.values(collection)) {
				const data = resolveEntryData(rawEntry, imageAssetMap);
				let entry = {
					...rawEntry,
					data,
					collection
				};
				if (hasFilter && !filter(entry)) {
					continue;
				}
				result.push(entry);
			}
			return result;
		} else {
			logger.warn("content", `The collection ${JSON.stringify(collection)} does not exist or is empty. Please check your content config file for errors.`);
			return [];
		}
	};
}
export function createGetEntry({ liveCollections, logger }) {
	return async function getEntry(collectionOrLookupObject, lookup) {
		let collection, lookupId;
		if (typeof collectionOrLookupObject === "string") {
			collection = collectionOrLookupObject;
			if (!lookup) throw new AstroError({
				...AstroErrorData.UnknownContentCollectionError,
				message: "`getEntry()` requires an entry identifier as the second argument."
			});
			lookupId = lookup;
		} else {
			collection = collectionOrLookupObject.collection;
			// Identifier could be `slug` for content entries, or `id` for data entries
			lookupId = "id" in collectionOrLookupObject ? collectionOrLookupObject.id : collectionOrLookupObject.slug;
		}
		if (collection in liveCollections) {
			throw new AstroError({
				...AstroErrorData.UnknownContentCollectionError,
				message: `Collection "${collection}" is a live collection. Use getLiveEntry() instead of getEntry().`
			});
		}
		if (typeof lookupId === "object") {
			throw new AstroError({
				...AstroErrorData.UnknownContentCollectionError,
				message: `The entry identifier must be a string. Received object.`
			});
		}
		const store = await globalDataStore.get();
		if (await store.hasCollection(collection)) {
			const entry = await store.get(collection, lookupId);
			if (!entry) {
				logger.warn("content", `Entry ${collection} → ${lookupId} was not found.`);
				return;
			}
			// @ts-expect-error	virtual module
			const { default: imageAssetMap } = await import("astro:asset-imports");
			const data = resolveEntryData(entry, imageAssetMap);
			const result = {
				...entry,
				data,
				collection
			};
			// TODO: remove in Astro 8
			warnForPropertyAccess(logger, result.data, "slug", `[content] Attempted to access deprecated property on "${collection}" entry.\nThe "slug" property is no longer automatically added to entries. Please use the "id" property instead.`);
			// TODO: remove in Astro 8
			warnForPropertyAccess(logger, result, "render", `[content] Invalid attempt to access "render()" method on "${collection}" entry.\nTo render an entry, use "render(entry)" from "astro:content".`);
			return result;
		}
		return undefined;
	};
}
function warnForPropertyAccess(logger, entry, prop, message) {
	// Skip if the property is already defined (it may be legitimately defined on the entry)
	if (!(prop in entry)) {
		let _value = undefined;
		Object.defineProperty(entry, prop, {
			get() {
				// If the user sets value themselves, don't warn
				if (_value === undefined) {
					logger.error("content", message);
				}
				return _value;
			},
			set(v) {
				_value = v;
			},
			enumerable: false
		});
	}
}
export function createGetEntries(getEntry) {
	return async function getEntries(entries) {
		return Promise.all(entries.map((e) => getEntry(e)));
	};
}
export function createGetLiveCollection({ liveCollections }) {
	return async function getLiveCollection(collection, filter) {
		if (!(collection in liveCollections)) {
			return { error: new LiveCollectionError(collection, `Collection "${collection}" is not a live collection. Use getCollection() instead of getLiveCollection() to load regular content collections.`) };
		}
		try {
			const context = {
				filter,
				collection
			};
			const response = await liveCollections[collection].loader?.loadCollection?.(context);
			// Check if loader returned an error
			if (response && "error" in response) {
				return { error: response.error };
			}
			const { schema } = liveCollections[collection];
			let processedEntries = response.entries;
			if (schema) {
				const entryResults = await Promise.all(response.entries.map((entry) => parseLiveEntry(entry, schema, collection)));
				// Check for parsing errors
				for (const result of entryResults) {
					if (result.error) {
						// Return early on the first error
						return { error: result.error };
					}
				}
				processedEntries = entryResults.map((result) => result.entry);
			}
			let cacheHint = response.cacheHint;
			if (cacheHint) {
				const cacheHintResult = cacheHintSchema.safeParse(cacheHint);
				if (!cacheHintResult.success) {
					return { error: new LiveCollectionCacheHintError(collection, undefined, cacheHintResult.error) };
				}
				cacheHint = cacheHintResult.data;
			}
			// Aggregate cache hints from individual entries if any
			if (processedEntries.length > 0) {
				const entryTags = new Set();
				let latestModified;
				for (const entry of processedEntries) {
					if (entry.cacheHint) {
						if (entry.cacheHint.tags) {
							entry.cacheHint.tags.forEach((tag) => entryTags.add(tag));
						}
						if (entry.cacheHint.lastModified instanceof Date) {
							if (latestModified === undefined || entry.cacheHint.lastModified > latestModified) {
								latestModified = entry.cacheHint.lastModified;
							}
						}
					}
				}
				// Merge collection and entry cache hints
				if (entryTags.size > 0 || latestModified || cacheHint) {
					const mergedCacheHint = {};
					if (cacheHint?.tags || entryTags.size > 0) {
						// Merge and dedupe tags
						mergedCacheHint.tags = [...new Set([...cacheHint?.tags || [], ...entryTags])];
					}
					if (cacheHint?.lastModified && latestModified) {
						mergedCacheHint.lastModified = cacheHint.lastModified > latestModified ? cacheHint.lastModified : latestModified;
					} else if (cacheHint?.lastModified || latestModified) {
						mergedCacheHint.lastModified = cacheHint?.lastModified ?? latestModified;
					}
					cacheHint = mergedCacheHint;
				}
			}
			return {
				entries: processedEntries,
				cacheHint
			};
		} catch (error) {
			return { error: new LiveCollectionError(collection, `Unexpected error loading collection ${collection}${error instanceof Error ? `: ${error.message}` : ""}`, error) };
		}
	};
}
export function createGetLiveEntry({ liveCollections }) {
	return async function getLiveEntry(collection, lookup) {
		if (!(collection in liveCollections)) {
			return { error: new LiveCollectionError(collection, `Collection "${collection}" is not a live collection. Use getCollection() instead of getLiveEntry() to load regular content collections.`) };
		}
		try {
			const lookupObject = {
				filter: typeof lookup === "string" ? { id: lookup } : lookup,
				collection
			};
			let entry = await liveCollections[collection].loader?.loadEntry?.(lookupObject);
			// Check if loader returned an error
			if (entry && "error" in entry) {
				return { error: entry.error };
			}
			if (!entry) {
				return { error: new LiveEntryNotFoundError(collection, lookup) };
			}
			const { schema } = liveCollections[collection];
			if (schema) {
				const result = await parseLiveEntry(entry, schema, collection);
				if (result.error) {
					return { error: result.error };
				}
				entry = result.entry;
			}
			return {
				entry,
				cacheHint: entry.cacheHint
			};
		} catch (error) {
			return { error: new LiveCollectionError(collection, `Unexpected error loading entry ${collection} → ${typeof lookup === "string" ? lookup : JSON.stringify(lookup)}`, error) };
		}
	};
}
const CONTENT_LAYER_IMAGE_REGEX = /__ASTRO_IMAGE_="([^"]+)"/g;
async function updateImageReferencesInBody(html, fileName) {
	// @ts-expect-error Virtual module
	const { default: imageAssetMap } = await import("astro:asset-imports");
	const imageObjects = new Map();
	const { getImage } = await import("virtual:astro:get-image");
	// First load all the images. This is done outside of the replaceAll
	// function because getImage is async.
	for (const [_full, imagePath] of html.matchAll(CONTENT_LAYER_IMAGE_REGEX)) {
		try {
			// Markdown processors disagree on which character references to emit when
			// serialising attribute values: remark uses the numeric forms (`&#x22;` / `&#x27;` / `&#x26;`),
			// satteri uses the named forms (`&quot;` / `&apos;` / `&amp;`). Decode both styles of
			// each before JSON.parse, ampersands last — see the same chain in
			// `vite-plugin-markdown/images.ts` for why the order matters.
			const decodedImagePath = JSON.parse(imagePath.replace(/&(?:#x22|quot);/g, "\"").replace(/&(?:#x27|apos);/g, "'").replace(/&(?:amp|#x26|#38);/g, "&"));
			let image;
			if (URL.canParse(decodedImagePath.src)) {
				// Remote image, pass through without resolving import
				// We know we should resolve this remote image because either:
				// 1. It was collected with the remark-collect-images plugin, which respects the astro image configuration,
				// 2. OR it was manually injected by another plugin, and we should respect that.
				image = await getImage(decodedImagePath);
			} else {
				const id = imageSrcToImportId(decodedImagePath.src, fileName);
				const imported = imageAssetMap.get(id);
				if (!id || imageObjects.has(id) || !imported) {
					continue;
				}
				image = await getImage({
					...decodedImagePath,
					src: imported
				});
			}
			imageObjects.set(imagePath, image);
		} catch {
			throw new Error(`Failed to parse image reference: ${imagePath}`);
		}
	}
	return html.replaceAll(CONTENT_LAYER_IMAGE_REGEX, (full, imagePath) => {
		const image = imageObjects.get(imagePath);
		if (!image) {
			return full;
		}
		const { index, ...attributes } = image.attributes;
		return Object.entries({
			...attributes,
			src: image.src,
			// An empty `srcset` is invalid HTML, so only emit it when there are
			// actual candidates. This matches `vite-plugin-markdown/images.ts`.
			...image.srcSet.values.length > 0 ? { srcset: image.srcSet.attribute } : {},
			// This attribute is used by the toolbar audit
			...import.meta.env.DEV ? { "data-image-component": "true" } : {}
		}).filter(([, value]) => value != null).map(([key, value]) => value === "" ? `${key}=""` : `${key}="${escape(String(value))}"`).join(" ");
	});
}
/**
* Resolves the image src at `path` within `data` to its `ImageMetadata` (or a
* renderable SVG component). Returns the resolved value, or `undefined` when the
* image is not in the asset map and the plain src already stored in `data` should
* be kept.
*/
function resolveImageAtPath(src, fileName, imageAssetMap) {
	const id = imageSrcToImportId(src, fileName);
	if (!id) {
		return undefined;
	}
	const imported = imageAssetMap?.get(id);
	if (!imported) {
		return undefined;
	}
	if (imported.__svgData) {
		// Reconstruct the renderable SVG component from the data embedded at build
		// time. We cannot call createSvgComponent inside the SVG Vite module itself
		// because that would import the server runtime across a dynamic-import
		// boundary, recreating the TLA circular-dependency deadlock (see #15575).
		const { __svgData: svgData, ...meta } = imported;
		return createSvgComponent({
			meta,
			...svgData
		});
	}
	return imported;
}
/**
* Writes `value` at `path` within `target`, copying only the containers along
* that path so the shared store entry is never mutated. Sibling values and every
* container off the path are shared by reference, so values that `structuredClone`
* cannot handle (e.g. `Temporal` objects or class instances from Zod transforms)
* are never touched.
*/
function setAtPathCopying(target, path, value) {
	if (path.length === 0) {
		return target;
	}
	const [key, ...rest] = path;
	const copy = Array.isArray(target) ? target.slice() : { ...target };
	copy[key] = rest.length === 0 ? value : setAtPathCopying(copy[key], rest, value);
	return copy;
}
export function updateImageReferencesInData(data, fileName, imageAssetMap, imageImports) {
	if (!imageImports?.length) {
		return data;
	}
	let result = data;
	for (const path of imageImports) {
		let src = result;
		for (const key of path) {
			src = src?.[key];
		}
		if (typeof src !== "string") {
			continue;
		}
		const resolved = resolveImageAtPath(src, fileName, imageAssetMap);
		if (resolved !== undefined) {
			result = setAtPathCopying(result, path, resolved);
		}
	}
	return result;
}
export function resolveEntryData(entry, imageAssetMap) {
	return updateImageReferencesInData(entry.data, entry.filePath, imageAssetMap, entry.imageImports);
}
export function createRenderEntry({ logger }) {
	return async function renderEntry(entry) {
		if (!entry) {
			throw new AstroError(AstroErrorData.RenderUndefinedEntryError);
		}
		recordContentEntryRender(entry.filePath);
		if (entry.deferredRender) {
			try {
				// @ts-expect-error	virtual module
				const { default: contentModules } = await import("astro:content-module-imports");
				const renderEntryImport = contentModules.get(entry.filePath);
				return render({
					collection: "",
					id: entry.id,
					renderEntryImport
				});
			} catch (e) {
				logger.error("content", `${e}`);
			}
		}
		const html = entry?.rendered?.metadata?.imagePaths?.length && entry.filePath ? await updateImageReferencesInBody(entry.rendered.html, entry.filePath) : entry?.rendered?.html;
		const Content = createComponent(() => serverRender`${unescapeHTML(html)}`);
		return {
			Content,
			headings: entry?.rendered?.metadata?.headings ?? [],
			remarkPluginFrontmatter: entry?.rendered?.metadata?.frontmatter ?? {}
		};
	};
}
async function render({ collection, id, renderEntryImport }) {
	const UnexpectedRenderError = new AstroError({
		...AstroErrorData.UnknownContentCollectionError,
		message: `Unexpected error while rendering ${String(collection)} → ${String(id)}.`
	});
	if (typeof renderEntryImport !== "function") throw UnexpectedRenderError;
	const baseMod = await renderEntryImport();
	if (baseMod == null || typeof baseMod !== "object") throw UnexpectedRenderError;
	const { default: defaultMod } = baseMod;
	if (isPropagatedAssetsModule(defaultMod)) {
		const { collectedStyles, collectedLinks, collectedScripts, getMod } = defaultMod;
		if (typeof getMod !== "function") throw UnexpectedRenderError;
		const propagationMod = await getMod();
		if (propagationMod == null || typeof propagationMod !== "object") throw UnexpectedRenderError;
		const Content = createComponent({
			factory(result, baseProps, slots) {
				let styles = "", links = "", scripts = "";
				if (Array.isArray(collectedStyles)) {
					styles = collectedStyles.map((style) => {
						const content = typeof style === "string" ? style : style.content;
						const viteDevId = typeof style === "object" && style.id ? style.id : undefined;
						return renderUniqueStylesheet(result, {
							type: "inline",
							content,
							viteDevId
						});
					}).join("");
				}
				if (Array.isArray(collectedLinks)) {
					links = collectedLinks.map((link) => {
						return renderUniqueStylesheet(result, {
							type: "external",
							src: isRemotePath(link) ? link : prependForwardSlash(link)
						});
					}).join("");
				}
				if (Array.isArray(collectedScripts)) {
					scripts = collectedScripts.map((script) => renderScriptElement(script)).join("");
				}
				let props = baseProps;
				// Auto-apply MDX components export
				if (id.endsWith("mdx")) {
					props = {
						components: propagationMod.components ?? {},
						...baseProps
					};
				}
				return createHeadAndContent(unescapeHTML(styles + links + scripts), renderTemplate`${renderComponent(result, "Content", propagationMod.Content, props, slots)}`);
			},
			propagation: "self"
		});
		return {
			Content,
			headings: propagationMod.getHeadings?.() ?? [],
			remarkPluginFrontmatter: propagationMod.frontmatter ?? {}
		};
	} else if (baseMod.Content && typeof baseMod.Content === "function") {
		return {
			Content: baseMod.Content,
			headings: baseMod.getHeadings?.() ?? [],
			remarkPluginFrontmatter: baseMod.frontmatter ?? {}
		};
	} else {
		throw UnexpectedRenderError;
	}
}
export function createReference() {
	return function reference(collection) {
		return z.union([
			z.number().transform((num) => num.toString(10)),
			z.string(),
			z.object({
				id: z.string(),
				collection: z.string()
			}),
			z.object({
				slug: z.string(),
				collection: z.string()
			})
		]).transform((lookup, ctx) => {
			if (typeof lookup === "object") {
				// If these don't match then something is wrong with the reference
				if (lookup.collection !== collection) {
					const flattenedErrorPath = ctx.issues[0]?.path?.join(".");
					ctx.addIssue({
						code: "custom",
						message: `**${flattenedErrorPath}**: Reference to ${collection} invalid. Expected ${collection}. Received ${lookup.collection}.`
					});
					return;
				}
				// If it is an object then we're validating later in the build, so we can check the collection at that point.
				return lookup;
			}
			return {
				id: lookup,
				collection
			};
		});
	};
}
function isPropagatedAssetsModule(module) {
	return typeof module === "object" && module != null && "__astroPropagation" in module;
}
export function defineCollection(config) {
	if (config.type === "live") {
		throw new AstroError({
			...AstroErrorData.LiveContentConfigError,
			message: AstroErrorData.LiveContentConfigError.message("Collections with type `live` must be defined in a `src/live.config.ts` file.")
		});
	}
	return defineCollectionOrig(config);
}
export function defineLiveCollection() {
	throw new AstroError({
		...AstroErrorData.LiveContentConfigError,
		message: AstroErrorData.LiveContentConfigError.message("Live collections must be defined in a `src/live.config.ts` file.")
	});
}
export function createDeprecatedFunction(functionName) {
	return (collection) => {
		const error = new AstroError({
			...AstroErrorData.GetEntryDeprecationError,
			message: AstroErrorData.GetEntryDeprecationError.message(collection, functionName)
		});
		// Remove the runtime module from the stack trace
		const stackLines = error.stack?.split("\n");
		if (stackLines && stackLines.length > 1) {
			stackLines.splice(1, 1);
			error.stack = stackLines.join("\n");
		}
		throw error;
	};
}
