export function isYAMLParseError(err) {
	return err instanceof Error && err.name === "YAMLParseError";
}
