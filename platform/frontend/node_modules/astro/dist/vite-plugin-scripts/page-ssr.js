import MagicString from "magic-string";
import { normalizePath } from "vite";
import { isPage } from "../core/util.js";
import { PAGE_SSR_SCRIPT_ID } from "./index.js";
import { isAstroServerEnvironment } from "../environments.js";
export default function astroScriptsPostPlugin({ settings }) {
	return {
		name: "astro:scripts:page-ssr",
		enforce: "post",
		transform(code, id) {
			if (!isAstroServerEnvironment(this.environment)) return;
			const hasInjectedScript = settings.scripts.some((s) => s.stage === "page-ssr");
			if (!hasInjectedScript) return;
			const filename = normalizePath(id);
			let fileURL;
			try {
				fileURL = new URL(`file://${filename}`);
			} catch {
				// If we can't construct a valid URL, exit early
				return;
			}
			const fileIsPage = isPage(fileURL, settings);
			if (!fileIsPage) return;
			const s = new MagicString(code, { filename });
			s.prepend(`import '${PAGE_SSR_SCRIPT_ID}';\n`);
			return {
				code: s.toString(),
				map: s.generateMap({ hires: "boundary" })
			};
		}
	};
}
