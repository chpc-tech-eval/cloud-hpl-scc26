import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
export class LocalFontProvider {
	name = "local";
	config;
	#fontFileReader;
	#root;
	constructor({ fontFileReader }) {
		this.config = undefined;
		this.#fontFileReader = fontFileReader;
		this.#root = undefined;
	}
	init(context) {
		this.#root = context.root;
	}
	#resolveEntrypoint(root, entrypoint) {
		const require = createRequire(root);
		try {
			return pathToFileURL(require.resolve(entrypoint));
		} catch {
			return new URL(entrypoint, root);
		}
	}
	#normalizeSource(value) {
		const isValue = typeof value === "string" || value instanceof URL;
		const url = (isValue ? value : value.url).toString();
		const tech = isValue ? undefined : value.tech;
		return {
			url: fileURLToPath(this.#resolveEntrypoint(this.#root ?? new URL(import.meta.url), url)),
			tech
		};
	}
	resolveFont(options) {
		return { fonts: options.options?.variants.map((variant) => {
			const shouldInfer = variant.weight === undefined || variant.style === undefined;
			// We prepare the data
			const data = {
				// If it should be inferred, we don't want to set the value
				weight: variant.weight,
				style: variant.style,
				src: [],
				unicodeRange: variant.unicodeRange,
				display: variant.display,
				stretch: variant.stretch,
				featureSettings: variant.featureSettings,
				variationSettings: variant.variationSettings
			};
			// We proxy each source
			data.src = variant.src.map((rawSource, index) => {
				const source = this.#normalizeSource(rawSource);
				// We only try to infer for the first source. Indeed if it doesn't work, the function
				// call will throw an error so that will be interrupted anyways
				if (shouldInfer && index === 0) {
					const result = this.#fontFileReader.extract({
						family: options.familyName,
						url: source.url
					});
					if (variant.weight === undefined) data.weight = result.weight;
					if (variant.style === undefined) data.style = result.style;
				}
				return source;
			});
			return data;
		}) ?? [] };
	}
}
