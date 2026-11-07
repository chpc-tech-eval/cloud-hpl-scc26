// Languages never syntax-highlighted by default (e.g. `math`, handled elsewhere).
export const defaultExcludeLanguages = ["math"];
export const syntaxHighlightDefaults = {
	type: "shiki",
	excludeLangs: defaultExcludeLanguages
};
/** Default values for the markdown config, regardless of processor. */
export const markdownConfigDefaults = {
	syntaxHighlight: syntaxHighlightDefaults,
	shikiConfig: {
		langs: [],
		theme: "github-dark",
		themes: {},
		wrap: false,
		transformers: [],
		langAlias: {}
	},
	gfm: true,
	smartypants: true,
	remarkPlugins: [],
	rehypePlugins: [],
	remarkRehype: {}
};
