import { STATUS_CODE_PAGES } from "./constants.js";
import { removeTrailingForwardSlash } from "./path.js";
export function getOutputFilename(buildFormat, name, routeData) {
	if (routeData.type === "endpoint") {
		return name;
	}
	if (name === "/" || name === "") {
		return name === "" ? "index.html" : "/index.html";
	}
	if (buildFormat === "file" || STATUS_CODE_PAGES.has(name)) {
		return `${removeTrailingForwardSlash(name || "index")}.html`;
	}
	if (buildFormat === "preserve" && !routeData.isIndex) {
		return `${removeTrailingForwardSlash(name || "index")}.html`;
	}
	return `${removeTrailingForwardSlash(name)}/index.html`;
}
