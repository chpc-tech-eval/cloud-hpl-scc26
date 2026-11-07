import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import colors from "piccolore";
import { $ZodError } from "zod/v4/core";
import { eventConfigError, telemetry } from "../../events/index.js";
import { trackAstroConfigZodError } from "../errors/errors.js";
import { AstroError, AstroErrorData } from "../errors/index.js";
import { formatConfigErrorMessage } from "../messages/runtime.js";
import { mergeConfig } from "./merge.js";
import { validateConfig } from "./validate.js";
import { loadConfigWithVite } from "./vite-load.js";
export function resolveRoot(cwd) {
	if (cwd instanceof URL) {
		cwd = fileURLToPath(cwd);
	}
	return cwd ? path.resolve(cwd) : process.cwd();
}
// Config paths to search for.
// In order of likely appearance to speed up the check.
const configPaths = Object.freeze([
	"astro.config.mjs",
	"astro.config.js",
	"astro.config.ts",
	"astro.config.mts"
]);
async function search(fsMod, root) {
	const paths = configPaths.map((p) => path.join(root, p));
	for (const file of paths) {
		if (fsMod.existsSync(file)) {
			return file;
		}
	}
}
/**
* Resolve the file URL of the user's `astro.config.js|mjs|ts` file
*/
export async function resolveConfigPath(options) {
	let userConfigPath;
	if (options.configFile) {
		userConfigPath = path.join(options.root, options.configFile);
		if (!options.fs.existsSync(userConfigPath)) {
			throw new AstroError({
				...AstroErrorData.ConfigNotFound,
				message: AstroErrorData.ConfigNotFound.message(options.configFile)
			});
		}
	} else {
		userConfigPath = await search(options.fs, options.root);
	}
	return userConfigPath;
}
async function loadConfig(root, configFile, fsMod = fs) {
	if (configFile === false) return {};
	const configPath = await resolveConfigPath({
		root,
		configFile,
		fs: fsMod
	});
	if (!configPath) return {};
	// Create a vite server to load the config
	try {
		return await loadConfigWithVite({
			root,
			configPath,
			fs: fsMod
		});
	} catch (e) {
		const configPathText = configFile ? colors.bold(configFile) : "your Astro config";
		// Config errors should bypass log level as it breaks startup
		console.error(`${colors.bold(colors.red("[astro]"))} Unable to load ${configPathText}\n`);
		throw e;
	}
}
/**
* `AstroInlineConfig` is a union of `AstroUserConfig` and `AstroInlineOnlyConfig`.
* This functions splits it up.
*/
function splitInlineConfig(inlineConfig) {
	const { configFile, mode, logLevel, _logger, ...inlineUserConfig } = inlineConfig;
	return {
		inlineUserConfig,
		inlineOnlyConfig: {
			configFile,
			mode,
			logLevel,
			_logger
		}
	};
}
/**
* Resolves the Astro config with a given inline config.
*
* @param inlineConfig An inline config that takes highest priority when merging and resolving the final config.
* @param command The running command that uses this config. Usually 'dev' or 'build'.
*/
export async function resolveConfig(inlineConfig, command, fsMod = fs) {
	const root = resolveRoot(inlineConfig.root);
	const { inlineUserConfig, inlineOnlyConfig } = splitInlineConfig(inlineConfig);
	// If the root is specified, assign the resolved path so it takes the highest priority
	if (inlineConfig.root) {
		inlineUserConfig.root = root;
	}
	const userConfig = await loadConfig(root, inlineOnlyConfig.configFile, fsMod);
	const mergedConfig = mergeConfig(userConfig, inlineUserConfig);
	// First-Pass Validation
	let astroConfig;
	try {
		astroConfig = await validateConfig(mergedConfig, root, command);
	} catch (e) {
		// Improve config zod error messages
		if (e instanceof $ZodError) {
			// Mark this error so the callee can decide to suppress Zod's error if needed.
			// We still want to throw the error to signal an error in validation.
			trackAstroConfigZodError(e);
			console.error(formatConfigErrorMessage(e) + "\n");
			telemetry.record(eventConfigError({
				cmd: command,
				err: e,
				isFatal: true
			}));
		}
		throw e;
	}
	return {
		userConfig: mergedConfig,
		astroConfig
	};
}
