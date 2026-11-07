import { detectAgenticEnvironment } from "am-i-vibing";
export function isRunByAgent() {
	try {
		// "hybrid" environments such as Warp may not actually be running an AI agent.
		return detectAgenticEnvironment().type === "agent";
	} catch {
		return false;
	}
}
export function supportsAgentAutoBackgrounding(platform) {
	// Detached children remain in agent-owned Windows Job Objects and are terminated with them.
	// https://github.com/withastro/astro/issues/18019
	return platform !== "win32";
}
