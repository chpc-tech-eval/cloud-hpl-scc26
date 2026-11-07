import Prism from "prismjs";
import { loadLanguages } from "#prism-loadLanguages";
import { addAstro } from "./plugin.js";
const languageMap = new Map([["ts", "typescript"]]);
export async function runHighlighterWithAstro(lang, code) {
	if (!lang) {
		lang = "plaintext";
	}
	let classLanguage = `language-${lang}`;
	const ensureLoaded = async (language) => {
		if (language && !Prism.languages[language]) {
			await loadLanguages([language]);
		}
	};
	if (languageMap.has(lang)) {
		await ensureLoaded(languageMap.get(lang));
	} else if (lang === "astro") {
		await ensureLoaded("typescript");
		addAstro(Prism);
	} else {
		await ensureLoaded("markup-templating");
		await ensureLoaded(lang);
	}
	if (lang && !Prism.languages[lang]) {
		console.warn(`Unable to load the language: ${lang}`);
	}
	const grammar = Prism.languages[lang];
	// Without a grammar, still escape the code so it displays as plain text,
	// matching the output of `Prism.highlight()` for supported languages.
	const html = grammar ? Prism.highlight(code, grammar, lang) : escapeCode(code);
	return {
		classLanguage,
		html
	};
}
function escapeCode(code) {
	return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
