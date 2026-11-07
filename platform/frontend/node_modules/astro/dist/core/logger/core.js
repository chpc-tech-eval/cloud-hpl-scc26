import colors from "piccolore";
/**
* Defined logger labels. Add more as needed, but keep them high-level & reusable,
* rather than specific to a single command, function, use, etc. The label will be
* shown in the log message to the user, so it should be relevant.
*/
const AstroLoggerLabels = [
	"add",
	"build",
	"check",
	"config",
	"content",
	"crypto",
	"deprecated",
	"markdown",
	"router",
	"types",
	"vite",
	"watch",
	"middleware",
	"preferences",
	"redirects",
	"sync",
	"session",
	"toolbar",
	"assets",
	"env",
	"update",
	"adapter",
	"islands",
	"cache",
	"csp",
	"SKIP_FORMAT"
];
// Hey, locales are pretty complicated! Be careful modifying this logic...
// If we throw at the top-level, international users can't use Astro.
//
// Using `[]` sets the default locale properly from the system!
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#parameters
//
// Here be the dragons we've slain:
// https://github.com/withastro/astro/issues/2625
// https://github.com/withastro/astro/issues/3309
/** @lintignore */
export const dateTimeFormat = new Intl.DateTimeFormat([], {
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hour12: false
});
export const levels = {
	debug: 20,
	info: 30,
	warn: 40,
	error: 50,
	silent: 90
};
/** Full logging API */
function log(opts, level, label, message, newLine = true) {
	const logLevel = opts.level;
	const dest = opts.destination;
	const event = {
		label,
		level,
		message,
		newLine
	};
	// test if this level is enabled or not
	if (!isLogLevelEnabled(logLevel, level)) {
		return;
	}
	dest.write(event);
}
export function isLogLevelEnabled(configuredLogLevel, level) {
	return levels[configuredLogLevel] <= levels[level];
}
/** Emit a user-facing message. Useful for UI and other console messages. */
function info(opts, label, message, newLine = true) {
	return log(opts, "info", label, message, newLine);
}
/** Emit a warning message. Useful for high-priority messages that aren't necessarily errors. */
function warn(opts, label, message, newLine = true) {
	return log(opts, "warn", label, message, newLine);
}
/** Emit an error message, Useful when Astro can't recover from some error. */
function error(opts, label, message, newLine = true) {
	return log(opts, "error", label, message, newLine);
}
export function debug(...args) {
	if ("_astroGlobalDebug" in globalThis) {
		globalThis._astroGlobalDebug(...args);
	}
}
/**
* Get the prefix for a log message.
* This includes the timestamp, log level, and label all properly formatted
* with colors. This is shared across different loggers, so it's defined here.
*/
export function getEventPrefix({ level, label }) {
	const timestamp = `${dateTimeFormat.format(new Date())}`;
	const prefix = [];
	if (level === "error" || level === "warn") {
		prefix.push(colors.bold(timestamp));
		prefix.push(`[${level.toUpperCase()}]`);
	} else {
		prefix.push(timestamp);
	}
	if (label) {
		prefix.push(`[${label}]`);
	}
	if (level === "error") {
		return colors.red(prefix.join(" "));
	}
	if (level === "warn") {
		return colors.yellow(prefix.join(" "));
	}
	if (prefix.length === 1) {
		return colors.dim(prefix[0]);
	}
	return colors.dim(prefix[0]) + " " + colors.blue(prefix.splice(1).join(" "));
}
/** Print out a timer message for debug() */
export function timerMessage(message, startTime = Date.now()) {
	let timeDiff = Date.now() - startTime;
	let timeDisplay = timeDiff < 750 ? `${Math.round(timeDiff)}ms` : `${(timeDiff / 1e3).toFixed(1)}s`;
	return `${message}   ${colors.dim(timeDisplay)}`;
}
export class AstroLogger {
	options;
	constructor(options) {
		this.options = options;
	}
	info(label, message, newLine = true) {
		info(this.options, label, message, newLine);
	}
	warn(label, message, newLine = true) {
		warn(this.options, label, message, newLine);
	}
	error(label, message, newLine = true) {
		error(this.options, label, message, newLine);
	}
	debug(label, ...messages) {
		debug(label, ...messages);
	}
	level() {
		return this.options.level;
	}
	forkIntegrationLogger(label) {
		return new AstroIntegrationLogger(this.options, label);
	}
	setDestination(destination) {
		this.options.destination = destination;
	}
	/**
	* It calls the `close` function of the provided destination, if it exists.
	*/
	close() {
		if (this.options.destination.close) {
			this.options.destination.close();
		}
	}
	/**
	* It calls the `flush` function of the provided destination, if it exists.
	*/
	flush() {
		if (this.options.destination.flush) {
			this.options.destination.flush();
		}
	}
}
export class AstroIntegrationLogger {
	options;
	label;
	constructor(logging, label) {
		this.options = logging;
		this.label = label;
	}
	/**
	* Creates a new logger instance with a new label, but the same log options.
	*/
	fork(label) {
		return new AstroIntegrationLogger(this.options, label);
	}
	info(message) {
		info(this.options, this.label, message);
	}
	warn(message) {
		warn(this.options, this.label, message);
	}
	error(message) {
		error(this.options, this.label, message);
	}
	debug(message) {
		debug(this.label, message);
	}
	/**
	* It calls the `flush` function of the provided destination, if it exists.
	*/
	flush() {
		if (this.options.destination.flush) {
			this.options.destination.flush();
		}
	}
	/**
	* It calls the `close` function of the provided destination, if it exists.
	*/
	close() {
		if (this.options.destination.close) {
			this.options.destination.close();
		}
	}
}
export function astroToRuntimeLogger(logger) {
	return {
		info(msg) {
			logger.info(null, msg);
		},
		warn(msg) {
			logger.warn(null, msg);
		},
		error(msg) {
			logger.error(null, msg);
		}
	};
}
