import { devServerCommand, logs as serverLogs } from "../server.js";
export async function logs({ flags, logger }) {
	await serverLogs({
		flags,
		logger,
		config: devServerCommand
	});
}
