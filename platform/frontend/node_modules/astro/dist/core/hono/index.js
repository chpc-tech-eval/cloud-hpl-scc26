import { FetchState, actions as fetchActions, astro as fetchAstro, cache as fetchCache, i18n as fetchI18n, middleware as fetchMiddleware, notFound as fetchNotFound, pages as fetchPages, redirects as fetchRedirects, sessions as fetchSessions, trailingSlash as fetchTrailingSlash } from "../fetch/index.js";
export { FetchState };
const FETCH_STATE_KEY = "fetchState";
export function getFetchState(context) {
	const state = context.get?.(FETCH_STATE_KEY);
	if (state) {
		return state;
	}
	const nextState = new FetchState(context.req.raw);
	context.set?.(FETCH_STATE_KEY, nextState);
	return nextState;
}
export function astro() {
	return async (context, _next) => {
		return fetchAstro(getFetchState(context));
	};
}
export function trailingSlash() {
	return async (context, honoNext) => {
		const redirect = fetchTrailingSlash(getFetchState(context));
		if (redirect) return redirect;
		await honoNext();
	};
}
export function middleware() {
	return async (context, honoNext) => {
		return fetchMiddleware(getFetchState(context), async () => {
			await honoNext();
			return context.res;
		});
	};
}
export function redirects() {
	return async (context, honoNext) => {
		const response = fetchRedirects(getFetchState(context));
		if (response) return response;
		await honoNext();
	};
}
export function notFound() {
	return async (context, honoNext) => {
		const response = await fetchNotFound(getFetchState(context));
		if (response) return response;
		await honoNext();
	};
}
export function actions() {
	return async (context, honoNext) => {
		const result = fetchActions(getFetchState(context));
		if (result) {
			const response = await result;
			if (response) return response;
		}
		await honoNext();
	};
}
export function pages() {
	return async (context, _honoNext) => {
		return fetchPages(getFetchState(context));
	};
}
export function sessions() {
	return async (context, honoNext) => {
		const state = getFetchState(context);
		await fetchSessions(state);
		try {
			await honoNext();
		} finally {
			await state.finalizeAll();
		}
	};
}
export function cache() {
	return async (context, honoNext) => {
		return fetchCache(getFetchState(context), async () => {
			await honoNext();
			return context.res;
		});
	};
}
export function i18n() {
	return async (context, honoNext) => {
		await honoNext();
		context.res = await fetchI18n(getFetchState(context), context.res);
	};
}
