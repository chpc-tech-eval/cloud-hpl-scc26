import { createUnifont, defineFontProvider } from "unifont";
export class UnifontFontResolver {
	#unifont;
	#hasher;
	constructor({ unifont, hasher }) {
		this.#unifont = unifont;
		this.#hasher = hasher;
	}
	static idFromProvider({ hasher, provider }) {
		const hash = hasher.hashObject({
			name: provider.name,
			...provider.config
		});
		return `${provider.name}-${hash}`;
	}
	static astroToUnifontProvider(astroProvider, root) {
		return defineFontProvider(astroProvider.name, async (_options, ctx) => {
			await astroProvider?.init?.({
				...ctx,
				root
			});
			return {
				async resolveFont(familyName, { options, ...rest }) {
					return await astroProvider.resolveFont({
						familyName,
						options,
						...rest
					});
				},
				async listFonts() {
					return astroProvider.listFonts?.();
				},
				getFontProperties: astroProvider.getFontProperties ? async (familyName) => astroProvider.getFontProperties({ familyName }) : undefined
			};
		})(astroProvider.config);
	}
	static extractUnifontProviders({ families, hasher, root }) {
		const providers = new Map();
		for (const { provider } of families) {
			const id = this.idFromProvider({
				hasher,
				provider
			});
			if (!providers.has(id)) {
				const unifontProvider = this.astroToUnifontProvider(provider, root);
				// Makes sure every font uses the right instance of a given provider
				// if this provider is provided several times with different options
				// We have to mutate the unifont provider name because unifont deduplicates
				// based on the name.
				unifontProvider._name = this.idFromProvider({
					hasher,
					provider
				});
				providers.set(id, unifontProvider);
			}
		}
		return Array.from(providers.values());
	}
	static async create({ families, hasher, storage, root }) {
		return new UnifontFontResolver({
			unifont: await createUnifont(this.extractUnifontProviders({
				families,
				hasher,
				root
			}), {
				storage,
				// TODO: consider enabling, would require new astro errors
				throwOnError: false
			}),
			hasher
		});
	}
	async resolveFont({ familyName, provider, options, ...rest }) {
		const id = UnifontFontResolver.idFromProvider({
			hasher: this.#hasher,
			provider
		});
		const { fonts } = await this.#unifont.resolveFont(familyName, {
			// Options are currently namespaced by provider name, it may change in
			// https://github.com/unjs/unifont/pull/287
			options: { [id]: options },
			...rest
		}, [id]);
		return fonts;
	}
	async getFontProperties({ familyName, provider }) {
		const properties = await this.#unifont.getFontProperties(familyName, [UnifontFontResolver.idFromProvider({
			hasher: this.#hasher,
			provider
		})]);
		if (!properties) {
			return undefined;
		}
		// The provider name is an internal id, it's not useful to consumers
		const { provider: _, ...rest } = properties;
		return rest;
	}
	async listFonts({ provider }) {
		return await this.#unifont.listFonts([UnifontFontResolver.idFromProvider({
			hasher: this.#hasher,
			provider
		})]);
	}
}
