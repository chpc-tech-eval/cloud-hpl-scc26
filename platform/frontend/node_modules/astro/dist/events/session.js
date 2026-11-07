import { detectAgenticEnvironment } from "am-i-vibing";
import { AstroConfigSchema } from "../core/config/schemas/index.js";
const EVENT_SESSION = "ASTRO_CLI_SESSION_STARTED";
function measureIsDefined(val) {
	// if val is undefined, measure undefined as a value
	if (val === undefined) {
		return undefined;
	}
	// otherwise, convert the value to a boolean
	return Boolean(val);
}
/**
* Measure supports string literal values. Passing a generic `string` type
* results in an error, to make sure generic user input is never measured directly.
*/
function measureStringLiteral(val) {
	return val;
}
function measureIntegration(val) {
	if (!val || !val.name) {
		return undefined;
	}
	return val.name;
}
function sanitizeConfigInfo(obj, validKeys) {
	if (!obj || validKeys.length === 0) {
		return {};
	}
	return validKeys.reduce((result, key) => {
		result[key] = measureIsDefined(obj[key]);
		return result;
	}, {});
}
/**
* This function creates an anonymous ConfigInfo object from the user's config.
* All values are sanitized to preserve anonymity. Simple "exist" boolean checks
* are used by default, with a few additional sanitized values added manually.
* Helper functions should always be used to ensure correct sanitization.
*/
function createAnonymousConfigInfo(userConfig) {
	// Sanitize and measure the generic config object
	// NOTE(fks): Using _def is the correct, documented way to get the `shape`
	// from a Zod object that includes a wrapping default(), optional(), etc.
	// Even though `_def` appears private, it is type-checked for us so that
	// any changes between versions will be detected.
	const configInfo = {
		...sanitizeConfigInfo(userConfig, Object.keys(AstroConfigSchema.shape)),
		build: sanitizeConfigInfo(userConfig.build, Object.keys(AstroConfigSchema.shape.build._def.innerType.shape)),
		image: sanitizeConfigInfo(userConfig.image, Object.keys(AstroConfigSchema.shape.image._def.innerType.shape)),
		markdown: sanitizeConfigInfo(userConfig.markdown, Object.keys(AstroConfigSchema.shape.markdown._def.innerType.shape)),
		experimental: sanitizeConfigInfo(userConfig.experimental, Object.keys(AstroConfigSchema.shape.experimental._def.innerType.shape)),
		legacy: sanitizeConfigInfo(userConfig.legacy, Object.keys(AstroConfigSchema.shape.legacy._def.innerType.shape)),
		vite: userConfig.vite ? sanitizeConfigInfo(userConfig.vite, Object.keys(userConfig.vite)) : undefined
	};
	// Measure string literal/enum configuration values
	configInfo.build.format = measureStringLiteral(userConfig.build?.format);
	const syntaxHighlight = userConfig.markdown?.syntaxHighlight;
	const syntaxHighlightType = typeof syntaxHighlight === "object" ? syntaxHighlight.type : syntaxHighlight;
	configInfo.markdown.syntaxHighlight = measureStringLiteral(syntaxHighlightType);
	configInfo.output = measureStringLiteral(userConfig.output);
	configInfo.scopedStyleStrategy = measureStringLiteral(userConfig.scopedStyleStrategy);
	configInfo.trailingSlash = measureStringLiteral(userConfig.trailingSlash);
	// Measure integration & adapter usage
	configInfo.adapter = measureIntegration(userConfig.adapter);
	configInfo.integrations = userConfig.integrations?.flat(100).map(measureIntegration).filter(Boolean);
	// Return the sanitized ConfigInfo object
	return configInfo;
}
export function eventCliSession(cliCommand, userConfig, flags) {
	// Filter out yargs default `_` flag which is the cli command
	const cliFlags = flags ? Object.keys(flags).filter((name) => name !== "_") : undefined;
	const payload = {
		cliCommand,
		config: createAnonymousConfigInfo(userConfig),
		flags: cliFlags
	};
	// Detect AI coding agent environment
	try {
		const agentInfo = detectAgenticEnvironment();
		if (agentInfo.isAgentic) {
			payload.isAgentic = true;
			if (agentInfo.id) payload.agentId = agentInfo.id;
			if (agentInfo.name) payload.agentName = agentInfo.name;
			if (agentInfo.type) payload.agentType = agentInfo.type;
		}
	} catch {}
	return [{
		eventName: EVENT_SESSION,
		payload
	}];
}
