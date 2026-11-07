import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
export async function getCloudflareCompatibilityDate(root) {
	const require = createRequire(root);
	const infoPath = require.resolve("@astrojs/cloudflare/info");
	const infoUrl = pathToFileURL(infoPath).toString();
	const infoModule = await import(infoUrl);
	return infoModule.getLocalWorkerdCompatibilityDate().date;
}
