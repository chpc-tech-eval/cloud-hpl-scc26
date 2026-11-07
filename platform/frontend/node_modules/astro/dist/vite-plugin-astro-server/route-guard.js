import * as fs from "node:fs";
import { notFoundTemplate } from "../template/4xx.js";
import { writeHtmlResponse } from "./response.js";
// Vite internal prefixes that should always be allowed through
const VITE_INTERNAL_PREFIXES = [
	"/@vite/",
	"/@fs/",
	"/@id/",
	"/__vite",
	"/@react-refresh",
	"/node_modules/",
	"/.astro/"
];
/**
* Pure decision function for the route guard middleware.
*
* Determines whether a request should be blocked (file exists at project root
* but outside srcDir/publicDir) or allowed through. The filesystem lookups are
* injected via `fsInfo` so this function remains pure and unit-testable.
*/
export function evaluateRouteGuard(url, acceptHeader, fsInfo) {
	// Only intercept requests that look like browser navigation (HTML requests)
	if (!acceptHeader.includes("text/html")) {
		return { action: "next" };
	}
	let pathname;
	try {
		pathname = decodeURI(new URL(url, "http://localhost").pathname);
	} catch {
		// Malformed URI, let other middleware handle it
		return { action: "next" };
	}
	// Always allow Vite internal paths through
	if (VITE_INTERNAL_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
		return { action: "next" };
	}
	// Always allow requests with query params (Vite transform requests like ?url, ?raw)
	if (url.includes("?")) {
		return { action: "next" };
	}
	// Allow if file exists in publicDir or srcDir
	if (fsInfo.existsInPublic || fsInfo.existsInSrc) {
		return { action: "next" };
	}
	// Block files that exist at project root but not in srcDir or publicDir
	// Directories are allowed — they may share names with valid page routes
	if (fsInfo.existsAtRootAsFile) {
		return {
			action: "block",
			pathname
		};
	}
	// File doesn't exist anywhere, let other middleware handle it
	return { action: "next" };
}
/**
* Middleware that prevents Vite from serving files that exist outside
* of srcDir and publicDir when accessed via direct URL navigation.
*
* This fixes the issue where files like /README.md are served
* when they exist at the project root but aren't part of Astro's routing.
*/
export function routeGuardMiddleware(settings) {
	const { config } = settings;
	return function devRouteGuard(req, res, next) {
		const url = req.url;
		if (!url) {
			return next();
		}
		const accept = req.headers.accept || "";
		let pathname;
		try {
			pathname = decodeURI(new URL(url, "http://localhost").pathname);
		} catch {
			return next();
		}
		const resolved = new URL("." + pathname, config.root);
		const fsInfo = {
			existsInPublic: resolved.pathname.startsWith(config.publicDir.pathname) && fs.existsSync(resolved),
			existsInSrc: resolved.pathname.startsWith(config.srcDir.pathname) && fs.existsSync(resolved),
			existsAtRootAsFile: false
		};
		// Only check root filesystem for non-Vite, non-query, HTML requests
		// (the pure function handles the early returns for those cases)
		if (accept.includes("text/html") && !url.includes("?") && !VITE_INTERNAL_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
			try {
				const stat = fs.statSync(new URL("." + pathname, config.root));
				fsInfo.existsAtRootAsFile = stat.isFile();
			} catch {}
		}
		const decision = evaluateRouteGuard(url, accept, fsInfo);
		switch (decision.action) {
			case "block": {
				const html = notFoundTemplate(decision.pathname);
				return writeHtmlResponse(res, 404, html);
			}
			case "next": return next();
		}
	};
}
