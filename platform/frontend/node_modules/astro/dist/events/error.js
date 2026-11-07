import { AstroError, AstroErrorData } from "../core/errors/index.js";
const EVENT_ERROR = "ASTRO_CLI_ERROR";
/**
* This regex will grab a small snippet at the start of an error message.
* This was designed to stop capturing at the first sign of some non-message
* content like a filename, filepath, or any other code-specific value.
* We also trim this value even further to just a few words.
*
* This is only used for errors that do not come from us so we can get a basic
* and anonymous idea of what the error is about.
*/
const ANONYMIZE_MESSAGE_REGEX = /^(?:\w| )+/;
function anonymizeErrorMessage(msg) {
	const matchedMessage = ANONYMIZE_MESSAGE_REGEX.exec(msg);
	if (!matchedMessage?.[0]) {
		return undefined;
	}
	return matchedMessage[0].trim().substring(0, 20);
}
export function eventConfigError({ err, cmd, isFatal }) {
	const payload = {
		name: "ZodError",
		isFatal,
		isConfig: true,
		cliCommand: cmd,
		configErrorPaths: err.issues.map((issue) => issue.path.join("."))
	};
	return [{
		eventName: EVENT_ERROR,
		payload
	}];
}
export function eventError({ cmd, err, isFatal }) {
	const errorData = AstroError.is(err) && AstroErrorData[err.name];
	const payload = {
		name: err.name,
		plugin: err.plugin,
		cliCommand: cmd,
		isFatal,
		anonymousMessageHint: errorData && errorData.message ? getSafeErrorMessage(errorData.message) : anonymizeErrorMessage(err.message)
	};
	return [{
		eventName: EVENT_ERROR,
		payload
	}];
}
/**
* Safely get the error message from an error, even if it's a function.
*/
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function getSafeErrorMessage(message) {
	if (typeof message === "string") {
		return message;
	} else {
		return String.raw({ raw: extractStringFromFunction(message.toString()) });
	}
	function extractStringFromFunction(func) {
		const arrowIndex = func.indexOf("=>") + "=>".length;
		return func.slice(arrowIndex).trim().slice(1, -1).replace(/\$\{([^}]+)\}/g, (_str, match1) => `${match1.split(/\.?(?=[A-Z])/).join("_").toUpperCase()}`).replace(/\\`/g, "`");
	}
}
