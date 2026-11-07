function formatZodError(error) {
	return error.issues.map((issue) => `  **${issue.path.join(".")}**: ${issue.message}`);
}
export class LiveCollectionError extends Error {
	collection;
	message;
	cause;
	constructor(collection, message, cause) {
		super(message);
		this.collection = collection;
		this.message = message;
		this.cause = cause;
		this.name = "LiveCollectionError";
		if (cause?.stack) {
			this.stack = cause.stack;
		}
	}
	static is(error) {
		return error instanceof LiveCollectionError;
	}
}
export class LiveEntryNotFoundError extends LiveCollectionError {
	constructor(collection, entryFilter) {
		super(collection, `Entry ${collection} → ${typeof entryFilter === "string" ? entryFilter : JSON.stringify(entryFilter)} was not found.`);
		this.name = "LiveEntryNotFoundError";
	}
	static is(error) {
		return error?.name === "LiveEntryNotFoundError";
	}
}
export class LiveCollectionValidationError extends LiveCollectionError {
	constructor(collection, entryId, error) {
		super(collection, [
			`**${collection} → ${entryId}** data does not match the collection schema.\n`,
			...formatZodError(error),
			""
		].join("\n"));
		this.name = "LiveCollectionValidationError";
	}
	static is(error) {
		return error?.name === "LiveCollectionValidationError";
	}
}
export class LiveCollectionCacheHintError extends LiveCollectionError {
	constructor(collection, entryId, error) {
		super(collection, [
			`**${String(collection)}${entryId ? ` → ${String(entryId)}` : ""}** returned an invalid cache hint.\n`,
			...formatZodError(error),
			""
		].join("\n"));
		this.name = "LiveCollectionCacheHintError";
	}
	static is(error) {
		return error?.name === "LiveCollectionCacheHintError";
	}
}
