import { deserializeActionResult, getActionQueryString } from "./runtime/client.js";
import { ACTION_API_CONTEXT_SYMBOL } from "./runtime/server.js";
export function hasActionPayload(locals) {
	return "_actionPayload" in locals;
}
export function createGetActionResult(locals) {
	return (actionFn) => {
		if (!hasActionPayload(locals) || actionFn.toString() !== getActionQueryString(locals._actionPayload.actionName)) {
			return undefined;
		}
		return deserializeActionResult(locals._actionPayload.actionResult);
	};
}
export function createCallAction(context) {
	return (baseAction, input) => {
		Reflect.set(context, ACTION_API_CONTEXT_SYMBOL, true);
		const action = baseAction.bind(context);
		return action(input);
	};
}
