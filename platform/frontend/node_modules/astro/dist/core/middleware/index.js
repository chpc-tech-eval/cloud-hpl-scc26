import { createCallAction, createGetActionResult } from "../../actions/utils.js";
import { computeCurrentLocale, computePreferredLocale, computePreferredLocaleList } from "../../i18n/utils.js";
import { DisabledAstroCache } from "../cache/runtime/noop.js";
import { ASTRO_GENERATOR } from "../constants.js";
import { AstroCookies } from "../cookies/index.js";
import { AstroError, AstroErrorData } from "../errors/index.js";
import { getLogger } from "../logger/manifest-logger.js";
import { tryGetAmbientManifest } from "../manifest/ambient.js";
import { getOriginPathname } from "../routing/rewrite.js";
import { sequence } from "./sequence.js";
/**
* Edge middleware runs outside of a request's `FetchState`, so the logger is
* resolved from the ambient manifest at call time. No manifest is available in
* plain Node (unit tests, embedders), where the console is the only destination.
*/
function getMiddlewareLogger() {
	const manifest = tryGetAmbientManifest();
	if (manifest) {
		return getLogger(manifest);
	}
	return { warn(_label, message) {
		console.warn(message);
	} };
}
/**
* Creates a context to be passed to Astro middleware `onRequest` function.
*/
function createContext({ request, params = {}, userDefinedLocales = [], defaultLocale = "", locals = {}, clientAddress }) {
	let preferredLocale = undefined;
	let preferredLocaleList = undefined;
	let currentLocale = undefined;
	const url = new URL(request.url);
	const route = url.pathname;
	// TODO verify that this function works in an edge middleware environment
	const rewrite = (_reroutePayload) => {
		// return dummy response
		return Promise.resolve(new Response(null));
	};
	const context = {
		cookies: new AstroCookies(request, getMiddlewareLogger()),
		request,
		params,
		site: undefined,
		generator: ASTRO_GENERATOR,
		props: {},
		rewrite,
		routePattern: "",
		redirect(path, status) {
			return new Response(null, {
				status: status || 302,
				headers: { Location: path }
			});
		},
		isPrerendered: false,
		get preferredLocale() {
			return preferredLocale ??= computePreferredLocale(request, userDefinedLocales);
		},
		get preferredLocaleList() {
			return preferredLocaleList ??= computePreferredLocaleList(request, userDefinedLocales);
		},
		get currentLocale() {
			return currentLocale ??= computeCurrentLocale(route, userDefinedLocales, defaultLocale);
		},
		url,
		get originPathname() {
			return getOriginPathname(request);
		},
		get clientAddress() {
			if (clientAddress) {
				return clientAddress;
			}
			throw new AstroError(AstroErrorData.StaticClientAddressNotAvailable);
		},
		get locals() {
			if (typeof locals !== "object") {
				throw new AstroError(AstroErrorData.LocalsNotAnObject);
			}
			return locals;
		},
		set locals(_) {
			throw new AstroError(AstroErrorData.LocalsReassigned);
		},
		session: undefined,
		cache: new DisabledAstroCache(),
		csp: undefined,
		logger: {
			info() {},
			warn() {},
			error() {}
		}
	};
	return Object.assign(context, {
		getActionResult: createGetActionResult(context.locals),
		callAction: createCallAction(context)
	});
}
/**
* Checks whether the passed `value` is serializable.
*
* A serializable value contains plain values. For example, `Proxy`, `Set`, `Map`, functions, etc.
* are not accepted because they can't be serialized.
*/
export function isLocalsSerializable(value) {
	const stack = [value];
	while (stack.length > 0) {
		const current = stack.pop();
		const type = typeof current;
		if (current === null || type === "string" || type === "number" || type === "boolean") {
			continue;
		}
		if (Array.isArray(current)) {
			stack.push(...current);
			continue;
		}
		if (type === "object" && isPlainObject(current)) {
			stack.push(...Object.values(current));
			continue;
		}
		// Any other type (Date, Map, Set, class instance, function, …) is not serializable.
		return false;
	}
	return true;
}
/**
*
* From [redux-toolkit](https://github.com/reduxjs/redux-toolkit/blob/master/packages/toolkit/src/isPlainObject.ts)
*
* Returns true if the passed value is "plain" object, i.e. an object whose
* prototype is the root `Object.prototype`. This includes objects created
* using object literals, but not for instance for class instances.
*/
function isPlainObject(value) {
	if (typeof value !== "object" || value === null) return false;
	let proto = Object.getPrototypeOf(value);
	if (proto === null) return true;
	let baseProto = proto;
	while (Object.getPrototypeOf(baseProto) !== null) {
		baseProto = Object.getPrototypeOf(baseProto);
	}
	return proto === baseProto;
}
/**
* It attempts to serialize `value` and return it as a string.
*
* ## Errors
*  If the `value` is not serializable if the function will throw a runtime error.
*
* Something is **not serializable** when it contains properties/values like functions, `Map`, `Set`, `Date`,
* and other types that can't be made a string.
*
* @param value
*/
function trySerializeLocals(value) {
	if (isLocalsSerializable(value)) {
		return JSON.stringify(value);
	} else {
		throw new Error("The passed value can't be serialized.");
	}
}
// NOTE: this export must export only the functions that will be exposed to user-land as officials APIs
export { createContext, sequence, trySerializeLocals };
export { defineMiddleware } from "./defineMiddleware.js";
