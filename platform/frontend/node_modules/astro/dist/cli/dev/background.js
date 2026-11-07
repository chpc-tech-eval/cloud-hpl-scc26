import { background as startBackgroundServer, devServerCommand, formatBackgroundOutput, formatServerRunningMessage as formatServerMessage } from "../server.js";
export { formatBackgroundOutput };
export function formatServerRunningMessage(data, { existing = false } = {}) {
	return formatServerMessage(data, devServerCommand, { existing });
}
export async function background({ flags, logger }) {
	await startBackgroundServer({
		flags,
		logger,
		config: devServerCommand
	});
}
