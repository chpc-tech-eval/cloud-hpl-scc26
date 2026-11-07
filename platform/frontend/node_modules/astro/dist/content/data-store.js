import * as devalue from "devalue";
import { InMemorySource } from "./data-store-source.js";
/**
* Rebuilds a collection from ordered parts containing newline-delimited
* `devalue.stringify([id, entry])` records.
*/
export class ChunkedCollectionParser {
	#entries = new Map();
	#remainder = "";
	add(part) {
		const content = this.#remainder + part;
		const records = content.split("\n");
		this.#remainder = records.pop();
		for (const record of records) {
			const parsed = devalue.parse(record);
			if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== "string") {
				throw new Error("Invalid chunked data store entry");
			}
			this.#entries.set(parsed[0], parsed[1]);
		}
	}
	finish() {
		if (this.#remainder) {
			throw new Error("Invalid chunked data store entry");
		}
		return this.#entries;
	}
}
/**
* A read-only data store for content collections. This is used to retrieve data from the content layer at runtime.
* To add or modify data, use {@link MutableDataStore} instead.
*/
export class ImmutableDataStore {
	_collections = new Map();
	constructor() {
		this._collections = new Map();
	}
	get(collectionName, key) {
		return this._collections.get(collectionName)?.get(String(key));
	}
	entries(collectionName) {
		const collection = this._collections.get(collectionName) ?? new Map();
		return [...collection.entries()];
	}
	values(collectionName) {
		const collection = this._collections.get(collectionName) ?? new Map();
		return [...collection.values()];
	}
	keys(collectionName) {
		const collection = this._collections.get(collectionName) ?? new Map();
		return [...collection.keys()];
	}
	has(collectionName, key) {
		const collection = this._collections.get(collectionName);
		if (collection) {
			return collection.has(String(key));
		}
		return false;
	}
	hasCollection(collectionName) {
		return this._collections.has(collectionName);
	}
	collections() {
		return this._collections;
	}
	/**
	* Rebuilds a collections map from a chunked-store manifest whose part file
	* names have already been swapped for their contents.
	*
	* Each collection maps to a list of parts. A part is either a raw string
	* (when the store is loaded from disk) or an ESM namespace from a virtual
	* chunk import (`{ default: string }`, when emitted at runtime). Each part
	* contains independently serialized entry records. This is the inverse of
	* {@link import('./data-store-writer.js').ChunkedWriter} and stays free of
	* Node built-ins so it can run at runtime.
	*/
	static manifestToMap(manifest) {
		const collections = new Map();
		for (const [collectionName, parts] of Object.entries(manifest)) {
			const parser = new ChunkedCollectionParser();
			for (const part of parts) {
				parser.add(typeof part === "string" ? part : part.default);
			}
			collections.set(collectionName, parser.finish());
		}
		return collections;
	}
	/**
	* Attempts to load a DataStore from the virtual module.
	* This only works in Vite.
	*/
	static async fromModule() {
		try {
			// @ts-expect-error - this is a virtual module
			const data = await import("astro:data-layer-content");
			if (data.default instanceof Map) {
				return ImmutableDataStore.fromMap(data.default);
			}
			// A single-file store is emitted as a devalue-flattened array.
			if (Array.isArray(data.default)) {
				const map = devalue.unflatten(data.default);
				return ImmutableDataStore.fromMap(map);
			}
			// A chunked store is emitted as a manifest object of collections to
			// their (lazily imported) serialized parts.
			const map = ImmutableDataStore.manifestToMap(data.default);
			return ImmutableDataStore.fromMap(map);
		} catch {}
		return new ImmutableDataStore();
	}
	static async fromMap(data) {
		const store = new ImmutableDataStore();
		store._collections = data;
		return store;
	}
}
function dataStoreSingleton() {
	let instance = undefined;
	return {
		get: async () => {
			if (!instance) {
				instance = ImmutableDataStore.fromModule().then((store) => new InMemorySource(store));
			}
			return instance;
		},
		// Note: currently unused, but kept for API stability.
		set: (store) => {
			instance = new InMemorySource(store);
		}
	};
}
/** @internal */
export const globalDataStore = dataStoreSingleton();
