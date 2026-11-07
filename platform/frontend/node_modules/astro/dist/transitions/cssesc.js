/* eslint-disable regexp/control-character-escape */
/* eslint-disable no-control-regex */
/* eslint-disable regexp/no-optional-assertion */
/* eslint-disable regexp/no-useless-escape */
/* eslint-disable regexp/no-obscure-range */
// ESM vendored version of cssesc: https://github.com/mathiasbynens/cssesc/blob/cb894eb42f27c8d3cd793f16afe35b3ab38000a1/cssesc.js
// See https://github.com/withastro/astro/pull/15669
const regexAnySingleEscape = /[ -,\.\/:-@\[-\^`\{-~]/;
const regexSingleEscape = /[ -,\.\/:-@\[\]\^`\{-~]/;
const regexExcessiveSpaces = /(^|\\+)?(\\[A-F0-9]{1,6})\x20(?![a-fA-F0-9\x20])/g;
const DEFAULT_OPTIONS = {
	escapeEverything: false,
	isIdentifier: false,
	quotes: "single",
	wrap: false
};
export default function cssesc(string, options = {}) {
	options = {
		...DEFAULT_OPTIONS,
		...options
	};
	const quote = options.quotes === "double" ? "\"" : "'";
	const { isIdentifier } = options;
	const firstChar = string.charAt(0);
	let output = "";
	let counter = 0;
	const length = string.length;
	while (counter < length) {
		const character = string.charAt(counter++);
		let codePoint = character.charCodeAt(0);
		let value;
		// If it’s not a printable ASCII character…
		if (codePoint < 32 || codePoint > 126) {
			if (codePoint >= 55296 && codePoint <= 56319 && counter < length) {
				// It’s a high surrogate, and there is a next character.
				const extra = string.charCodeAt(counter++);
				if ((extra & 64512) === 56320) {
					// next character is low surrogate
					codePoint = ((codePoint & 1023) << 10) + (extra & 1023) + 65536;
				} else {
					// It’s an unmatched surrogate; only append this code unit, in case
					// the next code unit is the high surrogate of a surrogate pair.
					counter--;
				}
			}
			value = "\\" + codePoint.toString(16).toUpperCase() + " ";
		} else {
			if (options.escapeEverything) {
				if (regexAnySingleEscape.test(character)) {
					value = "\\" + character;
				} else {
					value = "\\" + codePoint.toString(16).toUpperCase() + " ";
				}
			} else if (/[\t\n\f\r\x0B]/.test(character)) {
				value = "\\" + codePoint.toString(16).toUpperCase() + " ";
			} else if (character === "\\" || !isIdentifier && (character === "\"" && quote === character || character === "'" && quote === character) || isIdentifier && regexSingleEscape.test(character)) {
				value = "\\" + character;
			} else {
				value = character;
			}
		}
		output += value;
	}
	if (isIdentifier) {
		if (/^-[-\d]/.test(output)) {
			output = "\\-" + output.slice(1);
		} else if (/\d/.test(firstChar)) {
			output = "\\3" + firstChar + " " + output.slice(1);
		}
	}
	// Remove spaces after `\HEX` escapes that are not followed by a hex digit,
	// since they’re redundant. Note that this is only possible if the escape
	// sequence isn’t preceded by an odd number of backslashes.
	output = output.replace(regexExcessiveSpaces, function($0, $1, $2) {
		if ($1 && $1.length % 2) {
			// It’s not safe to remove the space, so don’t.
			return $0;
		}
		// Strip the space.
		return ($1 || "") + $2;
	});
	if (!isIdentifier && options.wrap) {
		return quote + output + quote;
	}
	return output;
}
