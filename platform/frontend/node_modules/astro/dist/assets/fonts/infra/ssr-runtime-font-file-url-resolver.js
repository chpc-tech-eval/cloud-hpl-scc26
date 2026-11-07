import { MissingGetFontFileRequestUrl } from "../../../core/errors/errors-data.js";
import { AstroError } from "../../../core/errors/errors.js";
/**
* During SSR, we don't know ahead of time where the server is located.
* We rely on `requestUrl` (provided by the user) to construct the URL.
*/
export class SsrRuntimeFontFileUrlResolver {
	#urls;
	constructor({ urls }) {
		this.#urls = urls;
	}
	resolve(url, requestUrl) {
		if (!this.#urls.has(url)) {
			return null;
		}
		// assetsPrefix
		if (!url.startsWith("/")) {
			return url;
		}
		// We need the request URL to call the current server
		if (!requestUrl) {
			throw new AstroError(MissingGetFontFileRequestUrl);
		}
		return `${requestUrl.origin}${url}`;
	}
}
