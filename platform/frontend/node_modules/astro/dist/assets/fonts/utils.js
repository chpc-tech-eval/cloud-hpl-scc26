import { FONT_TYPES, GENERIC_FALLBACK_NAMES } from "./constants.js";
/**
* Turns unifont font face data into generic CSS properties, to be consumed by the CSS renderer.
*/
export function unifontFontFaceDataToProperties(font) {
	return {
		src: font.src ? renderFontSrc(font.src) : undefined,
		"font-display": font.display ?? "swap",
		"unicode-range": font.unicodeRange?.length ? font.unicodeRange.join(",") : undefined,
		"font-weight": renderFontWeight(font.weight),
		"font-style": font.style,
		"font-stretch": font.stretch,
		"font-feature-settings": font.featureSettings,
		"font-variation-settings": font.variationSettings
	};
}
export function renderFontWeight(weight) {
	return Array.isArray(weight) ? weight.join(" ") : weight?.toString();
}
/**
* Turns unifont font face data src into a valid CSS property.
* Adapted from https://github.com/nuxt/fonts/blob/main/src/css/render.ts#L68-L81
*/
export function renderFontSrc(sources) {
	return sources.map((src) => {
		if ("name" in src) {
			return `local("${src.name}")`;
		}
		let rendered = `url("${src.url}")`;
		if (src.format) {
			rendered += ` format("${src.format}")`;
		}
		if (src.tech) {
			rendered += ` tech(${src.tech})`;
		}
		return rendered;
	}).join(", ");
}
const QUOTES_RE = /^["']|["']$/g;
/**
* Removes the quotes from a string. Used for family names
*/
export function withoutQuotes(str) {
	return str.trim().replace(QUOTES_RE, "");
}
export function isFontType(str) {
	return FONT_TYPES.includes(str);
}
export function isGenericFontFamily(str) {
	return GENERIC_FALLBACK_NAMES.includes(str);
}
export function dedupe(arr) {
	return [...new Set(arr)];
}
export function sortObjectByKey(unordered) {
	const ordered = Object.keys(unordered).sort().reduce((obj, key) => {
		const value = unordered[key];
		// @ts-expect-error Type 'T' is generic and can only be indexed for reading. That's fine here
		obj[key] = Array.isArray(value) ? value.map((v) => typeof v === "object" && v !== null ? sortObjectByKey(v) : v) : typeof value === "object" && value !== null ? sortObjectByKey(value) : value;
		return obj;
	}, {});
	return ordered;
}
