// A stub of a component instance for a given route
export const RedirectComponentInstance = { default() {
	return new Response(null, { status: 301 });
} };
export const RedirectSinglePageBuiltModule = {
	page: () => Promise.resolve(RedirectComponentInstance),
	onRequest: (_, next) => next()
};
