import fs from "node:fs/promises";
export const frontmatterRE = /^---(.*?)^---/ms;
export async function loadId(pluginContainer, id) {
	const result = await pluginContainer.load(id, { ssr: true });
	if (result) {
		if (typeof result === "string") {
			return result;
		} else {
			return result.code;
		}
	}
	// Fallback to reading from fs (Vite doesn't add this by default)
	try {
		return await fs.readFile(id, "utf-8");
	} catch {}
}
