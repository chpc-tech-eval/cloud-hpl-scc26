const astroCookiesSymbol = Symbol.for("astro.cookies");
export function attachCookiesToResponse(response, cookies) {
	Reflect.set(response, astroCookiesSymbol, cookies);
}
export function getCookiesFromResponse(response) {
	let cookies = Reflect.get(response, astroCookiesSymbol);
	if (cookies != null) {
		return cookies;
	} else {
		return undefined;
	}
}
export function* getSetCookiesFromResponse(response) {
	const cookies = getCookiesFromResponse(response);
	if (!cookies) {
		return [];
	}
	for (const headerValue of cookies.consume()) {
		yield headerValue;
	}
	return [];
}
