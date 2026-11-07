import { isAbsolute } from "node:path";
import { AstroError, AstroErrorData } from "../../../core/errors/index.js";
export class FsFontFileContentResolver {
	#readFileSync;
	constructor({ readFileSync }) {
		this.#readFileSync = readFileSync;
	}
	resolve(url) {
		if (!isAbsolute(url)) {
			// HTTP URLs are enough
			return url;
		}
		try {
			// We only use the file content for the id generation to ensure
			// deterministic output filenames regardless of the project's location
			// on disk. The absolute path is excluded so that the same font file
			// produces the same hash across different checkout directories.
			return this.#readFileSync(url);
		} catch (cause) {
			throw new AstroError(AstroErrorData.UnknownFilesystemError, { cause });
		}
	}
}
