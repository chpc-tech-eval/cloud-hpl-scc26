export class NpmPackageManager {
	name = "npm";
	#commandExecutor;
	constructor({ commandExecutor }) {
		this.#commandExecutor = commandExecutor;
	}
	async getPackageVersion(name) {
		try {
			// https://docs.npmjs.com/cli/v9/commands/npm-ls
			const { stdout } = await this.#commandExecutor.execute("npm", [
				"ls",
				name,
				"--json",
				"--depth=1"
			]);
			const parsedNpmOutput = JSON.parse(stdout);
			if (!parsedNpmOutput.dependencies) {
				return undefined;
			}
			if (parsedNpmOutput.dependencies[name]) {
				return `v${parsedNpmOutput.dependencies[name].version}`;
			}
			const astro = parsedNpmOutput.dependencies.astro;
			return astro ? `v${astro.dependencies[name].version}` : undefined;
		} catch {
			return undefined;
		}
	}
}
