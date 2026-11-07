const isESMImport = Symbol("#isESM");
export function isImageMetadata(src) {
	// For ESM-imported images the fsPath property is set but not enumerable
	return !!src.fsPath && !Object.prototype.propertyIsEnumerable.call(src, "fsPath");
}
