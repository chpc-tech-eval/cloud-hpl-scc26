import { collectErrorMetadata } from "../core/errors/dev/index.js";
import { formatErrorMessage } from "../core/messages/runtime.js";
export function recordServerError(loader, manifest, logger, err) {
	// This could be a runtime error from Vite's SSR module, so try to fix it here
	try {
		loader.fixStacktrace(err);
	} catch {}
	// This is our last line of defense regarding errors where we still might have some information about the request
	// Our error should already be complete, but let's try to add a bit more through some guesswork
	const errorWithMetadata = collectErrorMetadata(err, manifest.rootDir);
	logger.error(null, formatErrorMessage(errorWithMetadata, logger.level() === "debug"));
	return { errorWithMetadata };
}
