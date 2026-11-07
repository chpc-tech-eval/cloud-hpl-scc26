import * as toml from "smol-toml";
import { parseYaml } from "./yaml.js";
export function isFrontmatterValid(frontmatter) {
	try {
		// ensure frontmatter is JSON-serializable
		JSON.stringify(frontmatter);
	} catch {
		return false;
	}
	return typeof frontmatter === "object" && frontmatter !== null;
}
// Capture frontmatter wrapped with `---` or `+++` near the top of the file —
// either at the very start (allowing a BOM) or after leading whitespace, with
// the fence still starting on a new line.
const frontmatterRE = /(?:^\uFEFF?|^\s*\n)(?:---|\+\+\+)([\s\S]*?\n)(?:---|\+\+\+)/;
const frontmatterTypeRE = /(?:^\uFEFF?|^\s*\n)(---|\+\+\+)/;
export function extractFrontmatter(code) {
	return frontmatterRE.exec(code)?.[1];
}
function getFrontmatterParser(code) {
	return frontmatterTypeRE.exec(code)?.[1] === "+++" ? ["+++", (str) => structuredClone(toml.parse(str))] : ["---", parseYaml];
}
export function parseFrontmatter(code, options) {
	const rawFrontmatter = extractFrontmatter(code);
	if (rawFrontmatter == null) {
		return {
			frontmatter: {},
			rawFrontmatter: "",
			content: code
		};
	}
	const [delims, parser] = getFrontmatterParser(code);
	const parsed = parser(rawFrontmatter);
	const frontmatter = parsed && typeof parsed === "object" ? parsed : {};
	let content;
	switch (options?.frontmatter ?? "remove") {
		case "preserve":
			content = code;
			break;
		case "remove":
			content = code.replace(`${delims}${rawFrontmatter}${delims}`, "");
			break;
		case "empty-with-spaces":
			content = code.replace(`${delims}${rawFrontmatter}${delims}`, `   ${rawFrontmatter.replace(/[^\r\n]/g, " ")}   `);
			break;
		case "empty-with-lines":
			content = code.replace(`${delims}${rawFrontmatter}${delims}`, rawFrontmatter.replace(/[^\r\n]/g, ""));
			break;
	}
	return {
		frontmatter,
		rawFrontmatter,
		content
	};
}
