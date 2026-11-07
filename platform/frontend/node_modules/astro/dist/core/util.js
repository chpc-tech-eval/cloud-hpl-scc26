import { fileURLToPath } from "node:url";
import { hasSpecialQueries } from "../vite-plugin-utils/index.js";
import { SUPPORTED_MARKDOWN_FILE_EXTENSIONS } from "./constants.js";
import { removeQueryString, slash } from "./path.js";
/** Check if a file is a markdown file based on its extension */
export function isMarkdownFile(fileId, option) {
	if (hasSpecialQueries(fileId)) {
		return false;
	}
	const id = removeQueryString(fileId);
	const _suffix = option?.suffix ?? "";
	for (let markdownFileExtension of SUPPORTED_MARKDOWN_FILE_EXTENSIONS) {
		if (id.endsWith(`${markdownFileExtension}${_suffix}`)) return true;
	}
	return false;
}
/** is a specifier an npm package? */
export function parseNpmName(spec) {
	// not an npm package
	if (!spec || spec[0] === "." || spec[0] === "/") return undefined;
	let scope;
	let name = "";
	let parts = spec.split("/");
	if (parts[0][0] === "@") {
		scope = parts[0];
		name = parts.shift() + "/";
	}
	name += parts.shift();
	let subpath = parts.length ? `./${parts.join("/")}` : undefined;
	return {
		scope,
		name,
		subpath
	};
}
/**
* Convert file URL to ID for environment.moduleGraph.idToModuleMap.get(:viteID)
* Format:
*   Linux/Mac:  /Users/astro/code/my-project/src/pages/index.astro
*   Windows:    C:/Users/astro/code/my-project/src/pages/index.astro
*/
export function viteID(filePath) {
	return slash(fileURLToPath(filePath) + filePath.search);
}
export const VALID_ID_PREFIX = `/@id/`;
const NULL_BYTE_PLACEHOLDER = `__x00__`;
const NULL_BYTE_REGEX = /^\0/;
// Strip valid id prefix and replace null byte placeholder. Both are prepended to resolved ids
// as they are not valid browser import specifiers (by the Vite's importAnalysis plugin)
export function unwrapId(id) {
	return id.startsWith(VALID_ID_PREFIX) ? id.slice(VALID_ID_PREFIX.length).replace(NULL_BYTE_PLACEHOLDER, "\0") : id;
}
// Reverses `unwrapId` function
export function wrapId(id) {
	return id.replace(NULL_BYTE_REGEX, `${VALID_ID_PREFIX}${NULL_BYTE_PLACEHOLDER}`);
}
export function resolvePages(config) {
	return new URL("./pages", config.srcDir);
}
function isInPagesDir(file, config) {
	const pagesDir = `${resolvePages(config).toString()}/`;
	return file.toString().startsWith(pagesDir);
}
function isInjectedRoute(file, settings) {
	let fileURL = file.toString();
	for (const route of settings.resolvedInjectedRoutes) {
		if (route.resolvedEntryPoint && removeQueryString(fileURL) === removeQueryString(route.resolvedEntryPoint.toString())) return true;
	}
	return false;
}
function isPublicRoute(file, config) {
	const rootDir = config.root.toString();
	const pagesDir = resolvePages(config).toString();
	const fileDir = file.toString();
	// Normalize the file directory path by removing the pagesDir prefix if it exists,
	// otherwise remove the rootDir prefix.
	const normalizedDir = fileDir.startsWith(pagesDir) ? fileDir.slice(pagesDir.length) : fileDir.slice(rootDir.length);
	const parts = normalizedDir.replace(pagesDir.toString(), "").split("/").slice(1);
	for (const part of parts) {
		if (part.startsWith("_")) return false;
	}
	return true;
}
function endsWithPageExt(file, settings) {
	for (const ext of settings.pageExtensions) {
		if (file.toString().endsWith(ext)) return true;
	}
	return false;
}
export function isPage(file, settings) {
	if (!isInPagesDir(file, settings.config) && !isInjectedRoute(file, settings)) return false;
	if (!isPublicRoute(file, settings.config)) return false;
	return endsWithPageExt(file, settings);
}
export function isEndpoint(file, settings) {
	if (!isInPagesDir(file, settings.config) && !isInjectedRoute(file, settings)) return false;
	if (!isPublicRoute(file, settings.config)) return false;
	return !endsWithPageExt(file, settings) && !file.toString().includes("?astro");
}
/**
* Set a default NODE_ENV so Vite doesn't set an incorrect default when loading the Astro config
*/
export function ensureProcessNodeEnv(defaultNodeEnv) {
	if (!process.env.NODE_ENV) {
		process.env.NODE_ENV = defaultNodeEnv;
	}
}
