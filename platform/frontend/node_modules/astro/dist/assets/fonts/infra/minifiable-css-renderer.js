// TODO: consider making these public methods
export function renderFontFace(properties, minify) {
	// Line feed
	const lf = minify ? "" : `\n`;
	// Space
	const sp = minify ? "" : " ";
	return `@font-face${sp}{${lf}${Object.entries(properties).filter(([, value]) => Boolean(value)).map(([key, value]) => `${sp}${sp}${key}:${sp}${value};`).join(lf)}${lf}}${lf}`;
}
export function renderCssVariable(key, values, minify) {
	// Line feed
	const lf = minify ? "" : `\n`;
	// Space
	const sp = minify ? "" : " ";
	return `:root${sp}{${lf}${sp}${sp}${key}:${sp}${values.map((v) => handleValueWithSpaces(v)).join(`,${sp}`)};${lf}}${lf}`;
}
export function withFamily(family, properties) {
	return {
		"font-family": handleValueWithSpaces(family),
		...properties
	};
}
const SPACE_RE = /\s/;
/** If the value contains spaces (which would be incorrectly interpreted), we wrap it in quotes. */
export function handleValueWithSpaces(value) {
	if (SPACE_RE.test(value)) {
		return JSON.stringify(value);
	}
	return value;
}
export class MinifiableCssRenderer {
	#minify;
	constructor({ minify }) {
		this.#minify = minify;
	}
	generateFontFace(family, properties) {
		return renderFontFace(withFamily(family, properties), this.#minify);
	}
	generateCssVariable(key, values) {
		return renderCssVariable(key, values, this.#minify);
	}
}
