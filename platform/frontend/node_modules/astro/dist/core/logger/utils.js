import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isRelativePath } from "../path.js";
export const COMPOSE_LOGGER_ENTRYPOINT = "astro/logger/compose";
/**
* Normalizes a user-provided logger config by turning its `entrypoint` into a string that
* can be resolved as-is, either by Vite (see `vitePluginLogger`) or by Node
* (see `loadLoggerDestination`), and by applying the same treatment to the handlers
* composed through `astro/logger/compose`.
*
* Concretely, `URL` and relative entrypoints become absolute file paths — mirroring what
* session drivers do, since both Vite and `import()` can handle those — while any other
* string entrypoint, e.g. a package specifier, is left untouched.
*/
export function normalizeLoggerConfig(logger, root) {
	const entrypoint = normalizeEntrypoint(logger.entrypoint, root);
	if (entrypoint === COMPOSE_LOGGER_ENTRYPOINT) {
		const loggers = logger.config?.loggers ?? [];
		return {
			entrypoint,
			loggers: loggers.map((nested) => normalizeLoggerConfig(nested, root))
		};
	}
	return {
		entrypoint,
		config: logger.config
	};
}
function normalizeEntrypoint(entrypoint, root) {
	if (entrypoint instanceof URL) {
		return fileURLToPath(entrypoint);
	}
	// A relative specifier would otherwise be resolved against whichever module happens to
	// import it — astro core for `import()`, the importer passed to Vite's resolver — so it
	// is anchored to the project root instead, like every other path in the Astro config.
	if (isRelativePath(entrypoint)) {
		return resolve(fileURLToPath(root), entrypoint);
	}
	return entrypoint;
}
