import { fetchStateSymbol } from "../../../core/constants.js";
import { ActionCalledFromServerError } from "../../../core/errors/errors-data.js";
import { AstroError } from "../../../core/errors/errors.js";
import { getAction } from "../../load.js";
import { createGetActionPath, createActionsProxy } from "../client.js";
import { shouldAppendTrailingSlash } from "virtual:astro:actions/options";
export { ACTION_QUERY_PARAMS } from "../../consts.js";
export { ActionError, isActionError, isInputError } from "../client.js";
export { defineAction, getActionContext } from "../server.js";
export const getActionPath = createGetActionPath({
	baseUrl: import.meta.env.BASE_URL,
	shouldAppendTrailingSlash
});
export const actions = createActionsProxy({ handleAction: async (param, path, context) => {
	const state = context ? Reflect.get(context, fetchStateSymbol) : undefined;
	if (!state) {
		// The context was not created by Astro's request handling (e.g.
		// an action invoked from server code without a context).
		throw new AstroError(ActionCalledFromServerError);
	}
	const action = await getAction(state.manifest, path);
	if (!action) throw new Error(`Action not found: ${path}`);
	return action.bind(context)(param);
} });
