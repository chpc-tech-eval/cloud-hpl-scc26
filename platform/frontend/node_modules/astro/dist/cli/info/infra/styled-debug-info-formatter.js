export class StyledDebugInfoFormatter {
	#textStyler;
	#maxPadding = 25;
	constructor({ textStyler }) {
		this.#textStyler = textStyler;
	}
	format(info) {
		let output = "";
		for (const [label, value] of info) {
			const padding = this.#maxPadding - label.length;
			const [first, ...rest] = Array.isArray(value) ? value : [value];
			let richtext = `\n${this.#textStyler.bold(label)}${" ".repeat(padding)}${this.#textStyler.green(first)}`;
			if (rest.length > 0) {
				for (const entry of rest) {
					richtext += `\n${" ".repeat(this.#maxPadding)}${this.#textStyler.green(entry)}`;
				}
			}
			output += richtext;
		}
		return output.trim();
	}
}
