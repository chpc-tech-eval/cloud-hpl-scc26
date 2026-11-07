import { getPathByLocale } from "./index.js";
/**
* Compute fallback route for failed responses.
* Pure function - no APIContext, no Response objects, no URL objects.
*
* This function determines whether a failed request should be redirected or rewritten
* to a fallback locale based on the i18n configuration.
*/
export function computeFallbackRoute(options) {
	const { pathname, responseStatus, fallback, fallbackType, locales, defaultLocale, strategy } = options;
	// Only apply fallback for 404 status codes (page not found in this locale)
	if (responseStatus !== 404) {
		return { type: "none" };
	}
	// No fallback configured
	if (!fallback || Object.keys(fallback).length === 0) {
		return { type: "none" };
	}
	// Extract locale from pathname
	const segments = pathname.split("/");
	const urlLocale = segments.find((segment) => {
		for (const locale of locales) {
			if (typeof locale === "string") {
				if (locale === segment) {
					return true;
				}
			} else if (locale.path === segment) {
				return true;
			}
		}
		return false;
	});
	// No locale found in pathname
	if (!urlLocale) {
		return { type: "none" };
	}
	// Check if this locale has a fallback configured
	const fallbackKeys = Object.keys(fallback);
	if (!fallbackKeys.includes(urlLocale)) {
		return { type: "none" };
	}
	// Get the fallback locale
	const fallbackLocale = fallback[urlLocale];
	// Get the path for the fallback locale (handles granular locales)
	const pathFallbackLocale = getPathByLocale(fallbackLocale, locales);
	// Replace the locale segment by index so that earlier segments whose text
	// happens to contain the locale code as a substring are left alone (#17907).
	const localeIndex = segments.indexOf(urlLocale);
	let newPathname;
	// If fallback is to the default locale and strategy is prefix-other-locales,
	// remove the locale prefix (default locale has no prefix)
	if (pathFallbackLocale === defaultLocale && strategy === "pathname-prefix-other-locales") {
		segments.splice(localeIndex, 1);
		newPathname = segments.join("/") || "/";
	} else {
		// Replace the current locale with the fallback locale
		segments[localeIndex] = pathFallbackLocale;
		newPathname = segments.join("/");
	}
	return {
		type: fallbackType,
		pathname: newPathname
	};
}
