import { AstroError } from "../../errors/errors.js";
import { CacheNotEnabled } from "../../errors/errors-data.js";
import { defaultSetHeaders, isLiveDataEntry } from "./utils.js";
const APPLY_HEADERS = Symbol.for("astro:cache:apply");
const IS_ACTIVE = Symbol.for("astro:cache:active");
export class AstroCache {
	#options = {};
	#tags = new Set();
	#disabled = false;
	#provider;
	enabled = true;
	constructor(provider) {
		this.#provider = provider;
	}
	set(input) {
		if (input === false) {
			this.#disabled = true;
			this.#tags.clear();
			this.#options = {};
			return;
		}
		this.#disabled = false;
		// Extract CacheHint from LiveDataEntry
		let options;
		if (isLiveDataEntry(input)) {
			if (!input.cacheHint) return;
			options = input.cacheHint;
		} else {
			options = input;
		}
		// Merge scalars: last-write-wins
		if ("maxAge" in options && options.maxAge !== undefined) this.#options.maxAge = options.maxAge;
		if ("swr" in options && options.swr !== undefined) this.#options.swr = options.swr;
		if ("etag" in options && options.etag !== undefined) this.#options.etag = options.etag;
		// lastModified: most recent wins
		if (options.lastModified !== undefined) {
			if (!this.#options.lastModified || options.lastModified > this.#options.lastModified) {
				this.#options.lastModified = options.lastModified;
			}
		}
		// Tags: accumulate
		if (options.tags) {
			for (const tag of options.tags) this.#tags.add(tag);
		}
	}
	get tags() {
		return [...this.#tags];
	}
	/**
	* Get the current cache options (read-only snapshot).
	* Includes all accumulated options: maxAge, swr, tags, etag, lastModified.
	*/
	get options() {
		return {
			...this.#options,
			tags: this.tags
		};
	}
	async invalidate(input) {
		if (!this.#provider) {
			throw new AstroError(CacheNotEnabled);
		}
		let options;
		if (isLiveDataEntry(input)) {
			options = { tags: input.cacheHint?.tags ?? [] };
		} else {
			options = input;
		}
		return this.#provider.invalidate(options);
	}
	/** @internal */
	[APPLY_HEADERS](response, request) {
		if (this.#disabled) return;
		const finalOptions = {
			...this.#options,
			tags: this.tags
		};
		if (finalOptions.maxAge === undefined && !finalOptions.tags?.length) return;
		const headers = this.#provider?.setHeaders?.(finalOptions, request) ?? defaultSetHeaders(finalOptions);
		for (const [key, value] of headers) {
			response.headers.set(key, value);
		}
		if (!response.headers.has("Cache-Control") && !response.headers.has("Expires") && (response.headers.has("Last-Modified") || response.headers.has("ETag"))) {
			// `no-cache` requires revalidation before a stored response is reused.
			// https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#no-cache
			response.headers.set("Cache-Control", "no-cache");
		}
	}
	/** @internal */
	get [IS_ACTIVE]() {
		return !this.#disabled && (this.#options.maxAge !== undefined || this.#tags.size > 0);
	}
}
// ─── Framework-internal helpers (not exported from the `astro` package) ─────
/**
* Apply cache headers to a response.
*/
export function applyCacheHeaders(cache, response, request) {
	if (APPLY_HEADERS in cache) {
		cache[APPLY_HEADERS](response, request);
	}
}
/**
* Check whether the cache has any active state worth acting on.
*/
export function isCacheActive(cache) {
	if (IS_ACTIVE in cache) {
		return cache[IS_ACTIVE];
	}
	return false;
}
