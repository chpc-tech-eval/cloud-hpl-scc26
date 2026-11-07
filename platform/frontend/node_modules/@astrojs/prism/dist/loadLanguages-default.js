import prismLoadLanguages from "prismjs/components/index.js";
export async function loadLanguages(languages) {
	return prismLoadLanguages(languages);
}
