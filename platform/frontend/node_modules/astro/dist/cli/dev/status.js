import { devServerCommand, formatStatusOutput, status as serverStatus } from "../server.js";
export { formatStatusOutput };
export async function status({ flags, logger }) {
	await serverStatus({
		flags,
		logger,
		config: devServerCommand
	});
}
