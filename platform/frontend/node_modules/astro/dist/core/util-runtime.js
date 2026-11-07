/**
* Runtime-agnostic utility functions that can be used in any environment.
* These functions must not import Node.js modules.
*/
/** Returns true if argument is an object of any prototype/class (but not null). */
export function isObject(value) {
	return typeof value === "object" && value != null;
}
/** Cross-realm compatible URL */
export function isURL(value) {
	return Object.prototype.toString.call(value) === "[object URL]";
}
/** Wraps an object in an array. If an array is passed, ignore it. */
export function arraify(target) {
	return Array.isArray(target) ? target : [target];
}
export function padMultilineString(source, n = 2) {
	const lines = source.split(/\r?\n/);
	return lines.map((l) => ` `.repeat(n) + l).join(`\n`);
}
