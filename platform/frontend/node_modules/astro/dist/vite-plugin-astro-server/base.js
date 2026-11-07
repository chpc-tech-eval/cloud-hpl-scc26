import * as fs from "node:fs";
import path from "node:path";
import { appendForwardSlash, prependForwardSlash } from "@astrojs/internal-helpers/path";
import colors from "piccolore";
import { notFoundTemplate, subpathNotUsedTemplate } from "../template/4xx.js";
import { writeHtmlResponse } from "./response.js";
/**
* Computes the `devRoot` path used to match and strip the base prefix.
*
* The `devRoot` is the pathname portion of the base URL (resolved against the
* `site` if present, otherwise against `http://localhost`). For example:
* - `base: '/docs'`, no site → `/docs`
* - `base: '/docs'`, `site: 'https://example.com'` → `/docs`
* - `base: '/'` → `/`
*/
export function resolveDevRoot(base, site) {
	const effectiveBase = base || "/";
	const siteUrl = site ? new URL(effectiveBase, site) : undefined;
	const devRootURL = new URL(effectiveBase, "http://localhost");
	const devRoot = siteUrl ? siteUrl.pathname : devRootURL.pathname;
	const devRootReplacement = devRoot.endsWith("/") ? "/" : "";
	return {
		devRoot,
		devRootReplacement
	};
}
/**
* Pure decision function for base-URL dev-server rewriting.
*
* Evaluates whether the incoming `url` is the project's `base` path or lies
* under it at a path-segment boundary, and returns the action the middleware
* should take. The async `fs.stat` branch (checking `publicDir`) is
* represented as `check-public` and must be handled by the caller.
*/
export function evaluateBaseRewrite(url, pathname, acceptHeader, devRoot, devRootReplacement) {
	// Match only at path-segment boundaries so a base like `/s` doesn't
	// swallow unrelated requests such as `/src/...` (same policy as #17701).
	if (pathname === devRoot || pathname.startsWith(appendForwardSlash(devRoot))) {
		let newUrl = url.replace(devRoot, devRootReplacement);
		if (!newUrl.startsWith("/")) newUrl = prependForwardSlash(newUrl);
		return {
			action: "rewrite",
			newUrl
		};
	}
	if (pathname === "/" || pathname === "/index.html") {
		return {
			action: "not-found-subpath",
			pathname,
			devRoot
		};
	}
	if (acceptHeader?.includes("text/html")) {
		return {
			action: "not-found",
			pathname
		};
	}
	return { action: "check-public" };
}
export function baseMiddleware(settings, logger) {
	const { config } = settings;
	const { devRoot, devRootReplacement } = resolveDevRoot(config.base, config.site);
	return function devBaseMiddleware(req, res, next) {
		const url = req.url;
		let pathname;
		try {
			pathname = decodeURI(new URL(url, "http://localhost").pathname);
		} catch (e) {
			/* malformed uri */
			return next(e);
		}
		const decision = evaluateBaseRewrite(url, pathname, req.headers.accept, devRoot, devRootReplacement);
		switch (decision.action) {
			case "rewrite":
				req.url = decision.newUrl;
				return next();
			case "not-found-subpath": {
				const html = subpathNotUsedTemplate(decision.devRoot, decision.pathname);
				return writeHtmlResponse(res, 404, html);
			}
			case "not-found": {
				const html = notFoundTemplate(decision.pathname);
				return writeHtmlResponse(res, 404, html);
			}
			case "check-public": {
				const publicPath = new URL("." + req.url, config.publicDir);
				fs.stat(publicPath, (_err, stats) => {
					if (stats) {
						const publicDir = appendForwardSlash(path.posix.relative(config.root.pathname, config.publicDir.pathname));
						const devRootURL = new URL(devRoot, "http://localhost");
						const expectedLocation = new URL(devRootURL.pathname + url, devRootURL).pathname;
						logger.error("router", `Request URLs for ${colors.bold(publicDir)} assets must also include your base. "${expectedLocation}" expected, but received "${url}".`);
						const html = subpathNotUsedTemplate(devRoot, pathname);
						return writeHtmlResponse(res, 404, html);
					} else {
						next();
					}
				});
			}
		}
	};
}
