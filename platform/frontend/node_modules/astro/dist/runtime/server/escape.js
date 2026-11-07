import { streamAsyncIterator } from "./util.js";
const ESCAPABLE = /[&<>'"]/g;
function entityFor(code) {
	switch (code) {
		case 38: return "&amp;";
		case 60: return "&lt;";
		case 62: return "&gt;";
		case 39: return "&#39;";
		default: return "&quot;";
	}
}
export function escapeHTML(value) {
	ESCAPABLE.lastIndex = 0;
	if (!ESCAPABLE.test(value)) return value;
	let output = "";
	let last = 0;
	do {
		const index = ESCAPABLE.lastIndex - 1;
		if (last !== index) output += value.slice(last, index);
		output += entityFor(value.charCodeAt(index));
		last = index + 1;
	} while (ESCAPABLE.test(value));
	return last === value.length ? output : output + value.slice(last);
}
/**
* Serializes a value to a JSON string that is safe to embed inside a `<script>` tag.
* All `<` characters are escaped to `\u003c` so the browser's HTML parser cannot be
* tricked into closing the script block early via `<\/script>` variants (case-insensitive,
* whitespace, or self-closing forms) or `<!--` comment injection.
* @see https://mathiasbynens.be/notes/etago
*/
export function stringifyForScript(value) {
	return JSON.stringify(value)?.replace(/</g, "\\u003c");
}
/** Escapes CSS text so it can be embedded inside a `<style>` tag. */
export function escapeStyleText(value) {
	return value.replaceAll("<", "\\3C ");
}
export class HTMLBytes extends Uint8Array {}
// TypeScript won't let us define this in the class body so have to do it
// this way. Boo.
Object.defineProperty(HTMLBytes.prototype, Symbol.toStringTag, { get() {
	return "HTMLBytes";
} });
const htmlStringSymbol = Symbol.for("astro:html-string");
/**
* A "blessed" extension of String that tells Astro that the string
* has already been escaped. This helps prevent double-escaping of HTML.
*/
export class HTMLString extends String {}
Object.defineProperty(HTMLString.prototype, htmlStringSymbol, { value: true });
/**
* markHTMLString marks a string as raw or "already escaped" by returning
* a `HTMLString` instance. This is meant for internal use, and should not
* be returned through any public JS API.
*/
export const markHTMLString = (value) => {
	// If value is already marked as an HTML string, there is nothing to do.
	if (isHTMLString(value)) {
		return value;
	}
	// Cast to `HTMLString` to mark the string as valid HTML. Any HTML escaping
	// and sanitization should have already happened to the `value` argument.
	// NOTE: `unknown as string` is necessary for TypeScript to treat this as `string`
	if (typeof value === "string") {
		return new HTMLString(value);
	}
	// Return all other values (`number`, `null`, `undefined`) as-is.
	// The compiler will recursively stringify these correctly at a later stage.
	return value;
};
export function isHTMLString(value) {
	return typeof value === "object" && value !== null && value[htmlStringSymbol] === true;
}
function markHTMLBytes(bytes) {
	return new HTMLBytes(bytes);
}
export function isHTMLBytes(value) {
	return Object.prototype.toString.call(value) === "[object HTMLBytes]";
}
function hasGetReader(obj) {
	return typeof obj.getReader === "function";
}
async function* unescapeChunksAsync(iterable) {
	if (hasGetReader(iterable)) {
		for await (const chunk of streamAsyncIterator(iterable)) {
			yield unescapeHTML(chunk);
		}
	} else {
		for await (const chunk of iterable) {
			yield unescapeHTML(chunk);
		}
	}
}
function* unescapeChunks(iterable) {
	for (const chunk of iterable) {
		yield unescapeHTML(chunk);
	}
}
export function unescapeHTML(str) {
	if (!!str && typeof str === "object") {
		if (str instanceof Uint8Array) {
			return markHTMLBytes(str);
		} else if (str instanceof Response && str.body) {
			const body = str.body;
			return unescapeChunksAsync(body);
		} else if (typeof str.then === "function") {
			return Promise.resolve(str).then((value) => {
				return unescapeHTML(value);
			});
		} else if (str[Symbol.for("astro:slot-string")]) {
			return str;
		} else if (Symbol.iterator in str) {
			return unescapeChunks(str);
		} else if (Symbol.asyncIterator in str || hasGetReader(str)) {
			return unescapeChunksAsync(str);
		}
	}
	return markHTMLString(str);
}
