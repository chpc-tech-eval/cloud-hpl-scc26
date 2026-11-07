import picomatch from "picomatch";
import { getCookiesFromResponse } from "../cookies/response.js";
import { REROUTABLE_STATUS_CODES } from "../constants.js";
import { AstroError } from "../errors/errors.js";
import { CacheQueryConfigConflict } from "../errors/errors-data.js";
/**
* Parse CDN-Cache-Control directives from a header value.
* Returns maxAge and swr in seconds.
*/
function parseCdnCacheControl(header) {
	let maxAge = 0;
	let swr = 0;
	if (!header) return {
		maxAge,
		swr
	};
	for (const part of header.split(",")) {
		const trimmed = part.trim().toLowerCase();
		if (trimmed.startsWith("max-age=")) {
			maxAge = Number.parseInt(trimmed.slice(8), 10) || 0;
		} else if (trimmed.startsWith("stale-while-revalidate=")) {
			swr = Number.parseInt(trimmed.slice(23), 10) || 0;
		}
	}
	return {
		maxAge,
		swr
	};
}
/**
* Parse Cache-Tag header into an array of tags.
*/
function parseCacheTags(header) {
	if (!header) return [];
	return header.split(",").map((t) => t.trim()).filter(Boolean);
}
/**
* Common tracking/analytics query parameters that are excluded from cache
* keys by default. These do not affect page content but create unnecessary
* cache fragmentation.
*
* Set `query.exclude` to `[]` to include all query parameters.
*/
const DEFAULT_EXCLUDED_PARAMS = [
	"utm_*",
	"fbclid",
	"gclid",
	"gbraid",
	"wbraid",
	"dclid",
	"msclkid",
	"twclid",
	"li_fat_id",
	"mc_cid",
	"mc_eid",
	"_ga",
	"_gl",
	"_hsenc",
	"_hsmi",
	"_ke",
	"oly_anon_id",
	"oly_enc_id",
	"rb_clickid",
	"s_cid",
	"vero_id",
	"wickedid",
	"yclid",
	"__s",
	"ref"
];
function normalizeQueryConfig(query) {
	if (query?.include && query?.exclude) {
		throw new AstroError(CacheQueryConfigConflict);
	}
	const sort = query?.sort !== false;
	const include = query?.include ?? null;
	// When `include` is set, exclude is irrelevant — only the allowlisted params matter.
	const excludePatterns = include ? [] : query?.exclude ?? DEFAULT_EXCLUDED_PARAMS;
	const excludeMatcher = excludePatterns.length > 0 ? picomatch(excludePatterns, { nocase: true }) : null;
	return {
		sort,
		include,
		excludeMatcher
	};
}
/**
* Build the query string portion of a cache key, applying sorting and filtering.
*/
function buildQueryString(url, config) {
	const params = new URLSearchParams(url.searchParams);
	// Filter: include mode (allowlist)
	if (config.include) {
		const allowed = new Set(config.include);
		for (const key of [...params.keys()]) {
			if (!allowed.has(key)) {
				params.delete(key);
			}
		}
	}
	// Filter: exclude mode (blocklist with globs)
	if (config.excludeMatcher) {
		for (const key of [...params.keys()]) {
			if (config.excludeMatcher(key)) {
				params.delete(key);
			}
		}
	}
	// Sort
	if (config.sort) {
		params.sort();
	}
	const qs = params.toString();
	return qs ? `?${qs}` : "";
}
function getCacheKey(url, queryConfig) {
	return `${url.origin}${url.pathname}${buildQueryString(url, queryConfig)}`;
}
function getPathFromCacheKey(key, queryConfig) {
	// Strip Vary suffix (everything after the first NUL separator)
	const urlPart = key.split("\0")[0];
	if (!URL.canParse(urlPart)) return null;
	const url = new URL(urlPart);
	return `${url.pathname}${buildQueryString(url, queryConfig)}`;
}
/** `set-cookie` is a response header and should never appear in Vary. */
const IGNORED_VARY_HEADERS = new Set(["set-cookie"]);
function getUncacheableVaryHeader(response) {
	const vary = response.headers.get("Vary");
	if (!vary) return undefined;
	for (const header of vary.split(",")) {
		const normalized = header.trim().toLowerCase();
		if (normalized === "cookie") return "Cookie";
		if (normalized === "*") return "*";
	}
	return undefined;
}
/**
* Parse the Vary header into an array of lowercased header names.
* Returns undefined if no Vary header or Vary: *
*/
function parseVaryHeader(response) {
	const vary = response.headers.get("Vary");
	if (!vary || vary.trim() === "*") return undefined;
	const headers = vary.split(",").map((h) => h.trim().toLowerCase()).filter((h) => h && !IGNORED_VARY_HEADERS.has(h));
	return headers.length > 0 ? headers : undefined;
}
/**
* Extract the values of Vary'd headers from a request.
*/
function getVaryValues(request, varyHeaders) {
	const values = Object.create(null);
	for (const header of varyHeaders) {
		values[header] = request.headers.get(header) ?? "";
	}
	return values;
}
/**
* Check whether a request matches the Vary'd header values stored in a cache entry.
*/
function matchesVary(request, entry) {
	if (!entry.vary || !entry.varyValues) return true;
	for (const header of entry.vary) {
		const requestValue = request.headers.get(header) ?? "";
		if (requestValue !== entry.varyValues[header]) return false;
	}
	return true;
}
function hasAtLeastOneCookie(cookies) {
	return cookies ? !cookies.headers().next().done : false;
}
/**
* Whether the router will replace this response with the rendered error page.
* Such responses are not cached: the cached copy has a non-null body, so a
* cache hit would skip the reroute and serve an empty body (#18456).
*/
function isErrorPageReroute(response) {
	return response.body === null && REROUTABLE_STATUS_CODES.includes(response.status);
}
function hasSetCookieHeader(response) {
	if (response.headers.has("set-cookie")) return true;
	return hasAtLeastOneCookie(getCookiesFromResponse(response));
}
function warnSkippedSetCookie(logger, url) {
	logger.warn(`Skipping cache for ${url.pathname}${url.search} because response includes Set-Cookie.`);
}
function warnSkippedVary(logger, url, header) {
	logger.warn(`Skipping cache for ${url.pathname}${url.search} because response includes Vary: ${header}.`);
}
/**
* Simple LRU cache backed by a Map (insertion-order iteration).
* When the cache exceeds `max` entries, the oldest entry is evicted.
*/
class LRUMap {
	#map = new Map();
	#max;
	constructor(max) {
		this.#max = max;
	}
	get(key) {
		const value = this.#map.get(key);
		if (value !== undefined) {
			// Move to end (most recently used)
			this.#map.delete(key);
			this.#map.set(key, value);
		}
		return value;
	}
	set(key, value) {
		if (this.#map.has(key)) {
			this.#map.delete(key);
		} else if (this.#map.size >= this.#max) {
			// Evict oldest (first inserted)
			const oldest = this.#map.keys().next().value;
			this.#map.delete(oldest);
		}
		this.#map.set(key, value);
	}
	delete(key) {
		return this.#map.delete(key);
	}
	values() {
		return this.#map.values();
	}
	keys() {
		return this.#map.keys();
	}
	get size() {
		return this.#map.size;
	}
}
/**
* Serialize a Response into a CachedEntry. Consumes the response body.
*
* Callers are responsible for cloning the response first if they still need to
* return it to the client (see the cache-miss path). In the SWR revalidation
* path, the stale response has already been sent so no clone is needed.
*/
async function serializeResponse(response, request, maxAge, swr, tags) {
	const body = await response.arrayBuffer();
	const headers = [];
	response.headers.forEach((value, key) => {
		if (key.toLowerCase() === "set-cookie") return;
		headers.push([key, value]);
	});
	const vary = parseVaryHeader(response);
	return {
		body,
		status: response.status,
		headers,
		storedAt: Date.now(),
		maxAge,
		swr,
		tags,
		vary,
		varyValues: vary ? getVaryValues(request, vary) : undefined
	};
}
/**
* Create a new Response from a CachedEntry.
*/
function createResponseFromCacheEntry(entry) {
	const headers = new Headers(entry.headers);
	return new Response(entry.body.slice(0), {
		status: entry.status,
		headers
	});
}
function isExpired(entry) {
	const age = (Date.now() - entry.storedAt) / 1e3;
	return age > entry.maxAge;
}
function isStale(entry) {
	const age = (Date.now() - entry.storedAt) / 1e3;
	return age > entry.maxAge && age <= entry.maxAge + entry.swr;
}
/**
* Build a Vary-aware cache key suffix from a request and a known set of Vary headers.
* Returns an empty string if there are no Vary headers.
*
* Uses NUL (`\0`) as the separator because it cannot appear in URLs or HTTP
* header values, so there's no risk of collisions with the primary key or
* between Vary'd values. This keeps the key as a flat string in the LRU map
* rather than needing a nested lookup structure.
*/
function buildVarySuffix(request, varyHeaders) {
	if (varyHeaders.length === 0) return "";
	const parts = [];
	for (const header of varyHeaders) {
		parts.push(`${header}=${request.headers.get(header) ?? ""}`);
	}
	return `\0${parts.join("\0")}`;
}
const memoryProvider = ((config) => {
	const max = config?.max ?? 1e3;
	const queryConfig = normalizeQueryConfig(config?.query);
	const cache = new LRUMap(max);
	/**
	* Maps a primary cache key (URL without Vary) to the set of Vary header names
	* learned from responses. This lets us build the correct Vary-aware key on
	* subsequent requests before we even look up the entry.
	*/
	const varyMap = new Map();
	return {
		name: "memory",
		async onRequest(context, next) {
			const requestUrl = new URL(context.request.url);
			// Only cache GET requests.
			if (context.request.method !== "GET") {
				return next();
			}
			const primaryKey = getCacheKey(requestUrl, queryConfig);
			// Build the full key including Vary'd header values if we know them
			const knownVary = varyMap.get(primaryKey);
			const varySuffix = knownVary ? buildVarySuffix(context.request, knownVary) : "";
			const key = primaryKey + varySuffix;
			const cached = cache.get(key);
			if (cached) {
				// Double-check Vary match (defensive — the key should already be correct)
				if (matchesVary(context.request, cached)) {
					if (!isExpired(cached)) {
						// Fresh cache hit
						const response = createResponseFromCacheEntry(cached);
						response.headers.set("X-Astro-Cache", "HIT");
						return response;
					}
					if (isStale(cached)) {
						// SWR: serve stale, trigger background revalidation.
						// The promise is intentionally not awaited — it runs in the
						// background on the long-lived server process and updates the
						// cache entry for subsequent requests.
						next().then(async (freshResponse) => {
							const cdnCC = freshResponse.headers.get("CDN-Cache-Control");
							const { maxAge: newMaxAge, swr: newSwr } = parseCdnCacheControl(cdnCC);
							if (newMaxAge > 0) {
								if (isErrorPageReroute(freshResponse)) {
									cache.delete(key);
									return;
								}
								if (hasSetCookieHeader(freshResponse)) {
									warnSkippedSetCookie(context.logger, requestUrl);
									return;
								}
								const uncacheableVary = getUncacheableVaryHeader(freshResponse);
								if (uncacheableVary) {
									cache.delete(key);
									warnSkippedVary(context.logger, requestUrl, uncacheableVary);
									return;
								}
								const newTags = parseCacheTags(freshResponse.headers.get("Cache-Tag"));
								const newEntry = await serializeResponse(freshResponse, context.request, newMaxAge, newSwr, newTags);
								// Update Vary map if the response changed its Vary headers
								if (newEntry.vary) {
									varyMap.set(primaryKey, newEntry.vary);
								}
								cache.set(key, newEntry);
							}
						}).catch((error) => {
							context.logger.warn(`Background revalidation failed for ${requestUrl.pathname}${requestUrl.search}: ${String(error)}`);
						});
						const response = createResponseFromCacheEntry(cached);
						response.headers.set("X-Astro-Cache", "STALE");
						return response;
					}
				}
			}
			// Cache miss — render fresh
			const response = await next();
			// Parse cache directives from the response headers set by _applyHeaders()
			const cdnCC = response.headers.get("CDN-Cache-Control");
			const { maxAge, swr } = parseCdnCacheControl(cdnCC);
			if (maxAge > 0) {
				if (isErrorPageReroute(response)) {
					return response;
				}
				if (hasSetCookieHeader(response)) {
					warnSkippedSetCookie(context.logger, requestUrl);
					return response;
				}
				const uncacheableVary = getUncacheableVaryHeader(response);
				if (uncacheableVary) {
					cache.delete(key);
					warnSkippedVary(context.logger, requestUrl, uncacheableVary);
					return response;
				}
				const tags = parseCacheTags(response.headers.get("Cache-Tag"));
				// Clone the response so we can read the body for caching and still return it
				const [forCache, forClient] = [response.clone(), response];
				const entry = await serializeResponse(forCache, context.request, maxAge, swr, tags);
				// Learn Vary headers from the response and build the storage key
				let storeKey = primaryKey;
				if (entry.vary) {
					varyMap.set(primaryKey, entry.vary);
					storeKey = primaryKey + buildVarySuffix(context.request, entry.vary);
				}
				cache.set(storeKey, entry);
				forClient.headers.set("X-Astro-Cache", "MISS");
				return forClient;
			}
			// No cache directives — pass through
			return response;
		},
		async invalidate(invalidateOptions) {
			if (invalidateOptions.path) {
				// Path invalidation is exact-match only (no glob/wildcard patterns)
				for (const key of [...cache.keys()]) {
					if (getPathFromCacheKey(key, queryConfig) === invalidateOptions.path) {
						cache.delete(key);
					}
				}
			}
			if (invalidateOptions.tags) {
				const tagsToInvalidate = Array.isArray(invalidateOptions.tags) ? invalidateOptions.tags : [invalidateOptions.tags];
				const tagsSet = new Set(tagsToInvalidate);
				// Iterate and delete entries whose tags overlap
				for (const key of [...cache.keys()]) {
					const entry = cache.get(key);
					if (entry && entry.tags.some((t) => tagsSet.has(t))) {
						cache.delete(key);
					}
				}
			}
		}
	};
});
export default memoryProvider;
