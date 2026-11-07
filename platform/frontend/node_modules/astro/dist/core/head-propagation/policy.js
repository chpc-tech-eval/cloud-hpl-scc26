/**
* Policy for explicit `head` instructions.
*
* @example
* A page with `<head>{Astro.head}</head>` renders once, then blocks repeats.
*/
export function shouldRenderHeadInstruction(state) {
	return !state.hasRenderedHead && !state.partial;
}
/**
* Policy for fallback `maybe-head` instructions.
*
* @example
* A layout without `<head>` can inject styles with `maybe-head`, but only when
* no explicit `<head>` exists in the rendered tree.
*/
export function shouldRenderMaybeHeadInstruction(state) {
	return !state.hasRenderedHead && !state.headInTree && !state.partial;
}
/** Dispatches to the policy function for `head` or `maybe-head`. */
export function shouldRenderInstruction(type, state) {
	return type === "head" ? shouldRenderHeadInstruction(state) : shouldRenderMaybeHeadInstruction(state);
}
