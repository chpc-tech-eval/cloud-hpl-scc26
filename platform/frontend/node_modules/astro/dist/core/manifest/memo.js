export function createManifestMemo(derive) {
	const cache = new WeakMap();
	return {
		get(manifest) {
			// `has` rather than `get ?? compute` so derivations that legitimately
			// produce `undefined` (e.g. `getSite` without a configured site) are
			// still cached.
			if (cache.has(manifest)) {
				return cache.get(manifest);
			}
			const value = derive(manifest);
			cache.set(manifest, value);
			return value;
		},
		has(manifest) {
			return cache.has(manifest);
		},
		set(manifest, value) {
			cache.set(manifest, value);
		},
		invalidate(manifest) {
			cache.delete(manifest);
		}
	};
}
/**
* Caches the PROMISE (single-flight: concurrent callers share one derivation).
* On rejection the entry is DELETED so the next call retries a failed lazy
* resolve instead of caching the failure forever.
*/
export function createAsyncManifestMemo(derive) {
	const cache = new WeakMap();
	return {
		get(manifest) {
			let promise = cache.get(manifest);
			if (!promise) {
				promise = derive(manifest);
				cache.set(manifest, promise);
				promise.catch(() => {
					// Only delete if the entry wasn't already replaced/invalidated.
					if (cache.get(manifest) === promise) {
						cache.delete(manifest);
					}
				});
			}
			return promise;
		},
		invalidate(manifest) {
			cache.delete(manifest);
		}
	};
}
