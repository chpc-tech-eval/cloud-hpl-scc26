export { isYAMLParseError } from "@astrojs/internal-helpers/yaml-error";
/**
* Get the line and character based on the offset
* @param offset The index of the position
* @param text The text for which the position should be retrieved
*/
export function positionAt(offset, text) {
	const lineOffsets = getLineOffsets(text);
	offset = Math.max(0, Math.min(text.length, offset));
	let low = 0;
	let high = lineOffsets.length;
	if (high === 0) {
		return {
			line: 0,
			column: offset
		};
	}
	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const lineOffset = lineOffsets[mid];
		if (lineOffset === offset) {
			return {
				line: mid,
				column: 0
			};
		} else if (offset > lineOffset) {
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}
	// low is the least x for which the line offset is larger than the current offset
	// or array.length if no line offset is larger than the current offset
	const line = low - 1;
	return {
		line,
		column: offset - lineOffsets[line]
	};
}
function getLineOffsets(text) {
	const lineOffsets = [];
	let isLineStart = true;
	for (let i = 0; i < text.length; i++) {
		if (isLineStart) {
			lineOffsets.push(i);
			isLineStart = false;
		}
		const ch = text.charAt(i);
		isLineStart = ch === "\r" || ch === "\n";
		if (ch === "\r" && i + 1 < text.length && text.charAt(i + 1) === "\n") {
			i++;
		}
	}
	if (isLineStart && text.length > 0) {
		lineOffsets.push(text.length);
	}
	return lineOffsets;
}
/** Format YAML exceptions as Vite errors */
export function formatYAMLParseError(e) {
	const position = e.linePos?.[0];
	const loc = position ? {
		line: position.line,
		column: position.col - 1
	} : undefined;
	return {
		name: e.name,
		loc,
		message: e.message,
		stack: e.stack ?? ""
	};
}
export function isTOMLError(err) {
	return err instanceof Error && err.name === "TomlError";
}
/** Format TOML exceptions as Vite errors */
export function formatTOMLError(e) {
	return {
		name: e.name,
		id: e.name,
		loc: {
			line: e.line + 1,
			column: e.column
		},
		message: e.message,
		stack: e.stack ?? ""
	};
}
/** Coalesce any throw variable to an Error instance. */
export function createSafeError(err) {
	if (err instanceof Error || err?.name && err.message) {
		return err;
	} else {
		const error = new Error(JSON.stringify(err));
		error.hint = `To get as much information as possible from your errors, make sure to throw Error objects instead of \`${typeof err}\`. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error for more information.`;
		return error;
	}
}
export function normalizeLF(code) {
	return code.replace(/\r\n|\r(?!\n)|\n/g, "\n");
}
