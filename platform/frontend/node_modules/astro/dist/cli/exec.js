import { NonZeroExitError, x } from "tinyexec";
/**
* Improve tinyexec error logging and set `throwOnError` to `true` by default
* @deprecated use CommandExecutor instead
*/
export function exec(command, args, options) {
	return x(command, args, {
		throwOnError: true,
		...options
	}).then((o) => o, (e) => {
		if (e instanceof NonZeroExitError) {
			const fullCommand = args?.length ? `${command} ${args.map((a) => a.includes(" ") ? `"${a}"` : a).join(" ")}` : command;
			const message = `The command \`${fullCommand}\` exited with code ${e.exitCode}`;
			const newError = new Error(message, e.cause ? { cause: e.cause } : undefined);
			newError.stderr = e.output?.stderr;
			newError.stdout = e.output?.stdout;
			throw newError;
		}
		throw e;
	});
}
