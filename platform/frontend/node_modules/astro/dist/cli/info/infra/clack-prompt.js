import { confirm } from "@clack/prompts";
export class ClackPrompt {
	#force;
	constructor({ force }) {
		this.#force = force;
	}
	async confirm({ message, defaultValue }) {
		if (this.#force) {
			return true;
		}
		const response = await confirm({
			message,
			initialValue: defaultValue,
			withGuide: false
		});
		// Response is a symbol when cancelled
		return response === true;
	}
}
