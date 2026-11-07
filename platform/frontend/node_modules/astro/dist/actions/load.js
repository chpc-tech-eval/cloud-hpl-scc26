import { FORBIDDEN_PATH_KEYS } from "@astrojs/internal-helpers/object";
import { ActionNotFoundError } from "../core/errors/errors-data.js";
import { AstroError } from "../core/errors/index.js";
import { createAsyncManifestMemo } from "../core/manifest/memo.js";
import { NOOP_ACTIONS_MOD } from "./noop-actions.js";
const actionsMemo = createAsyncManifestMemo(async (manifest) => manifest.actions ? await manifest.actions() : NOOP_ACTIONS_MOD);
/** Resolves the actions module from the manifest (a no-op module when none). */
export function getActions(manifest) {
	return actionsMemo.get(manifest);
}
/**
* Clears the cached actions so they are re-resolved on the next request.
* Called via HMR when action files change during development.
*/
export function clearActions(manifest) {
	actionsMemo.invalidate(manifest);
}
/** Looks up a single action handler by its dot-separated path. */
export async function getAction(manifest, path) {
	const pathKeys = path.split(".").map((key) => decodeURIComponent(key));
	let { server } = await getActions(manifest);
	if (!server || !(typeof server === "object")) {
		throw new TypeError(`Expected \`server\` export in actions file to be an object. Received ${typeof server}.`);
	}
	for (const key of pathKeys) {
		// An action is a leaf: once resolved to a function, its own properties
		// are not part of the action namespace and cannot be traversed further.
		if (typeof server === "function") {
			throw new AstroError({
				...ActionNotFoundError,
				message: ActionNotFoundError.message(pathKeys.join("."))
			});
		}
		if (FORBIDDEN_PATH_KEYS.has(key)) {
			throw new AstroError({
				...ActionNotFoundError,
				message: ActionNotFoundError.message(pathKeys.join("."))
			});
		}
		if (!Object.hasOwn(server, key)) {
			throw new AstroError({
				...ActionNotFoundError,
				message: ActionNotFoundError.message(pathKeys.join("."))
			});
		}
		// @ts-expect-error we are doing a recursion... it's ugly
		server = server[key];
	}
	if (typeof server !== "function") {
		throw new TypeError(`Expected handler for action ${pathKeys.join(".")} to be a function. Received ${typeof server}.`);
	}
	return server;
}
