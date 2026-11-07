import { devServerCommand, formatStopOutput, stop as stopServer } from "../server.js";
export { formatStopOutput };
export async function stop({ flags, logger }) {
	await stopServer({
		flags,
		logger,
		config: devServerCommand
	});
}
