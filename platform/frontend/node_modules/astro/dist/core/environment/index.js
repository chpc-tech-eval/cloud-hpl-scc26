import { productionEnvironment } from "./production.js";
const environments = new WeakMap();
/**
* Registers the environment for a manifest. Idempotent; last registration wins
* (build may re-register after internals/options injection if it prefers).
*/
export function setEnvironment(manifest, env) {
	environments.set(manifest, env);
}
/**
* The environment for a manifest. Defaults to the production (bundled)
* implementation, which is derivable from the manifest alone — so a bare
* `new FetchState(request)` in a bundled worker needs no registration.
*/
export function getEnvironment(manifest) {
	return environments.get(manifest) ?? productionEnvironment;
}
