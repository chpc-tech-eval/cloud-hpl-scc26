import { promises as fs } from "node:fs";
import * as devalue from "devalue";
import xxhash from "xxhash-wasm";
import { emptyDir } from "../core/fs/index.js";
import { DATA_STORE_MANIFEST_FILE } from "./consts.js";
/**
* Sort collections and their entries by key.
*
* Entry insertion order can vary between builds due to concurrent file
* processing (pLimit), so sorting here guarantees stable output regardless of
* processing order. Stable output keeps serialized strings (and the content
* hashes derived from them) deterministic across builds.
*/
function sortCollections(collections) {
	return new Map([...collections.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, collection]) => [key, new Map([...collection.entries()].sort(([a], [b]) => a.localeCompare(b)))]));
}
/**
* Serialize collections to a deterministic devalue string.
*/
export function serializeDataStore(collections) {
	return devalue.stringify(sortCollections(collections));
}
/**
* Finds the end of the largest UTF-8-safe slice beginning at `startIndex` that
* fits within `maxBytes`. A code point larger than `maxBytes` is returned on
* its own so callers always make progress.
*/
function getChunkEnd(str, startIndex, maxBytes) {
	let index = startIndex;
	let bytes = 0;
	while (index < str.length) {
		const codePoint = str.codePointAt(index);
		const charLength = codePoint > 65535 ? 2 : 1;
		// UTF-8 width from the code point. Encoding one character at a time through
		// TextEncoder gives the same answer but dominates sync time on large stores.
		// A lone surrogate lands in the 3-byte branch, matching the U+FFFD that
		// TextEncoder would substitute for it.
		const charBytes = codePoint < 128 ? 1 : codePoint < 2048 ? 2 : codePoint < 65536 ? 3 : 4;
		if (bytes + charBytes > maxBytes && index > startIndex) {
			break;
		}
		index += charLength;
		bytes += charBytes;
		if (bytes >= maxBytes) {
			break;
		}
	}
	return {
		endIndex: index,
		bytes
	};
}
/**
* Split a string into parts each at most `maxBytes` UTF-8 bytes, never splitting
* a Unicode code point across parts.
*
* The store is serialized with devalue and written to disk as UTF-8. Splitting
* on UTF-16 code-unit boundaries (e.g. `String.prototype.slice`) can cut a
* surrogate pair in half; encoding a lone surrogate to UTF-8 substitutes U+FFFD,
* so concatenating the re-read parts would corrupt any astral-plane character
* (emoji, some CJK, etc.). `getChunkEnd()` advances by Unicode code point, so
* `str.slice` is only ever called on code-point boundaries and the parts always
* rejoin to the exact original string.
*/
export function chunkString(str, maxBytes) {
	const chunks = [];
	let startIndex = 0;
	while (startIndex < str.length) {
		const { endIndex } = getChunkEnd(str, startIndex, maxBytes);
		chunks.push(str.slice(startIndex, endIndex));
		startIndex = endIndex;
	}
	return chunks;
}
/**
* Atomically write `data` to `file`.
*
* The data is written to a temporary file and then renamed into place to avoid
* partial reads. If the file already contains identical data, the write is
* skipped. Callers are responsible for serializing concurrent writes to the
* same file.
*
* Returns `true` if the file was written, or `false` if the write was skipped.
*/
export async function writeFileAtomic(file, data) {
	const tempFile = file instanceof URL ? new URL(`${file.href}.tmp`) : `${file}.tmp`;
	const oldData = await fs.readFile(file, "utf-8").catch(() => "");
	if (oldData === data) {
		// If the data hasn't changed, we can skip the write.
		return false;
	}
	// Write to a temporary file first and then move it to prevent partial reads.
	await fs.writeFile(tempFile, data);
	await fs.rename(tempFile, file);
	return true;
}
/**
* A {@link DataStoreWriter} that serializes the whole store to a single file.
*/
export class FileWriter {
	#file;
	constructor(file) {
		this.#file = file;
	}
	get target() {
		return this.#file;
	}
	async write(collections) {
		return await writeFileAtomic(this.#file, serializeDataStore(collections));
	}
}
/**
* A {@link DataStoreWriter} that splits the store across many content-addressed
* files inside a directory, described by a manifest.
*
* Entries are serialized independently into parts no larger than a fixed byte
* size, so writing a collection does not require a collection-wide serialized
* string. Each part file is named by the xxhash of its contents, so unchanged
* parts keep the same name across builds and their writes are skipped, and two
* identical parts are naturally deduplicated. The manifest is written last as
* the commit point, and stale files are pruned afterwards. This is the inverse
* of {@link import('./data-store.js').ImmutableDataStore.manifestToMap}.
*/
export class ChunkedWriter {
	#dir;
	#manifestFile;
	#chunkSize;
	#hasher;
	#writtenFiles = new Set();
	constructor(dir, chunkSize) {
		this.#dir = dir;
		this.#manifestFile = new URL(`./${DATA_STORE_MANIFEST_FILE}`, dir);
		this.#chunkSize = chunkSize;
	}
	get target() {
		return this.#manifestFile;
	}
	async write(collections) {
		if (!this.#hasher) {
			this.#hasher = await xxhash();
		}
		this.#writtenFiles = new Set();
		const manifest = {};
		for (const [collectionName, entries] of sortCollections(collections)) {
			manifest[collectionName] = await this.#writeCollection(entries);
		}
		// The manifest is the commit point: every part it references already
		// exists on disk, so a reader never sees a dangling reference. Parts are
		// content-addressed, so an unchanged manifest means unchanged data.
		const didWrite = await writeFileAtomic(this.#manifestFile, JSON.stringify(manifest));
		this.#writtenFiles.add(DATA_STORE_MANIFEST_FILE);
		// Prune files left behind by previous snapshots.
		emptyDir(this.#dir, this.#writtenFiles);
		return didWrite;
	}
	async #writeCollection(entries) {
		const parts = [];
		let chunk = "";
		let chunkBytes = 0;
		const writeChunk = async () => {
			const fileName = `${this.#hasher.h64ToString(chunk)}.txt`;
			await writeFileAtomic(new URL(`./${fileName}`, this.#dir), chunk);
			parts.push(fileName);
			this.#writtenFiles.add(fileName);
			chunk = "";
			chunkBytes = 0;
		};
		for (const [id, entry] of entries) {
			const serialized = `${devalue.stringify([id, entry])}\n`;
			let startIndex = 0;
			while (startIndex < serialized.length) {
				const { endIndex, bytes } = getChunkEnd(serialized, startIndex, this.#chunkSize - chunkBytes);
				chunk += serialized.slice(startIndex, endIndex);
				chunkBytes += bytes;
				startIndex = endIndex;
				if (chunkBytes >= this.#chunkSize) {
					await writeChunk();
				}
			}
		}
		if (chunk) {
			await writeChunk();
		}
		return parts;
	}
}
