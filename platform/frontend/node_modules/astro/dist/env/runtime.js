import { AstroError, AstroErrorData } from "../core/errors/index.js";
import { invalidVariablesToError } from "./errors.js";
export { getEnvFieldType, validateEnvVariable } from "./validators.js";
let _getEnv = (key) => process.env[key];
export function setGetEnv(fn) {
	_getEnv = fn;
	_onSetGetEnv();
}
let _onSetGetEnv = () => {};
export function setOnSetGetEnv(fn) {
	_onSetGetEnv = fn;
}
export function getEnv(...args) {
	return _getEnv(...args);
}
export function createInvalidVariablesError(key, type, result) {
	return new AstroError({
		...AstroErrorData.EnvInvalidVariables,
		message: AstroErrorData.EnvInvalidVariables.message(invalidVariablesToError([{
			key,
			type,
			errors: result.errors
		}]))
	});
}
