import { AstroError, AstroErrorData } from "../errors/index.js";
export function getRedirectLocationOrThrow(headers) {
	let location = headers.get("location");
	if (!location) {
		throw new AstroError({ ...AstroErrorData.RedirectWithNoLocation });
	}
	return location;
}
