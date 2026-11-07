import { readFileSync, existsSync } from "node:fs";
import { join, normalize } from "node:path";
import { readTsconfig } from "get-tsconfig";
import { parse as parseJsonc } from "jsonc-parser";
export const defaultTSConfig = { extends: "astro/tsconfigs/base" };
// The following presets unfortunately cannot be inside the specific integrations, as we need
// them even in cases where the integrations are not installed
export const presets = new Map([
	["vue", { compilerOptions: { jsx: "preserve" } }],
	["react", { compilerOptions: {
		jsx: "react-jsx",
		jsxImportSource: "react"
	} }],
	["preact", { compilerOptions: {
		jsx: "react-jsx",
		jsxImportSource: "preact"
	} }],
	["solid-js", { compilerOptions: {
		jsx: "preserve",
		jsxImportSource: "solid-js"
	} }]
]);
/**
* Load a tsconfig.json or jsconfig.json if the former is not found.
* @param root The directory to search in, defaults to `process.cwd()`.
*/
export async function loadTSConfig(root) {
	const safeCwd = root || process.cwd();
	let tsconfigPath;
	// Find the json file path. Prefer tsconfig.json over jsconfig.json.
	for (const configName of ["tsconfig.json", "jsconfig.json"]) {
		const possiblePath = join(safeCwd, configName);
		if (existsSync(possiblePath)) {
			tsconfigPath = possiblePath;
			break;
		}
	}
	if (!tsconfigPath) {
		return { error: "missing-config" };
	}
	// Read the raw json file
	let rawConfig;
	try {
		const text = readFileSync(tsconfigPath, "utf-8");
		const errors = [];
		const parsed = parseJsonc(text, errors, { allowTrailingComma: true });
		if (errors.length > 0) {
			const first = errors[0];
			return {
				error: "invalid-config",
				message: `Failed to parse ${tsconfigPath}: Malformed JSONC (error code ${first.error}) at offset ${first.offset}`
			};
		}
		rawConfig = parsed;
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return {
			error: "invalid-config",
			message: `Failed to parse ${tsconfigPath}: ${message}`
		};
	}
	if (!rawConfig) {
		return {
			error: "invalid-config",
			message: `Failed to parse ${tsconfigPath}: Unknown error`
		};
	}
	// Resolve the tsconfig via `extends`
	let resolved;
	try {
		resolved = readTsconfig(tsconfigPath);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return {
			error: "invalid-config",
			message: `Failed to resolve ${tsconfigPath}: ${message}`
		};
	}
	return {
		tsconfigFile: normalize(resolved.path),
		tsconfig: resolved.config,
		rawConfig,
		sources: (resolved.sources || [resolved.path]).map(normalize)
	};
}
export function updateTSConfigForFramework(target, framework) {
	if (!presets.has(framework)) {
		return target;
	}
	return deepMergeObjects(target, presets.get(framework));
}
// Simple deep merge implementation that merges objects and strings
function deepMergeObjects(a, b) {
	const merged = { ...a };
	for (const key in b) {
		const value = b[key];
		if (a[key] == null) {
			merged[key] = value;
			continue;
		}
		if (typeof a[key] === "object" && typeof value === "object") {
			merged[key] = deepMergeObjects(a[key], value);
			continue;
		}
		merged[key] = value;
	}
	return merged;
}
