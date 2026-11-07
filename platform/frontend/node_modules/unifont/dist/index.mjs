import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { findAll, generate, parse } from "css-tree";
import { fnv1a64Base36 } from "fnv1a-64";
import { dirname, isAbsolute, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hasWindow, provider } from "std-env";
import { env } from "node:process";
//#region src/css/parse.ts
const extractableKeyMap = {
	"src": "src",
	"font-display": "display",
	"font-weight": "weight",
	"font-stretch": "stretch",
	"font-style": "style",
	"font-feature-settings": "featureSettings",
	"font-variation-settings": "variationSettings",
	"unicode-range": "unicodeRange"
};
const formatPriorityList = Object.values({
	woff2: "woff2",
	woff: "woff",
	otf: "opentype",
	ttf: "truetype",
	eot: "embedded-opentype",
	svg: "svg"
});
const WHITESPACE_RE = /\s+/g;
function normaliseFamily(family) {
	return family.trim().replace(WHITESPACE_RE, " ").toLowerCase();
}
function extractFontFaceData(css, family) {
	const fontFaces = [];
	for (const node of findAll(parse(css), (node) => node.type === "Atrule" && node.name === "font-face")) {
		/* v8 ignore next 3 */
		if (node.type !== "Atrule" || node.name !== "font-face") continue;
		if (family) {
			if (!node.block?.children.some((child) => {
				if (child.type !== "Declaration" || child.property !== "font-family") return false;
				const value = extractCSSValue(child);
				const slug = normaliseFamily(family);
				if (typeof value === "string" && normaliseFamily(value) === slug) return true;
				if (Array.isArray(value) && value.length > 0 && value.some((v) => normaliseFamily(v) === slug)) return true;
				return false;
			})) continue;
		}
		const data = {};
		for (const child of node.block?.children || []) if (child.type === "Declaration" && child.property in extractableKeyMap) {
			const value = extractCSSValue(child);
			data[extractableKeyMap[child.property]] = ["src", "unicode-range"].includes(child.property) && !Array.isArray(value) ? [value] : value;
		}
		if (!data.src) continue;
		fontFaces.push(data);
	}
	return mergeFontSources(fontFaces);
}
/** Distinct `font-family` names declared by the `@font-face` rules of a stylesheet. */
function extractFontFaceFamilies(css) {
	const families = /* @__PURE__ */ new Map();
	for (const node of findAll(parse(css), (node) => node.type === "Atrule" && node.name === "font-face")) {
		/* v8 ignore next 3 */
		if (node.type !== "Atrule" || node.name !== "font-face") continue;
		for (const child of node.block?.children || []) {
			if (child.type !== "Declaration" || child.property !== "font-family") continue;
			const value = extractCSSValue(child);
			for (const name of Array.isArray(value) ? value : [value]) if (typeof name === "string") {
				const key = normaliseFamily(name);
				if (!families.has(key)) families.set(key, name);
			}
		}
	}
	return [...families.values()];
}
/** `@import` specifiers declared by a stylesheet. */
function extractImports(css) {
	const imports = [];
	for (const node of findAll(parse(css), (node) => node.type === "Atrule" && node.name === "import")) {
		/* v8 ignore next 3 */
		if (node.type !== "Atrule") continue;
		const specifier = node.prelude?.type === "AtrulePrelude" ? node.prelude.children.first : void 0;
		if (specifier?.type === "String" || specifier?.type === "Url") imports.push(specifier.value);
	}
	return imports;
}
const RE$1 = /^(?<quote>['"])(.*)\k<quote>$/;
function processRawValue(value) {
	return value.split(",").map((v) => v.trim().replace(RE$1, "$2"));
}
function extractCSSValue(node) {
	if (node.value.type === "Raw") return processRawValue(node.value.value);
	const values = [];
	let buffer = "";
	for (const child of node.value.children) {
		if (child.type === "Function") {
			if (child.name === "local" && child.children.first?.type === "String") values.push({ name: child.children.first.value });
			if (child.name === "format") {
				if (child.children.first?.type === "String") values.at(-1).format = child.children.first.value;
				else if (child.children.first?.type === "Identifier") values.at(-1).format = child.children.first.name;
			}
			if (child.name === "tech") {
				if (child.children.first?.type === "String") values.at(-1).tech = child.children.first.value;
				else if (child.children.first?.type === "Identifier") values.at(-1).tech = child.children.first.name;
			}
		}
		if (child.type === "Url") values.push({ url: child.value });
		if (child.type === "Identifier") buffer = buffer ? `${buffer} ${child.name}` : child.name;
		if (child.type === "String") values.push(child.value);
		if (child.type === "Dimension") {
			const dimensionValue = child.value + child.unit;
			buffer = buffer ? `${buffer} ${dimensionValue}` : dimensionValue;
		}
		if (child.type === "Operator" && child.value === "," && buffer) {
			values.push(buffer);
			buffer = "";
		}
		if (child.type === "UnicodeRange") values.push(child.value);
		if (child.type === "Number") values.push(Number(child.value));
		if (child.type === "Percentage") {
			const percentageValue = `${child.value}%`;
			buffer = buffer ? `${buffer} ${percentageValue}` : percentageValue;
		}
	}
	if (buffer) values.push(buffer);
	if (values.length === 1) return values[0];
	return values;
}
function mergeFontSources(data) {
	const mergedData = [];
	for (const face of data) {
		const keys = Object.keys(face).filter((k) => k !== "src");
		const existing = mergedData.find((f) => Object.keys(f).length === keys.length + 1 && keys.every((key) => f[key]?.toString() === face[key]?.toString()));
		if (existing) {
			for (const s of face.src) if (existing.src.every((src) => "url" in src ? !("url" in s) || s.url !== src.url : !("name" in s) || s.name !== src.name)) existing.src.push(s);
		} else mergedData.push(face);
	}
	for (const face of mergedData) face.src.sort((a, b) => {
		return ("format" in a ? formatPriorityList.indexOf(a.format || "woff2") : -2) - ("format" in b ? formatPriorityList.indexOf(b.format || "woff2") : -2);
	});
	return mergedData;
}
//#endregion
//#region src/hash.ts
function serialize(value, seen) {
	switch (typeof value) {
		case "string": return JSON.stringify(value);
		case "number":
		case "boolean":
		case "bigint": return `${typeof value}:${String(value)}`;
		case "undefined": return "undefined";
		case "symbol": return `symbol:${value.description ?? ""}`;
		case "function": return `function:${value.toString()}`;
	}
	if (value === null) return "null";
	const obj = value;
	if (seen.has(obj)) return "circular";
	seen.add(obj);
	try {
		if (Array.isArray(obj)) return `[${obj.map((v) => serialize(v, seen)).join(",")}]`;
		if (obj instanceof Date) return `date:${obj.toISOString()}`;
		if (obj instanceof RegExp) return `regexp:${obj.toString()}`;
		if (obj instanceof Map) return `map:${serialize([...obj.entries()].map((e) => serialize(e, seen)).sort(), seen)}`;
		if (obj instanceof Set) return `set:${serialize([...obj].map((v) => serialize(v, seen)).sort(), seen)}`;
		if (obj instanceof URL) return `url:${obj.href}`;
		return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${serialize(obj[key], seen)}`).join(",")}}`;
	} finally {
		seen.delete(obj);
	}
}
/** Stable, non-cryptographic hash of a value, suitable for cache keys. */
function hash(value) {
	return fnv1a64Base36(serialize(value, /* @__PURE__ */ new Set()));
}
//#endregion
//#region src/utils.ts
function defineFontProvider(name, provider) {
	return ((options) => Object.assign(provider.bind(null, options || {}), {
		_name: name,
		_options: options
	}));
}
const KNOWN_STYLES = [
	"normal",
	"italic",
	"oblique"
];
/** Narrows provider metadata styles to the styles unifont understands. */
function filterKnownStyles(styles) {
	return styles.filter((s) => KNOWN_STYLES.includes(s));
}
function prepareWeights({ inputWeights, weights, hasVariableWeights }) {
	const collectedWeights = [];
	for (const weight of inputWeights) {
		if (weight.includes(" ")) {
			if (hasVariableWeights) {
				collectedWeights.push(weight);
				continue;
			}
			const [min, max] = weight.split(" ");
			const available = weights.map(Number).filter((w) => !Number.isNaN(w)).sort((a, b) => a - b);
			const inRange = available.filter((w) => w >= Number(min) && w <= Number(max));
			if (inRange.length > 0) for (const w of [
				inRange[0],
				closestTo(inRange, 400),
				inRange.at(-1)
			]) collectedWeights.push(String(w));
			else if (available.length > 0) collectedWeights.push(String(closestTo(available, clamp$1(400, Number(min), Number(max)))));
			continue;
		}
		if (weights.includes(weight)) collectedWeights.push(weight);
	}
	return Array.from(new Set(collectedWeights), (weight) => ({
		weight,
		variable: weight.includes(" ")
	}));
}
function clamp$1(value, min, max) {
	return Math.min(Math.max(value, min), max);
}
/** Picks the value nearest to `target`, preferring the lower value when two are equidistant. */
function closestTo(sortedValues, target) {
	let closest = sortedValues[0];
	for (const value of sortedValues) if (Math.abs(value - target) < Math.abs(closest - target)) closest = value;
	return closest;
}
const AXES_RESOLVED_AS_FONT_FACES = /* @__PURE__ */ new Set(["wght", "ital"]);
function normalizeBound(value) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? String(parsed) : void 0;
}
/**
* Normalises a `variableAxis` request to one shape: a single value as a string, an inclusive range
* as a `[min, max]` pair. Values that are not finite numbers are dropped.
*/
function normalizeVariableAxis(variableAxis) {
	if (!variableAxis) return void 0;
	const normalized = {};
	for (const [tag, values] of Object.entries(variableAxis)) {
		const normalizedValues = [];
		for (const value of values ?? []) {
			if (typeof value === "number" || typeof value === "string") {
				const normalizedValue = normalizeBound(value);
				if (normalizedValue !== void 0) normalizedValues.push(normalizedValue);
				continue;
			}
			const [min, max] = Array.isArray(value) ? value : [value.min, value.max];
			const normalizedMin = normalizeBound(min);
			const normalizedMax = normalizeBound(max);
			if (normalizedMin === void 0 || normalizedMax === void 0) continue;
			normalizedValues.push(normalizedMin === normalizedMax ? normalizedMin : [normalizedMin, normalizedMax]);
		}
		if (normalizedValues.length > 0) normalized[tag] = normalizedValues;
	}
	return Object.keys(normalized).length > 0 ? normalized : void 0;
}
/**
* Expresses single requested axis values as `font-variation-settings` (`"<tag>" <value>`, comma
* separated) and reports what became of every requested axis. A provider that lists what its font
* file carries in `applied` is taken at its word, and no descriptor is written.
*/
function applyVariableAxis(fonts, variableAxis, applied) {
	if (!variableAxis) return {
		fonts,
		variableAxis: void 0
	};
	const settings = /* @__PURE__ */ new Map();
	const resolved = {};
	for (const [tag, values] of Object.entries(variableAxis)) {
		const appliedValues = applied?.[tag];
		if (appliedValues) {
			resolved[tag] = {
				values: appliedValues,
				appliedAs: "font-file"
			};
			continue;
		}
		if (applied) {
			resolved[tag] = {
				values,
				appliedAs: "none"
			};
			continue;
		}
		const value = values?.length === 1 ? values[0] : void 0;
		if (typeof value !== "string" || AXES_RESOLVED_AS_FONT_FACES.has(tag)) {
			resolved[tag] = {
				values,
				appliedAs: "none"
			};
			continue;
		}
		resolved[tag] = {
			values,
			appliedAs: "variation-settings"
		};
		settings.set(tag, value);
	}
	if (settings.size === 0) return {
		fonts,
		variableAxis: resolved
	};
	return {
		fonts: fonts.map((font) => ({
			...font,
			variationSettings: mergeVariationSettings(font.variationSettings, settings)
		})),
		variableAxis: resolved
	};
}
const VARIATION_SETTING_RE = /^["']([^"']+)["']\s+(\S.*)$/;
/** Sets a value per axis tag in a `font-variation-settings` descriptor, leaving other tags as they are. */
function mergeVariationSettings(variationSettings, settings) {
	const merged = new Map(settings);
	const unparsed = [];
	for (const entry of variationSettings?.split(",") ?? []) {
		const [, tag, value] = entry.trim().match(VARIATION_SETTING_RE) ?? [];
		if (!tag) {
			unparsed.push(entry.trim());
			continue;
		}
		if (!merged.has(tag)) merged.set(tag, value);
	}
	return [...unparsed, ...Array.from(merged, ([tag, value]) => `"${tag}" ${value}`)].join(", ");
}
function splitCssIntoSubsets(input) {
	const data = [];
	const comments = [];
	const nodes = findAll(parse(input, {
		positions: true,
		onComment(value, loc) {
			comments.push({
				value: value.trim(),
				endLine: loc.end.line
			});
		}
	}), (node) => node.type === "Atrule" && node.name === "font-face");
	if (comments.length === 0) return [{
		subset: null,
		css: input
	}];
	for (const node of nodes) {
		const comment = comments.filter((comment) => comment.endLine < node.loc.start.line).at(-1);
		data.push({
			subset: comment?.value ?? null,
			css: generate(node)
		});
	}
	return data;
}
const formatMap = {
	woff2: "woff2",
	woff: "woff",
	otf: "opentype",
	ttf: "truetype",
	eot: "embedded-opentype"
};
/** Maps variation format strings (e.g. 'woff2-variations') to their base CSS format name (e.g. 'woff2') */
const variationFormatMap = {
	"woff2-variations": "woff2",
	"woff-variations": "woff",
	"opentype-variations": "opentype",
	"truetype-variations": "truetype"
};
const REMOTE_SOURCE_PROTOCOLS = /* @__PURE__ */ new Set([
	"http:",
	"https:",
	"data:"
]);
function isRemoteSourceUrl(url) {
	return REMOTE_SOURCE_PROTOCOLS.has(url.protocol);
}
/**
* Resolves the URL sources of font faces fetched from `baseUrl` against it, dropping any that do
* not resolve to an `http:`, `https:` or `data:` URL, and any faces left without a source.
*/
function resolveRemoteFontSources(fonts, baseUrl) {
	const result = [];
	for (const font of fonts) {
		const src = [];
		for (const source of font.src) {
			if (!("url" in source)) {
				src.push(source);
				continue;
			}
			const url = URL.parse(source.url, baseUrl);
			if (url && isRemoteSourceUrl(url)) src.push({
				...source,
				url: url.href
			});
		}
		if (src.length > 0) result.push({
			...font,
			src
		});
	}
	return result;
}
function computeIdFromSource(source) {
	return "name" in source ? source.name : source.url;
}
function cleanFontFaces(fonts, _formats) {
	const formats = _formats.map((format) => formatMap[format]);
	const result = [];
	const hashToIndex = /* @__PURE__ */ new Map();
	for (const { src: _src, meta, ...font } of fonts) {
		const key = hash(font);
		const index = hashToIndex.get(key);
		const src = _src.map((source) => "name" in source ? source : {
			...source,
			...source.format ? { format: formatMap[source.format] ?? source.format } : {}
		}).filter((source) => {
			if ("name" in source) return true;
			if (!source.format) return true;
			if (formats.includes(source.format)) return true;
			const baseFormat = variationFormatMap[source.format];
			return !!baseFormat && formats.includes(baseFormat);
		});
		if (src.length === 0) continue;
		if (index === void 0) {
			hashToIndex.set(key, result.push({
				...font,
				...meta ? { meta } : {},
				src
			}) - 1);
			continue;
		}
		const existing = result[index];
		const ids = new Set(existing.src.map((source) => computeIdFromSource(source)));
		existing.src.push(...src.filter((source) => {
			const id = computeIdFromSource(source);
			return !ids.has(id) && ids.add(id);
		}));
	}
	return result;
}
//#endregion
//#region src/providers/adobe.ts
async function getAdobeFontMeta(ctx, id) {
	const { kit } = await ctx.fetch(`https://typekit.com/api/v1/json/kits/${id}/published`).then((res) => res.json());
	return kit;
}
const KIT_REFRESH_TIMEOUT = 3e5;
var adobe_default = defineFontProvider("adobe", async (options, ctx) => {
	if (!options.id) return;
	const familyMap = /* @__PURE__ */ new Map();
	const notFoundFamilies = /* @__PURE__ */ new Set();
	const fonts = { kits: [] };
	let lastRefreshKitTime;
	let fetchKitsPromise;
	const kits = typeof options.id === "string" ? [options.id] : options.id;
	await fetchKits();
	async function fetchKits(bypassCache = false) {
		const newKits = [];
		const newFamilyMap = /* @__PURE__ */ new Map();
		await Promise.all(kits.map(async (id) => {
			let meta;
			const key = `adobe:meta-${id}.json`;
			if (bypassCache) {
				meta = await getAdobeFontMeta(ctx, id);
				await ctx.storage.setItem(key, meta);
			} else meta = await ctx.storage.getItem(key, () => getAdobeFontMeta(ctx, id));
			if (!meta) throw new TypeError("No font metadata found in adobe response.");
			newKits.push(meta);
			for (const family of meta.families) newFamilyMap.set(family.name, family.id);
		}));
		familyMap.clear();
		notFoundFamilies.clear();
		fonts.kits = newKits;
		for (const [k, v] of newFamilyMap) familyMap.set(k, v);
	}
	async function getFontDetails(family, options) {
		options.weights = options.weights.map(String);
		for (const kit of fonts.kits) {
			const font = kit.families.find((f) => f.name === family);
			if (!font) continue;
			const weights = prepareWeights({
				inputWeights: options.weights,
				hasVariableWeights: false,
				weights: font.variations.map((v) => `${v.slice(-1)}00`)
			}).map((w) => w.weight);
			const styles = [];
			for (const style of font.variations) {
				if (style.includes("i") && !options.styles.includes("italic")) continue;
				if (!weights.includes(String(`${style.slice(-1)}00`))) continue;
				styles.push(style);
			}
			if (styles.length === 0) continue;
			const cssUrl = `https://use.typekit.net/${kit.id}.css`;
			return resolveRemoteFontSources(extractFontFaceData(await ctx.fetch(cssUrl).then((res) => res.text()), font.css_names[0] ?? family.toLowerCase().split(" ").join("-")), cssUrl).filter((font) => {
				const [lowerWeight, upperWeight] = Array.isArray(font.weight) ? font.weight : [0, 0];
				return (!options.styles || !font.style || options.styles.includes(font.style)) && (!weights || !font.weight || Array.isArray(font.weight) ? weights.some((weight) => Number(weight) <= upperWeight || Number(weight) >= lowerWeight) : weights.includes(String(font.weight)));
			});
		}
		return [];
	}
	return {
		listFonts() {
			return [...familyMap.keys()];
		},
		getFontProperties(family) {
			for (const kit of fonts.kits) {
				const font = kit.families.find((f) => f.name === family);
				if (!font) continue;
				const styles = /* @__PURE__ */ new Set();
				const weights = /* @__PURE__ */ new Set();
				for (const variation of font.variations) {
					styles.add(variation.startsWith("i") ? "italic" : "normal");
					weights.add(`${variation.slice(-1)}00`);
				}
				return {
					styles: [...styles],
					weights: [...weights]
				};
			}
		},
		async resolveFont(family, options) {
			if (notFoundFamilies.has(family)) return;
			if (!familyMap.has(family)) {
				if (fetchKitsPromise) await fetchKitsPromise;
				else {
					const lastRefetch = lastRefreshKitTime || 0;
					const now = Date.now();
					if (now - lastRefetch > KIT_REFRESH_TIMEOUT) {
						lastRefreshKitTime = now;
						fetchKitsPromise = fetchKits(true).finally(() => {
							fetchKitsPromise = void 0;
						});
						await fetchKitsPromise;
					}
				}
			}
			if (!familyMap.has(family)) {
				notFoundFamilies.add(family);
				return;
			}
			return { fonts: await ctx.storage.getItem(`adobe:${family}-${hash(options)}-data.json`, () => getFontDetails(family, options)) };
		}
	};
});
//#endregion
//#region src/providers/bunny.ts
const BASE_URL$2 = "https://fonts.bunny.net";
const VALID_FALLBACKS$2 = [
	"sans-serif",
	"serif",
	"monospace"
];
function getFallbacks$3(category) {
	if (VALID_FALLBACKS$2.includes(category)) return [category];
}
var bunny_default = defineFontProvider("bunny", async (_options, ctx) => {
	const familyMap = /* @__PURE__ */ new Map();
	const fonts = await ctx.storage.getItem("bunny:meta.json", () => ctx.fetch(`${BASE_URL$2}/list`).then((res) => res.json()));
	for (const [id, family] of Object.entries(fonts)) familyMap.set(family.familyName, id);
	async function getFontDetails(id, font, options) {
		const weights = prepareWeights({
			inputWeights: options.weights,
			hasVariableWeights: false,
			weights: font.weights.map(String)
		});
		const styleMap = {
			italic: "i",
			oblique: "i",
			normal: ""
		};
		const styles = new Set(options.styles.map((i) => styleMap[i]));
		if (weights.length === 0 || styles.size === 0) return [];
		const resolvedVariants = weights.flatMap((w) => Array.from(styles, (s) => `${w.weight}${s}`));
		const cssUrl = `${BASE_URL$2}/css?family=${id}:${resolvedVariants.join(",")}`;
		const css = await ctx.fetch(cssUrl).then((res) => res.text());
		const resolvedFontFaceData = [];
		const groups = splitCssIntoSubsets(css).filter((group) => group.subset ? options.subsets.includes(group.subset) : true);
		for (const group of groups) {
			const data = resolveRemoteFontSources(extractFontFaceData(group.css), cssUrl);
			data.map((f) => {
				f.meta ??= {};
				if (group.subset) f.meta.subset = group.subset;
				return f;
			});
			resolvedFontFaceData.push(...data);
		}
		return cleanFontFaces(resolvedFontFaceData, options.formats);
	}
	return {
		listFonts() {
			return [...familyMap.keys()];
		},
		getFontProperties(fontFamily) {
			const id = familyMap.get(fontFamily);
			if (!id) return;
			const font = fonts[id];
			return {
				formats: ["woff2", "woff"],
				styles: filterKnownStyles(font.styles),
				subsets: Object.keys(font.variants),
				weights: font.weights.map(String)
			};
		},
		async resolveFont(fontFamily, defaults) {
			const id = familyMap.get(fontFamily);
			if (!id) return;
			const font = fonts[id];
			return {
				fonts: await ctx.storage.getItem(`bunny:${fontFamily}-${hash(defaults)}-data.json`, () => getFontDetails(id, font, defaults)),
				fallbacks: getFallbacks$3(font.category)
			};
		}
	};
});
//#endregion
//#region src/providers/fontshare.ts
const BASE_URL$1 = "https://api.fontshare.com/v2";
const UNITS_PER_EM = 1e3;
const PAGE_SIZE = 100;
function getMetrics(style) {
	const properties = style.properties;
	if (!properties) return;
	const metrics = { unitsPerEm: UNITS_PER_EM };
	if (properties.ascending_leading != null) metrics.ascent = properties.ascending_leading;
	if (properties.cap_height != null) metrics.capHeight = properties.cap_height;
	if (properties.x_height != null) metrics.xHeight = properties.x_height;
	return metrics;
}
function getFallbacks$2(category) {
	if (category.includes("Serif")) return ["serif"];
	if (category.includes("Sans")) return ["sans-serif"];
}
var fontshare_default = defineFontProvider("fontshare", async (_options, ctx) => {
	const fontshareFamilies = /* @__PURE__ */ new Set();
	const fonts = await ctx.storage.getItem("fontshare:meta.json", async () => {
		const fonts = [];
		let offset = 0;
		let chunk;
		do {
			chunk = await ctx.fetch(`${BASE_URL$1}/fonts?offset=${offset}&limit=${PAGE_SIZE}`).then((res) => res.json());
			fonts.push(...chunk.fonts);
			offset += PAGE_SIZE;
		} while (chunk.has_more);
		return fonts;
	});
	for (const font of fonts) fontshareFamilies.add(font.name);
	async function getFontDetails(font, options) {
		const numbers = [];
		let axis;
		const hasVariable = font.styles.some((e) => e.is_variable);
		if (hasVariable) axis = font.axes.find((e) => e.property === "wght");
		const staticWeights = font.styles.filter((s) => !s.is_variable).map((s) => String(s.weight.weight));
		const axisRange = axis ? `${axis.range_left} ${axis.range_right}` : void 0;
		const weights = /* @__PURE__ */ new Set();
		for (const { weight, variable } of prepareWeights({
			inputWeights: options.weights,
			hasVariableWeights: hasVariable && !!axis,
			weights: staticWeights
		})) {
			if (!variable) {
				weights.add(weight);
				continue;
			}
			const [min, max] = weight.split(" ").map(Number);
			if (axis && min <= axis.range_left && max >= axis.range_right) {
				weights.add(axisRange);
				continue;
			}
			for (const staticWeight of staticWeights) if (Number(staticWeight) >= min && Number(staticWeight) <= max) weights.add(staticWeight);
		}
		for (const style of font.styles) {
			if (style.is_italic && !options.styles.includes("italic")) continue;
			if (!style.is_italic && !options.styles.includes("normal")) continue;
			if (style.is_variable && (!axisRange || !weights.has(axisRange))) continue;
			if (!style.is_variable && !weights.has(String(style.weight.weight))) continue;
			numbers.push(style.weight.number);
		}
		if (numbers.length === 0) return [];
		const cssUrl = `${BASE_URL$1}/css?f[]=${font.slug}@${numbers.join(",")}`;
		const faces = cleanFontFaces(resolveRemoteFontSources(extractFontFaceData(await ctx.fetch(cssUrl).then((res) => res.text())), cssUrl), options.formats);
		for (const face of faces) {
			const isItalic = face.style === "italic";
			const isVariable = Array.isArray(face.weight);
			const style = font.styles.find((style) => !!style.is_italic === isItalic && (isVariable ? style.is_variable : !style.is_variable && String(style.weight.weight) === String(face.weight)));
			const metrics = style && getMetrics(style);
			if (metrics) face.metrics = metrics;
		}
		return faces;
	}
	return {
		listFonts() {
			return [...fontshareFamilies];
		},
		getFontProperties(fontFamily) {
			if (!fontshareFamilies.has(fontFamily)) return;
			const font = fonts.find((f) => f.name === fontFamily);
			const styles = /* @__PURE__ */ new Set(["normal"]);
			const weights = /* @__PURE__ */ new Set();
			for (const style of font.styles) {
				if (style.is_italic) styles.add("italic");
				if (style.is_variable) {
					const axis = font.axes.find((e) => e.property === "wght");
					if (axis) weights.add(`${axis.range_left} ${axis.range_right}`);
				} else weights.add(style.weight.weight.toString());
			}
			const metrics = getMetrics(font.styles.find((style) => style.default) ?? font.styles[0]);
			return {
				axes: font.axes.map((axis) => ({
					tag: axis.property,
					min: axis.range_left,
					max: axis.range_right,
					defaultValue: axis.range_default
				})),
				formats: [
					"woff2",
					"woff",
					"ttf"
				],
				styles: [...styles],
				weights: [...weights],
				...metrics ? { metrics } : {}
			};
		},
		async resolveFont(fontFamily, defaults) {
			if (!fontshareFamilies.has(fontFamily)) return;
			const font = fonts.find((f) => f.name === fontFamily);
			return {
				fonts: await ctx.storage.getItem(`fontshare:${fontFamily}-${hash(defaults)}-data.json`, () => getFontDetails(font, defaults)),
				fallbacks: getFallbacks$2(font.category)
			};
		}
	};
});
//#endregion
//#region src/providers/fontsource.ts
const BASE_URL = "https://api.fontsource.org/v1";
const FONTSOURCE_REGISTERED_AXES = /* @__PURE__ */ new Set([
	"wght",
	"ital",
	"slnt",
	"wdth",
	"opsz"
]);
function pickFontsourceAxisSlug(axes) {
	let hasRegisteredExtra = false;
	for (const axis of axes) {
		if (axis === "wght" || axis === "ital") continue;
		if (!FONTSOURCE_REGISTERED_AXES.has(axis)) return "full";
		hasRegisteredExtra = true;
	}
	return hasRegisteredExtra ? "standard" : "wght";
}
async function getVariableAxes(ctx, font) {
	return await ctx.storage.getItem(`fontsource:${font.family}-axes.json`, () => ctx.fetch(`${BASE_URL}/variable/${font.id}`).then((res) => res.json()));
}
const VALID_FALLBACKS$1 = [
	"sans-serif",
	"serif",
	"monospace"
];
function getFallbacks$1(category) {
	if (VALID_FALLBACKS$1.includes(category)) return [category];
}
var fontsource_default = defineFontProvider("fontsource", async (_options, ctx) => {
	const fonts = await ctx.storage.getItem("fontsource:meta.json", () => ctx.fetch(`${BASE_URL}/fonts`).then((res) => res.json()));
	const familyMap = /* @__PURE__ */ new Map();
	for (const meta of fonts) familyMap.set(meta.family, meta);
	async function getFontDetails(font, options) {
		const weights = prepareWeights({
			inputWeights: options.weights,
			hasVariableWeights: font.variable,
			weights: font.weights.map(String)
		});
		const styles = options.styles.filter((style) => font.styles.includes(style));
		const subsets = options.subsets ? options.subsets.filter((subset) => font.subsets.includes(subset)) : [font.defSubset];
		if (weights.length === 0 || styles.length === 0) return [];
		const detailUrl = `${BASE_URL}/fonts/${font.id}`;
		const fontDetail = await ctx.fetch(detailUrl).then((res) => res.json());
		const fontFaceData = [];
		for (const subset of subsets) for (const style of styles) for (const { weight, variable } of weights) {
			if (variable) {
				try {
					const variableAxes = await getVariableAxes(ctx, font);
					if (variableAxes?.axes.wght) {
						const axisSlug = pickFontsourceAxisSlug(Object.keys(variableAxes.axes));
						fontFaceData.push({
							style,
							weight: [Number(variableAxes.axes.wght.min), Number(variableAxes.axes.wght.max)],
							src: [{
								url: `https://cdn.jsdelivr.net/fontsource/fonts/${font.id}:vf@latest/${subset}-${axisSlug}-${style}.woff2`,
								format: "woff2"
							}],
							unicodeRange: fontDetail.unicodeRange[subset]?.split(","),
							meta: { subset }
						});
					}
				} catch {
					console.error(`Could not download variable axes metadata for \`${font.family}\` from \`fontsource\`. \`unifont\` will not be able to inject variable axes for ${font.family}.`);
				}
				continue;
			}
			const variantUrl = fontDetail.variants[weight][style][subset].url;
			fontFaceData.push({
				style,
				weight,
				src: Object.entries(variantUrl).map(([format, url]) => ({
					url,
					format
				})),
				unicodeRange: fontDetail.unicodeRange[subset]?.split(","),
				meta: { subset }
			});
		}
		return cleanFontFaces(resolveRemoteFontSources(fontFaceData, detailUrl), options.formats);
	}
	return {
		listFonts() {
			return [...familyMap.keys()];
		},
		async getFontProperties(fontFamily) {
			const font = familyMap.get(fontFamily);
			if (!font) return;
			const weights = [...font.weights.map(String)];
			let axes;
			if (font.variable) {
				const variableAxes = await getVariableAxes(ctx, font).catch(() => void 0);
				if (variableAxes?.axes.wght) weights.push(`${variableAxes.axes.wght.min} ${variableAxes.axes.wght.max}`);
				if (variableAxes) axes = Object.entries(variableAxes.axes).map(([tag, axis]) => ({
					tag,
					min: Number(axis.min),
					max: Number(axis.max),
					defaultValue: Number(axis.default)
				}));
			}
			return {
				...axes ? { axes } : {},
				formats: [
					"woff2",
					"woff",
					"ttf"
				],
				styles: filterKnownStyles(font.styles),
				subsets: font.subsets,
				weights
			};
		},
		async resolveFont(fontFamily, options) {
			const font = familyMap.get(fontFamily);
			if (!font) return;
			return {
				fonts: await ctx.storage.getItem(`fontsource:${fontFamily}-${hash(options)}-data.json`, () => getFontDetails(font, options)),
				fallbacks: getFallbacks$1(font.category)
			};
		}
	};
});
//#endregion
//#region src/providers/google.ts
const userAgents = {
	eot: "Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)",
	ttf: "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1",
	woff: "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0",
	woff2: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
};
/** Recovers the format a request is asking Google for, for callers that cannot set `user-agent`. */
function formatFromUserAgent(userAgent) {
	return Object.keys(userAgents).find((format) => userAgents[format] === userAgent);
}
const VALID_FALLBACKS = {
	"Sans Serif": "sans-serif",
	"Serif": "serif",
	"Monospace": "monospace"
};
function getFallbacks(category) {
	const fallback = VALID_FALLBACKS[category];
	if (fallback) return [fallback];
}
var google_default = defineFontProvider("google", async (providerOptions, ctx) => {
	const { familyMetadataList: googleFonts } = await ctx.storage.getItem("google:meta.json", () => ctx.fetch("https://fonts.google.com/metadata/fonts").then((res) => res.json()));
	const styleMap = {
		italic: "1",
		oblique: "1",
		normal: "0"
	};
	/** Resolves the axis values `css2` can be asked for, dropping axes the family does not publish. */
	function getInstancedAxes(font, options) {
		const variableAxis = normalizeVariableAxis(options.options?.experimental?.variableAxis ?? providerOptions.experimental?.variableAxis?.[font.family] ?? options.variableAxis);
		const fontAxes = new Map(font.axes.map((axis) => [axis.tag, axis]));
		const instanced = {};
		for (const [tag, values] of Object.entries(variableAxis ?? {})) {
			if (tag === "wght" || tag === "ital") continue;
			const axis = fontAxes.get(tag);
			if (!axis || !values) continue;
			const resolved = [...new Set(values.flatMap((value) => clampAxisValue(value, axis) ?? []))];
			if (resolved.length > 0) instanced[tag] = resolved;
		}
		return {
			variableAxis,
			instanced
		};
	}
	async function getFontDetails(font, options) {
		const availableStyles = getAvailableStyles(font);
		const styles = [...new Set(options.styles.filter((i) => availableStyles.has(i)).map((i) => styleMap[i]))].sort();
		const hasRequestedSubset = options.subsets.length === 0 || !font.subsets?.length || options.subsets.some((subset) => font.subsets.includes(subset));
		const glyphs = (options.options?.experimental?.glyphs ?? providerOptions.experimental?.glyphs?.[font.family])?.join("");
		const weightAxis = new Map(font.axes.map((axis) => [axis.tag, axis])).get("wght");
		const allWeights = dedupeBy(prepareWeights({
			inputWeights: options.weights,
			hasVariableWeights: !!weightAxis,
			weights: Object.keys(font.fonts)
		}).flatMap((v) => {
			if (!v.variable) return v;
			const [min, max] = v.weight.split(" ");
			const clamped = clampAxisValue([min, max], weightAxis);
			if (!clamped) return [];
			return {
				weight: clamped,
				variable: clamped.includes("..")
			};
		}), (v) => v.weight);
		const ranges = allWeights.filter((v) => v.variable).map((v) => v.weight.split("..").map(Number));
		const weights = allWeights.filter((v) => v.variable || !ranges.some(([min, max]) => Number(v.weight) >= min && Number(v.weight) <= max));
		if (weights.length === 0 || styles.length === 0 || !hasRequestedSubset) return [];
		const { instanced: resolvedVariableAxes } = getInstancedAxes(font, options);
		const candidateAxes = [
			"wght",
			"ital",
			...Object.keys(resolvedVariableAxes)
		].sort(googleFlavoredSorting);
		function buildRequest(weightValues) {
			const resolvedAxes = [];
			let resolvedVariants = [];
			for (const axis of candidateAxes) {
				const axisValue = {
					wght: weightValues,
					ital: styles
				}[axis] ?? resolvedVariableAxes[axis];
				if (resolvedVariants.length === 0) resolvedVariants = axisValue;
				else resolvedVariants = resolvedVariants.flatMap((v) => Array.from(axisValue, (o) => [v, o].join(","))).sort();
				resolvedAxes.push(axis);
			}
			return `${font.family}:${resolvedAxes.join(",")}@${resolvedVariants.join(";")}`;
		}
		const requests = [weights.filter((v) => v.variable), weights.filter((v) => !v.variable)].filter((group) => group.length > 0).map((group) => buildRequest(group.map((v) => v.weight)));
		let priority = 0;
		const resolvedFontFaceData = [];
		for (const format of options.formats) {
			const userAgent = userAgents[format];
			if (!userAgent) continue;
			for (const request of requests) {
				const baseUrl = `https://fonts.googleapis.com/css2?family=${request}`;
				const fetchFaces = async (url) => {
					return splitCssIntoSubsets(await ctx.fetch(url, { headers: { "user-agent": userAgent } }).then((res) => res.text())).filter((group) => group.subset ? options.subsets.includes(group.subset) : true).flatMap((group) => resolveRemoteFontSources(extractFontFaceData(group.css), url).map((face) => ({
						face,
						subset: group.subset
					})));
				};
				const faces = glyphs ? await resolveGlyphFaces(glyphs, baseUrl, fetchFaces) : await fetchFaces(baseUrl);
				for (const { face, subset } of faces) {
					if (!resolvedVariableAxes.wdth && face.stretch && !face.stretch.includes(" ")) delete face.stretch;
					face.meta ??= {};
					face.meta.priority = priority;
					if (subset) face.meta.subset = subset;
					resolvedFontFaceData.push(face);
				}
			}
			priority++;
		}
		return cleanFontFaces(resolvedFontFaceData, options.formats);
	}
	return {
		listFonts() {
			return googleFonts.map((font) => font.family);
		},
		getFontProperties(fontFamily) {
			const font = googleFonts.find((font) => font.family === fontFamily);
			if (!font) return;
			const styles = /* @__PURE__ */ new Set(["normal"]);
			const weights = /* @__PURE__ */ new Set();
			for (const rawWeight of Object.keys(font.fonts)) {
				const italic = rawWeight.endsWith("i");
				const weight = italic ? rawWeight.slice(0, -1) : rawWeight;
				if (italic) styles.add("italic");
				weights.add(weight);
			}
			const axis = font.axes.find((a) => a.tag === "wght");
			if (axis) weights.add(`${axis.min} ${axis.max}`);
			return {
				axes: font.axes.map((axis) => ({
					tag: axis.tag,
					min: axis.min,
					max: axis.max,
					defaultValue: axis.defaultValue
				})),
				formats: [
					"woff2",
					"woff",
					"ttf",
					"eot"
				],
				styles: [...styles],
				subsets: font.subsets,
				weights: [...weights]
			};
		},
		async resolveFont(fontFamily, options) {
			const font = googleFonts.find((font) => font.family === fontFamily);
			if (!font) return;
			const { variableAxis, instanced } = getInstancedAxes(font, options);
			return {
				fonts: await ctx.storage.getItem(`google:${fontFamily}-${hash(options)}-data.json`, () => getFontDetails(font, options)),
				fallbacks: getFallbacks(font.category),
				...variableAxis ? { appliedVariableAxis: toNormalizedValues(instanced) } : {}
			};
		}
	};
});
/** Serves curated faces the glyphs cover in full, and builds the rest with `text=`. */
async function resolveGlyphFaces(glyphs, baseUrl, fetchFaces) {
	const codepoints = new Set([...glyphs].map((glyph) => glyph.codePointAt(0)));
	const covered = [];
	const coveredRanges = [];
	for (const entry of await fetchFaces(baseUrl)) {
		const ranges = entry.face.unicodeRange?.map(parseUnicodeRange);
		if (!ranges?.every((range) => !!range && isRangeCovered(range, codepoints))) continue;
		covered.push(entry);
		coveredRanges.push(...ranges.filter((range) => !!range));
	}
	const remainder = [...codepoints].filter((codepoint) => !coveredRanges.some(([start, end]) => codepoint >= start && codepoint <= end));
	if (remainder.length === 0) return covered;
	return [...covered, ...await fetchFaces(`${baseUrl}&text=${encodeURIComponent(String.fromCodePoint(...remainder))}`)];
}
function isRangeCovered([start, end], codepoints) {
	for (let codepoint = start; codepoint <= end; codepoint++) if (!codepoints.has(codepoint) && !isGlyphless(codepoint)) return false;
	return true;
}
/** C0 controls, DEL and C1 controls, and noncharacters, none of which a font draws. */
function isGlyphless(codepoint) {
	return codepoint <= 31 || codepoint >= 127 && codepoint <= 159 || codepoint >= 64976 && codepoint <= 65007 || (codepoint & 65534) === 65534;
}
const UNICODE_RANGE_RE = /^u\+([0-9a-f?]{1,6})(?:-([0-9a-f]{1,6}))?$/;
function parseUnicodeRange(value) {
	const match = value.trim().toLowerCase().match(UNICODE_RANGE_RE);
	if (!match) return void 0;
	const [, start, end] = match;
	return [Number.parseInt(start.replaceAll("?", "0"), 16), end === void 0 ? Number.parseInt(start.replaceAll("?", "f"), 16) : Number.parseInt(end, 16)];
}
/** Expresses the values requested from `css2` (`62.5..100`) in the shape unifont reports. */
function toNormalizedValues(instanced) {
	const normalized = {};
	for (const [tag, values] of Object.entries(instanced)) normalized[tag] = values.map((value) => {
		const [min, max] = value.split("..");
		return max === void 0 ? min : [min, max];
	});
	return normalized;
}
function clampAxisValue(value, axis) {
	if (!Array.isArray(value)) return String(clamp(Number(value), axis));
	const min = Number(value[0]);
	const max = Number(value[1]);
	if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return void 0;
	if (max < axis.min || min > axis.max) return void 0;
	const clampedMin = clamp(min, axis);
	const clampedMax = clamp(max, axis);
	return clampedMin === clampedMax ? String(clampedMin) : `${clampedMin}..${clampedMax}`;
}
function getAvailableStyles(font) {
	const styles = /* @__PURE__ */ new Set();
	for (const weight of Object.keys(font.fonts)) if (weight.endsWith("i")) {
		styles.add("italic");
		styles.add("oblique");
	} else styles.add("normal");
	if (font.axes.some((axis) => axis.tag === "ital" || axis.tag === "slnt")) {
		styles.add("italic");
		styles.add("oblique");
	}
	return styles;
}
function clamp(value, axis) {
	return Math.min(Math.max(value, axis.min), axis.max);
}
function dedupeBy(items, by) {
	const seen = /* @__PURE__ */ new Set();
	return items.filter((item) => {
		const key = by(item);
		return !seen.has(key) && !!seen.add(key);
	});
}
function googleFlavoredSorting(a, b) {
	const isALowercase = a.charAt(0) === a.charAt(0).toLowerCase();
	const isBLowercase = b.charAt(0) === b.charAt(0).toLowerCase();
	if (isALowercase !== isBLowercase) return Number(isBLowercase) - Number(isALowercase);
	else return a.localeCompare(b);
}
//#endregion
//#region src/providers/googleicons.ts
var googleicons_default = defineFontProvider("googleicons", async (providerOptions, ctx) => {
	const googleIcons = await ctx.storage.getItem("googleicons:meta.json", async () => {
		const data = await ctx.fetch("https://fonts.google.com/metadata/icons?key=material_symbols&incomplete=true").then((res) => res.text());
		return JSON.parse(data.substring(data.indexOf("\n") + 1)).families;
	});
	async function getFontDetails(family, options) {
		const iconNames = (options.options?.experimental?.glyphs ?? providerOptions.experimental?.glyphs?.[family])?.toSorted().join(",");
		let css = "";
		for (const format of options.formats) {
			const userAgent = userAgents[format];
			if (!userAgent) continue;
			if (family.includes("Icons")) css += await ctx.fetch(`https://fonts.googleapis.com/icon?family=${family}`, { headers: { "user-agent": userAgent } }).then((res) => res.text());
			else {
				let url = `https://fonts.googleapis.com/css2?family=${family}:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200`;
				if (iconNames) url += `&icon_names=${iconNames}`;
				css += await ctx.fetch(url, { headers: { "user-agent": userAgent } }).then((res) => res.text());
			}
		}
		return cleanFontFaces(resolveRemoteFontSources(extractFontFaceData(css), "https://fonts.googleapis.com/"), options.formats);
	}
	return {
		listFonts() {
			return googleIcons;
		},
		getFontProperties(fontFamily) {
			if (!googleIcons.includes(fontFamily)) return;
			return {
				formats: [
					"woff2",
					"woff",
					"ttf",
					"eot"
				],
				styles: ["normal"],
				weights: fontFamily.includes("Icons") ? ["400"] : ["100 700"]
			};
		},
		async resolveFont(fontFamily, options) {
			if (!googleIcons.includes(fontFamily)) return;
			return { fonts: await ctx.storage.getItem(`googleicons:${fontFamily}-${hash(options)}-data.json`, () => getFontDetails(fontFamily, options)) };
		}
	};
});
//#endregion
//#region src/providers/npm.ts
const DEFAULT_CDN = "https://cdn.jsdelivr.net/npm";
const IBM_PLEX_FAMILY_RE = /^ibm plex /i;
const IBM_PLEX_SUBSET_RE = /\b(?:Jp|Kr|Sc|Tc)\b/g;
const KNOWN_FONT_PACKAGES = [
	{
		match: /^@fontsource-variable\//,
		family: (pkg) => {
			return `${slugToFamily(pkg.replace("@fontsource-variable/", ""))} Variable`;
		}
	},
	{
		match: /^@fontsource\//,
		family: (pkg) => {
			return slugToFamily(pkg.replace("@fontsource/", ""));
		}
	},
	{
		match: /^@ibm\/plex-[a-z-]+$/,
		family: (pkg) => `IBM Plex ${slugToFamily(pkg.replace("@ibm/plex-", "")).replace(IBM_PLEX_SUBSET_RE, (subset) => subset.toUpperCase())}`,
		files: (pkg) => [`css/${pkg.replace("@ibm/", "ibm-")}-all.css`],
		familyMatch: IBM_PLEX_FAMILY_RE,
		package: (family) => `@ibm/plex-${familyToSlug(family.replace(IBM_PLEX_FAMILY_RE, ""))}`
	},
	{
		match: /^cal-sans$/,
		family: () => "Cal Sans"
	}
];
/** Convert a slug like "geist-sans" to "Geist Sans" */
function slugToFamily(slug) {
	return slug.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}
const SPACE_RE = /\s+/g;
/** Convert a family name like "Geist Sans" to a fontsource slug "geist-sans" */
function familyToSlug(family) {
	return family.toLowerCase().replace(SPACE_RE, "-");
}
const VARIABLE_RE = / Variable$/;
/**
* Guess the npm package name for a font family that wasn't found in the
* auto-detected packages. Uses fontsource conventions as fallback.
*/
function guessPackageForFamily(family) {
	for (const pattern of KNOWN_FONT_PACKAGES) if (pattern.familyMatch?.test(family) && pattern.package) return pattern.package(family);
	if (family.endsWith(" Variable")) return `@fontsource-variable/${familyToSlug(family.replace(VARIABLE_RE, ""))}`;
	return `@fontsource/${familyToSlug(family)}`;
}
const DEFAULT_CSS_FILE = "index.css";
const STANDARD_WEIGHTS = [
	"100",
	"200",
	"300",
	"400",
	"500",
	"600",
	"700",
	"800",
	"900"
];
/**
* `@fontsource/*` packages ship `index.css` with a single weight (400) alongside
* per-weight and per-style entry points, so the requested weights and styles are
* mapped onto those entry points. Other layouts (including
* `@fontsource-variable/*`, whose `index.css` covers the full weight range) use
* `index.css`.
*/
function resolveCssFiles(pkgName, options) {
	if (!pkgName.startsWith("@fontsource/")) {
		for (const pattern of KNOWN_FONT_PACKAGES) if (pattern.files && pattern.match.test(pkgName)) return pattern.files(pkgName);
		return [DEFAULT_CSS_FILE];
	}
	const weights = /* @__PURE__ */ new Set();
	for (const weight of options.weights) {
		if (weight.includes(" ")) {
			const [min, max] = weight.split(" ").map(Number);
			for (const standardWeight of STANDARD_WEIGHTS) if (Number(standardWeight) >= min && Number(standardWeight) <= max) weights.add(standardWeight);
			continue;
		}
		weights.add(weight);
	}
	const files = [];
	for (const weight of weights) for (const style of options.styles) files.push(style === "normal" ? `${weight}.css` : `${weight}-${style}.css`);
	return files.length > 0 ? files : [DEFAULT_CSS_FILE];
}
const LEADING_RELATIVE_RE = /^\.?\//;
function normaliseCssFile(file) {
	return file.replace(LEADING_RELATIVE_RE, "");
}
const PACKAGE_STYLESHEET_RE = /^(?:\.\/)?(?:[\w-][\w.-]*\/)*[\w-][\w.-]*\.css$/;
function stripTrailingSlashes(path) {
	let end = path.length;
	while (end > 1 && (path[end - 1] === "/" || path[end - 1] === "\\")) end--;
	return path.slice(0, end);
}
/**
* Strip the resolved CSS specifier back off to recover the package directory,
* which is where the stylesheet's relative font URLs are anchored.
*/
function packageDirFor(path, cssFile) {
	const suffix = `/${cssFile}`;
	if (path.replaceAll("\\", "/").endsWith(suffix)) return path.slice(0, path.length - suffix.length);
	return dirname(path);
}
const PARENT_DIR_RE = /^\.\.(?:[/\\]|$)/;
function isWithinDir(dir, path) {
	const rel = relative(dir, path);
	return !PARENT_DIR_RE.test(rel) && !isAbsolute(rel);
}
/** The path of a `file:` URL, provided it is inside `pkgDir`. */
function packageFilePath(url, pkgDir) {
	if (url?.protocol !== "file:") return null;
	try {
		const path = fileURLToPath(url);
		return isWithinDir(pkgDir, path) ? path : null;
	} catch {
		return null;
	}
}
const PROTOCOL_RELATIVE_BASE = "https://localhost/";
/**
* Resolve a `url()` reference from the stylesheet at `cssUrl`. References that carry
* their own host, such as protocol-relative ones, resolve to `https:` rather than to
* a `file:` URL on that host.
*/
function resolveLocalReference(reference, cssUrl) {
	const url = URL.parse(reference, cssUrl);
	return url && url.host !== cssUrl.host ? URL.parse(reference, PROTOCOL_RELATIVE_BASE) : url;
}
function isWithinUrl(base, url) {
	return url.origin === base.origin && url.pathname.startsWith(base.pathname);
}
const MAX_IMPORT_DEPTH = 3;
/** Load the given stylesheets, and recursively the package-relative stylesheets they `@import`. */
async function collectStylesheets(locations, load, join) {
	const stylesheets = [];
	const seen = /* @__PURE__ */ new Set();
	async function loadAll(pending, depth) {
		const next = [];
		await Promise.all(pending.map(async (location) => {
			if (seen.has(location)) return;
			seen.add(location);
			const css = await load(location);
			if (!css) return;
			stylesheets.push({
				css,
				location
			});
			if (depth < MAX_IMPORT_DEPTH) for (const specifier of extractImports(css)) {
				const joined = join(location, specifier);
				if (joined) next.push(joined);
			}
		}));
		if (next.length > 0) await loadAll(next, depth + 1);
	}
	await loadAll(locations, 0);
	return stylesheets;
}
/**
* Extract the faces for `family` from each stylesheet. With `allowAnyFamily`, an
* unmatched family falls back to every face in the stylesheets, provided they
* declare a single family between them.
*/
function groupFontFaces(stylesheets, family, allowAnyFamily) {
	const groups = stylesheets.map((sheet) => ({
		faces: extractFontFaceData(sheet.css, family),
		location: sheet.location
	}));
	if (!allowAnyFamily || groups.some((group) => group.faces.length > 0)) return groups;
	if (new Set(stylesheets.flatMap((sheet) => extractFontFaceFamilies(sheet.css))).size !== 1) return groups;
	return stylesheets.map((sheet) => ({
		faces: extractFontFaceData(sheet.css),
		location: sheet.location
	}));
}
var npm_default = defineFontProvider("npm", (providerOptions, ctx) => {
	const cdn = providerOptions.cdn || DEFAULT_CDN;
	const remote = providerOptions.remote ?? true;
	const readFile = providerOptions.readFile;
	const exists = providerOptions.exists ?? ((path) => readFile(path).then((contents) => contents !== null));
	const root = stripTrailingSlashes(providerOptions.root || ".");
	const resolveId = providerOptions.resolve ?? ((id) => {
		if (!providerOptions.root && typeof import.meta.resolve === "function") try {
			const url = import.meta.resolve(id);
			if (url.startsWith("file:")) return fileURLToPath(url);
		} catch {}
		return `${root}/node_modules/${id}`;
	});
	async function resolvePath(id) {
		try {
			return await resolveId(id) ?? null;
		} catch {
			return null;
		}
	}
	let detectedFonts;
	let detectedFontsHash;
	async function getDetectedFonts() {
		if (!readFile) return detectedFonts ??= /* @__PURE__ */ new Map();
		let pkgJsonContent;
		try {
			pkgJsonContent = await readFile(`${root}/package.json`);
		} catch {
			return detectedFonts ??= /* @__PURE__ */ new Map();
		}
		if (!pkgJsonContent) return detectedFonts ??= /* @__PURE__ */ new Map();
		const contentHash = hash(pkgJsonContent);
		if (detectedFonts && detectedFontsHash === contentHash) return detectedFonts;
		detectedFontsHash = contentHash;
		detectedFonts = /* @__PURE__ */ new Map();
		try {
			const pkgJson = JSON.parse(pkgJsonContent);
			const allDeps = {
				...pkgJson.dependencies,
				...pkgJson.devDependencies
			};
			for (const depName of Object.keys(allDeps)) for (const pattern of KNOWN_FONT_PACKAGES) if (pattern.match.test(depName)) {
				const family = pattern.family(depName);
				detectedFonts.set(family.toLowerCase(), {
					family,
					pkgName: depName
				});
				break;
			}
		} catch {}
		return detectedFonts;
	}
	/**
	* Rewrite relative URLs to `file://` URLs pointing at the installed package.
	* Sources whose files are missing on disk, or resolve outside `pkgDir`, are
	* dropped rather than silently falling back to the CDN, which `remote: false`
	* promises not to use.
	*/
	async function resolveUrlsToLocalFiles(fontFaces, cssPath, pkgDir) {
		const cssUrl = pathToFileURL(cssPath);
		const resolved = [];
		for (const face of fontFaces) {
			const src = [];
			for (const source of face.src) {
				if (!("url" in source)) {
					src.push(source);
					continue;
				}
				const url = resolveLocalReference(source.url, cssUrl);
				if (url && isRemoteSourceUrl(url)) {
					src.push({
						...source,
						url: url.href
					});
					continue;
				}
				const filePath = packageFilePath(url, pkgDir);
				if (!filePath) {
					console.warn(`\`${source.url}\` in \`${cssPath}\` does not resolve to a file inside \`${pkgDir}\`. \`unifont\` will not include this font source.`);
					continue;
				}
				if (!await exists(filePath).catch(() => false)) {
					console.warn(`Could not find \`${filePath}\` when resolving fonts locally. \`unifont\` will not include this font source.`);
					continue;
				}
				src.push({
					...source,
					url: pathToFileURL(filePath).href
				});
			}
			if (src.some((source) => "url" in source)) resolved.push({
				...face,
				src
			});
		}
		return resolved;
	}
	async function resolveFromLocal(pkgName, cssFiles, family, formats, allowAnyFamily) {
		if (!readFile) return null;
		const roots = (await Promise.all(cssFiles.map(async (cssFile) => {
			const path = await resolvePath(`${pkgName}/${cssFile}`);
			return path ? {
				path,
				cssFile
			} : null;
		}))).filter((entry) => entry !== null);
		if (roots.length === 0) return null;
		const pkgDir = packageDirFor(roots[0].path, roots[0].cssFile);
		const stylesheets = await collectStylesheets(roots.map((root) => root.path), (path) => readFile(path).catch(() => null), (from, specifier) => packageFilePath(URL.parse(specifier, pathToFileURL(from)), pkgDir));
		if (stylesheets.length === 0) return null;
		const groups = groupFontFaces(stylesheets, family, allowAnyFamily);
		if (groups.every((group) => group.faces.length === 0)) return null;
		if (!remote) {
			const localFaces = [];
			for (const group of groups) localFaces.push(...await resolveUrlsToLocalFiles(group.faces, group.location, pkgDir));
			return localFaces.length > 0 ? cleanFontFaces(localFaces, formats) : null;
		}
		let version = "latest";
		try {
			const localPkgJson = await readFile(`${pkgDir}/package.json`);
			if (localPkgJson) {
				const parsed = JSON.parse(localPkgJson);
				if (parsed.version) version = parsed.version;
			}
		} catch {}
		const fontFaces = [];
		for (const group of groups) {
			const cssPath = relative(pkgDir, group.location).replaceAll("\\", "/");
			fontFaces.push(...resolveRemoteFontSources(group.faces, `${cdn}/${pkgName}@${version}/${cssPath}`));
		}
		return cleanFontFaces(fontFaces, formats);
	}
	async function resolveFromCdn(pkgName, pkgVersion, cssFiles, family, formats, allowAnyFamily) {
		const pkgUrl = `${cdn}/${pkgName}@${pkgVersion}/`;
		const groups = groupFontFaces(await collectStylesheets(cssFiles.map((cssFile) => `${pkgUrl}${cssFile}`), (url) => ctx.fetch(url).then((res) => res.text()).catch(() => null), (from, specifier) => {
			const url = URL.parse(specifier, from);
			return url && isWithinUrl(new URL(pkgUrl), url) ? url.href : null;
		}), family, allowAnyFamily);
		const fontFaces = [];
		for (const group of groups) fontFaces.push(...resolveRemoteFontSources(group.faces, group.location));
		if (fontFaces.length === 0) return null;
		return cleanFontFaces(fontFaces, formats);
	}
	/** Stylesheets declared by the package's `package.json`, `style` before `main`. */
	async function resolvePackageJsonStylesheets(pkgName, pkgVersion) {
		const read = async () => {
			if (readFile) {
				const path = await resolvePath(`${pkgName}/package.json`);
				const local = path ? await readFile(path).catch(() => null) : null;
				if (local) return local;
			}
			if (!remote) return null;
			return ctx.fetch(`${cdn}/${pkgName}@${pkgVersion}/package.json`).then((res) => res.text()).catch(() => null);
		};
		const contents = await read();
		if (!contents) return [];
		const files = [];
		try {
			const parsed = JSON.parse(contents);
			for (const field of [parsed.style, parsed.main]) if (typeof field === "string" && PACKAGE_STYLESHEET_RE.test(field)) {
				const file = normaliseCssFile(field);
				if (!files.includes(file)) files.push(file);
			}
		} catch {}
		return files;
	}
	async function resolveCandidates(pkgName, pkgVersion, candidates, family, formats, allowAnyFamily) {
		for (const files of candidates) {
			const localResult = await resolveFromLocal(pkgName, files, family, formats, allowAnyFamily);
			if (localResult) return localResult;
		}
		if (!remote) return null;
		for (const files of candidates) {
			const cdnResult = await resolveFromCdn(pkgName, pkgVersion, files, family, formats, allowAnyFamily);
			if (cdnResult) return cdnResult;
		}
		return null;
	}
	async function resolveFaces(pkgName, pkgVersion, cssFiles, family, formats, explicitFile) {
		const candidates = cssFiles.includes(DEFAULT_CSS_FILE) || explicitFile ? [cssFiles] : [cssFiles, [DEFAULT_CSS_FILE]];
		const resolved = await resolveCandidates(pkgName, pkgVersion, candidates, family, formats, explicitFile);
		if (resolved || explicitFile) return resolved;
		const fallbacks = (await resolvePackageJsonStylesheets(pkgName, pkgVersion)).filter((file) => !candidates.some((files) => files.includes(file))).map((file) => [file]);
		if (fallbacks.length === 0) return null;
		return await resolveCandidates(pkgName, pkgVersion, fallbacks, family, formats, false);
	}
	return {
		async listFonts() {
			const fonts = await getDetectedFonts();
			if (fonts.size === 0) return;
			return Array.from(fonts.values(), (f) => f.family);
		},
		async getFontProperties(family) {
			const pkgName = (await getDetectedFonts()).get(family.toLowerCase())?.pkgName ?? guessPackageForFamily(family);
			const cssFiles = resolveCssFiles(pkgName, {
				weights: STANDARD_WEIGHTS,
				styles: ["normal", "italic"]
			});
			const allFormats = [
				"woff2",
				"woff",
				"otf",
				"ttf",
				"eot"
			];
			const fonts = await ctx.storage.getItem(`npm:${pkgName}/${familyToSlug(family)}-${hash(family)}-properties.json`, () => resolveFaces(pkgName, "latest", cssFiles, family, allFormats, false));
			if (!fonts || fonts.length === 0) return;
			const styles = /* @__PURE__ */ new Set();
			const weights = /* @__PURE__ */ new Set();
			for (const face of fonts) {
				if (face.style) styles.add(face.style);
				if (face.weight) weights.add(Array.isArray(face.weight) ? face.weight.join(" ") : String(face.weight));
			}
			return {
				styles: filterKnownStyles([...styles]),
				weights: [...weights]
			};
		},
		async resolveFont(family, options) {
			const familyOptions = options.options || {};
			let pkgName;
			let file;
			if (familyOptions.package) {
				pkgName = familyOptions.package;
				file = familyOptions.file;
			} else {
				pkgName = (await getDetectedFonts()).get(family.toLowerCase())?.pkgName ?? guessPackageForFamily(family);
				file = familyOptions.file;
			}
			const pkgVersion = familyOptions.version || "latest";
			const cssFiles = file ? [normaliseCssFile(file)] : resolveCssFiles(pkgName, options);
			const key = `npm:${pkgName}/${familyToSlug(family)}-${cssFiles.join(",")}-${hash({
				family,
				options
			})}.json`;
			const fonts = await ctx.storage.getItem(key, () => resolveFaces(pkgName, pkgVersion, cssFiles, family, options.formats, Boolean(file)));
			if (!fonts) return;
			return { fonts };
		}
	};
});
//#endregion
//#region src/providers.ts
var providers_exports = /* @__PURE__ */ __exportAll({
	adobe: () => adobe_default,
	bunny: () => bunny_default,
	fontshare: () => fontshare_default,
	fontsource: () => fontsource_default,
	google: () => google_default,
	googleicons: () => googleicons_default,
	npm: () => npm_default
});
//#endregion
//#region src/fetch.ts
const RETRY_DELAY = 1e3;
var NonRetryableError = class extends Error {};
async function fetchWithRetries(url, init, retries = 3) {
	try {
		const response = await fetch(url, init);
		if (!response.ok) {
			const message = `Fetch error (status ${response.status}): ${response.statusText}`;
			if (response.status >= 400 && response.status < 500 && response.status !== 429) throw new NonRetryableError(message);
			throw new Error(message);
		}
		return response;
	} catch (err) {
		if (retries <= 0 || err instanceof NonRetryableError) throw err;
		console.warn(`Could not fetch from \`${url}\`. Will retry in \`${RETRY_DELAY}ms\`. \`${retries}\` retries left.`);
		return new Promise((resolve) => setTimeout(resolve, RETRY_DELAY)).then(() => fetchWithRetries(url, init, retries - 1));
	}
}
//#endregion
//#region src/api-base.ts
/** The `unifont`-hosted proxy, used where the provider APIs cannot be reached directly. */
const DEFAULT_API_BASE = "https://proxy.unifont.dev";
/**
* Upstream API URL prefixes and the proxy route serving each, applied in order. A URL that matches
* nothing is requested directly, so providers that already work cross-origin (`npm`, font CDNs)
* are unaffected.
* @see https://github.com/unjs/unifont/tree/main/proxy
*/
const proxyRoutes = [
	[/^https:\/\/typekit\.com\/api\/v1\/json\/kits\/([^/]+)\/published$/, "/adobe/v1/kit/$1"],
	[/^https:\/\/use\.typekit\.net\/([^/]+)\.css$/, "/adobe/v1/kit-css/$1"],
	[/^https:\/\/fonts\.bunny\.net\//, "/bunny/v1/"],
	[/^https:\/\/api\.fontshare\.com\/v2\//, "/fontshare/v1/"],
	[/^https:\/\/api\.fontsource\.org\/v1\//, "/fontsource/v1/"],
	[/^https:\/\/fonts\.google\.com\/metadata\/fonts/, "/google/v1/fonts"],
	[/^https:\/\/fonts\.google\.com\/metadata\/icons/, "/google/v1/icons"],
	[/^https:\/\/fonts\.googleapis\.com\/css2/, "/google/v1/css"],
	[/^https:\/\/fonts\.googleapis\.com\/icon/, "/google/v1/icon"]
];
/**
* Trims trailing slashes with a loop rather than `/\/+$/`, which backtracks quadratically over a
* long run of slashes.
* @see https://github.com/unjs/unifont/security/code-scanning/17
*/
function withoutTrailingSlashes(value) {
	let end = value.length;
	while (end > 0 && value[end - 1] === "/") end--;
	return value.slice(0, end);
}
/** Rewrites an upstream API URL to its proxy equivalent, or returns `undefined` if it has none. */
function toProxyURL(apiBase, url) {
	for (const [pattern, route] of proxyRoutes) if (pattern.test(url)) return withoutTrailingSlashes(apiBase) + url.replace(pattern, route);
}
/**
* Whether the current environment is subject to CORS, which every provider API except `npm`
* rejects. Covers browsers and WebContainers, whose Node process is served by the browser and so
* is bound by the same restrictions.
*/
function requiresProxy() {
	return hasWindow || provider === "stackblitz";
}
/** Resolves the configured `apiBase`, falling back to the hosted proxy where one is needed. */
function resolveAPIBase(apiBase) {
	if (apiBase === false) return;
	return apiBase || (requiresProxy() ? DEFAULT_API_BASE : void 0);
}
/**
* Wraps the provider fetcher so that requests to a known upstream API are sent to a `unifont`
* proxy instead.
*
* A browser cannot set `user-agent`, which is how Google's endpoints pick a font format, so the
* requested format moves into the query string for the proxy to apply on our behalf.
*/
function createAPIFetch(configuredAPIBase) {
	const apiBase = resolveAPIBase(configuredAPIBase);
	if (!apiBase) return fetchWithRetries;
	return (url, init) => {
		let proxied = toProxyURL(apiBase, url);
		if (!proxied) return fetchWithRetries(url, init);
		const headers = new Headers(init?.headers);
		const format = formatFromUserAgent(headers.get("user-agent"));
		if (format) {
			headers.delete("user-agent");
			proxied += `${proxied.includes("?") ? "&" : "?"}format=${format}`;
		}
		return fetchWithRetries(proxied, {
			...init,
			headers
		});
	};
}
//#endregion
//#region package.json
var version = "1.0.3";
//#endregion
//#region src/cache.ts
function memoryStorage() {
	const cache = /* @__PURE__ */ new Map();
	return {
		getItem(key) {
			return cache.get(key);
		},
		setItem(key, value) {
			cache.set(key, value);
		}
	};
}
const ONE_WEEK = 6048e5;
function createAsyncStorage(storage, options = {}) {
	const prefix = options?.cachedBy?.length ? `${createCacheKey(...options.cachedBy)}:` : "";
	const resolveKey = (key) => `${prefix}${key}`;
	async function write(key, value) {
		try {
			await storage.setItem(key, value);
		} catch (error) {
			console.warn(`Could not cache \`${key}\`. Continuing without caching it.`, error);
		}
	}
	return {
		async getItem(key, init) {
			const resolvedKey = resolveKey(key);
			const now = Date.now();
			const res = await storage.getItem(resolvedKey);
			if (res && res.expires > now && res.version === version) return res.data;
			if (!init) return null;
			const data = await init();
			await write(resolvedKey, {
				expires: now + ONE_WEEK,
				version,
				data
			});
			return data;
		},
		async setItem(key, data) {
			await write(resolveKey(key), {
				expires: Date.now() + ONE_WEEK,
				version,
				data
			});
		}
	};
}
function createCacheKey(...fragments) {
	return fragments.map((f) => {
		return sanitize(typeof f === "string" ? f : hash(f));
	}).join(":");
}
const RE = /[^\w.-]/g;
function sanitize(input) {
	if (!input) return "";
	return input.replace(RE, "_");
}
//#endregion
//#region src/env-proxy.ts
let installed = false;
function isDefaultAgent(dispatcher) {
	return dispatcher?.constructor?.name === "Agent";
}
async function installProxyDispatcher() {
	if (installed) return;
	if (!(env.HTTPS_PROXY || env.HTTP_PROXY || env.https_proxy || env.http_proxy)) return;
	installed = true;
	try {
		const { EnvHttpProxyAgent, getGlobalDispatcher, setGlobalDispatcher } = await import("undici");
		if (isDefaultAgent(getGlobalDispatcher())) setGlobalDispatcher(new EnvHttpProxyAgent());
	} catch {}
}
//#endregion
//#region src/unifont.ts
const defaultResolveOptions = {
	weights: ["400"],
	styles: ["normal", "italic"],
	subsets: [
		"cyrillic-ext",
		"cyrillic",
		"greek-ext",
		"greek",
		"vietnamese",
		"latin-ext",
		"latin"
	],
	formats: ["woff2"]
};
async function createUnifont(providers, unifontOptions) {
	await installProxyDispatcher();
	const storage = unifontOptions?.storage ?? memoryStorage();
	const fetch = createAPIFetch(unifontOptions?.apiBase);
	const factories = {};
	for (const provider of providers) factories[provider._name] = provider;
	const allProviders = Object.keys(factories);
	const stack = {};
	async function* initializeProviders(ids, errors) {
		for (const id of ids) {
			const factory = factories[id];
			if (!factory) continue;
			stack[id] ??= (async () => {
				const context = {
					storage: createAsyncStorage(storage, { cachedBy: [factory._name, factory._options] }),
					fetch
				};
				try {
					const provider = await factory(context);
					return provider?.resolveFont ? provider : void 0;
				} catch (cause) {
					return new Error(`Could not initialize provider \`${id}\`. \`unifont\` will not be able to process fonts provided by this provider.`, { cause });
				}
			})();
			const provider = await stack[id];
			if (provider instanceof Error) errors.push(provider);
			else if (provider) yield [id, provider];
		}
	}
	function reportErrors(errors, message, resolved) {
		if (errors.length === 0) return;
		if (unifontOptions?.throwOnError && !resolved) throw errors.length === 1 ? errors[0] : new AggregateError(errors, message);
		const log = resolved ? console.warn : console.error;
		for (const error of errors) log(error.message, error.cause);
	}
	async function resolveFont(fontFamily, options = {}, providers = allProviders) {
		const { variableAxis: requestedVariableAxis, ...resolveOptions } = options;
		const variableAxis = normalizeVariableAxis(requestedVariableAxis);
		const mergedOptions = {
			...defaultResolveOptions,
			...resolveOptions,
			...variableAxis ? { variableAxis } : {}
		};
		const errors = [];
		for await (const [id, provider] of initializeProviders(providers, errors)) try {
			const result = await provider.resolveFont(fontFamily, {
				...mergedOptions,
				options: mergedOptions.options?.[id]
			});
			if (result) {
				const { appliedVariableAxis, ...providerResult } = result;
				const { fonts, variableAxis: resolvedVariableAxis } = applyVariableAxis(result.fonts, variableAxis, appliedVariableAxis);
				reportErrors(errors, `Could not resolve font face for \`${fontFamily}\`.`, true);
				return {
					provider: id,
					...providerResult,
					...resolvedVariableAxis ? { variableAxis: resolvedVariableAxis } : {},
					fonts
				};
			}
		} catch (cause) {
			errors.push(new Error(`Could not resolve font face for \`${fontFamily}\` from \`${id}\` provider.`, { cause }));
		}
		reportErrors(errors, `Could not resolve font face for \`${fontFamily}\`.`, false);
		return { fonts: [] };
	}
	async function getFontProperties(fontFamily, providers = allProviders) {
		const errors = [];
		for await (const [id, provider] of initializeProviders(providers, errors)) try {
			const result = await provider.getFontProperties?.(fontFamily);
			if (result) {
				reportErrors(errors, `Could not get font properties for \`${fontFamily}\`.`, true);
				return {
					...result,
					provider: id
				};
			}
		} catch (cause) {
			errors.push(new Error(`Could not get font properties for \`${fontFamily}\` from \`${id}\` provider.`, { cause }));
		}
		reportErrors(errors, `Could not get font properties for \`${fontFamily}\`.`, false);
	}
	async function listFonts(providers = allProviders) {
		let names;
		const errors = [];
		for await (const [id, provider] of initializeProviders(providers, errors)) try {
			const result = await provider.listFonts?.();
			if (result) {
				names ??= [];
				names.push(...result);
			}
		} catch (cause) {
			errors.push(new Error(`Could not list names from \`${id}\` provider.`, { cause }));
		}
		reportErrors(errors, `Could not list names.`, false);
		return names;
	}
	return {
		resolveFont,
		getFontProperties,
		listFonts
	};
}
//#endregion
export { createUnifont, defaultResolveOptions, defineFontProvider, providers_exports as providers };
