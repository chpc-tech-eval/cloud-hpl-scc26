export function getResolvedHostForHttpServer(host) {
	if (host === false) {
		// Use a secure default
		return "localhost";
	} else if (host === true) {
		// If passed --host in the CLI without arguments
		return undefined;
	} else {
		return host;
	}
}
export function stripBase(path, base) {
	if (path === base) {
		return "/";
	}
	const baseWithSlash = base.endsWith("/") ? base : base + "/";
	return path.replace(RegExp("^" + baseWithSlash), "/");
}
