import { readFileSync } from "node:fs";
import { fontace } from "fontace";
import { AstroError, AstroErrorData } from "../../../core/errors/index.js";
export class FontaceFontFileReader {
	extract({ family, url }) {
		try {
			const data = fontace(readFileSync(url));
			return {
				weight: data.weight,
				style: data.style
			};
		} catch (cause) {
			throw new AstroError({
				...AstroErrorData.CannotDetermineWeightAndStyleFromFontFile,
				message: AstroErrorData.CannotDetermineWeightAndStyleFromFontFile.message(family, url)
			}, { cause });
		}
	}
}
