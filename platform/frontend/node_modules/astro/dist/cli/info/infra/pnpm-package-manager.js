function formatPnpmVersionOutput(versionOutput) {
	return versionOutput.startsWith("link:") ? "Local" : `v${versionOutput}`;
}
export class PnpmPackageManager {
	name = "pnpm";
	#commandExecutor;
	constructor({ commandExecutor }) {
		this.#commandExecutor = commandExecutor;
	}
	async getPackageVersion(name) {
		try {
			// https://pnpm.io/cli/why
			const { stdout } = await this.#commandExecutor.execute("pnpm", [
				"why",
				name,
				"--json"
			]);
			const parsedOutput = JSON.parse(stdout);
			const deps = parsedOutput[0].dependencies;
			if (parsedOutput.length === 0 || !deps) {
				return undefined;
			}
			const userProvidedDependency = deps[name];
			if (userProvidedDependency) {
				return formatPnpmVersionOutput(userProvidedDependency.version);
			}
			const astroDependency = deps.astro?.dependencies[name];
			return astroDependency ? formatPnpmVersionOutput(astroDependency.version) : undefined;
		} catch {
			return undefined;
		}
	}
}
