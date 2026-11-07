import "./rolldown-runtime-782esTHO.mjs";
import { t as engine_oniguruma_exports } from "./engine-oniguruma-XLVxwJtN.mjs";
import { i as bundledLanguagesInfo, n as bundledLanguagesAlias, r as bundledLanguagesBase, t as bundledLanguages } from "./langs-bundle-full-CSdmXkDy.mjs";
import { bundledThemes, bundledThemesInfo } from "./themes.mjs";
import { createBundledHighlighter, createSingletonShorthands, guessEmbeddedLanguages } from "@shikijs/core";
export * from "@shikijs/core";
// src/bundle-full.ts
/**
* Initiate a highlighter instance and load the specified languages and themes.
* Later it can be used synchronously to highlight code.
*
* Importing this function will bundle all languages and themes.
* @see https://shiki.style/guide/bundles#shiki-bundle-full
*
* For granular control over the bundle, check:
* @see https://shiki.style/guide/bundles#fine-grained-bundle
*/
const createHighlighter = /* @__PURE__ */ createBundledHighlighter({
	langs: bundledLanguages,
	themes: bundledThemes,
	engine: () => (0, engine_oniguruma_exports.createOnigurumaEngine)(import("shiki/wasm"))
});
const { codeToHtml, codeToHast, codeToTokens, codeToTokensBase, codeToTokensWithThemes, getSingletonHighlighter, getLastGrammarState } = /* @__PURE__ */ createSingletonShorthands(createHighlighter, { guessEmbeddedLanguages });
export { bundledLanguages, bundledLanguagesAlias, bundledLanguagesBase, bundledLanguagesInfo, bundledThemes, bundledThemesInfo, codeToHast, codeToHtml, codeToTokens, codeToTokensBase, codeToTokensWithThemes, createHighlighter, getLastGrammarState, getSingletonHighlighter };
