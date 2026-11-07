import { isRemoteAllowed } from "@astrojs/internal-helpers/remote";
/**
* Recursively follows HTTP redirects with validation according to the image configuration.
*
* If any of the domains in the redirect chain are not allowed by either `image.remotePatterns`
* or `image.domains`, this function will throw an error for a disallowed redirect.
*
* @param options The options for this fetch call.
*/
export async function fetchWithRedirects(options) {
	const { url, headers, imageConfig, fetchFn = globalThis.fetch, redirectLimit = 10, onMaxRedirectsExceeded = (_u) => new Error("Maximum redirect depth exceeded"), onMissingLocationHeader = (_s, _u) => new Error(`Redirect response ${_s} missing Location header`), onDisallowedRedirect = (_current, _target) => new Error(`The image at ${_current} redirected to ${_target}, which is not an allowed remote location.`) } = options;
	if (redirectLimit <= 0) {
		throw onMaxRedirectsExceeded(typeof url === "string" ? url : url.toString());
	}
	const urlString = typeof url === "string" ? url : url.toString();
	const req = new Request(url, { headers });
	const res = await fetchFn(req, { redirect: "manual" });
	// Handle redirects (301, 302, 303, 307, 308 are actual redirects, not 304 Not Modified)
	if ([
		301,
		302,
		303,
		307,
		308
	].includes(res.status)) {
		const location = res.headers.get("Location");
		if (!location) {
			throw onMissingLocationHeader(res.status, urlString);
		}
		// Resolve the redirect URL relative to the current URL
		const redirectUrl = new URL(location, urlString).toString();
		// Validate that the redirect target matches allowed patterns
		if (!isRemoteAllowed(redirectUrl, {
			domains: imageConfig.domains ?? [],
			remotePatterns: imageConfig.remotePatterns ?? []
		})) {
			throw onDisallowedRedirect(urlString, redirectUrl);
		}
		// Recursively follow the redirect
		return fetchWithRedirects({
			url: redirectUrl,
			headers,
			imageConfig,
			fetchFn,
			redirectLimit: redirectLimit - 1,
			onMaxRedirectsExceeded,
			onMissingLocationHeader,
			onDisallowedRedirect
		});
	}
	return res;
}
