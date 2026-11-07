import { fileURLToPath } from "node:url";
import { setBuildTimings } from "@astrojs/internal-helpers/timings";
import { BuildTimingsCollector } from "./collector.js";
import { renderCliReport } from "./report-cli.js";
import { buildTimingsPlugin } from "./vite-plugins.js";
let active;
export async function withBuildTimings(fn) {
	active = new BuildTimingsCollector();
	setBuildTimings(active);
	try {
		return await fn();
	} finally {
		active = undefined;
		setBuildTimings(undefined);
	}
}
export function buildPhase(name, fn) {
	return active ? active.span(name, fn) : fn();
}
export function buildTimingsVitePlugins() {
	return active ? [buildTimingsPlugin()] : [];
}
export function printBuildTimings(settings, logger) {
	if (!active) return;
	// The build has already succeeded, so a reporting bug must not fail it.
	try {
		const data = active.toData({
			root: fileURLToPath(settings.config.root),
			output: settings.buildOutput ?? settings.config.output
		});
		logger.info("SKIP_FORMAT", renderCliReport(data));
	} catch (err) {
		logger.warn("build", `Could not print the timings report: ${err}`);
	}
}
