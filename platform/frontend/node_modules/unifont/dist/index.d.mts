//#region src/providers/adobe.d.ts
interface AdobeProviderOptions {
  id: string[] | string;
}
declare const _default$6: (options: AdobeProviderOptions) => Provider<"adobe", never>;
//#endregion
//#region src/providers/bunny.d.ts
declare const _default$5: () => Provider<"bunny", never>;
//#endregion
//#region src/providers/fontshare.d.ts
declare const _default$4: () => Provider<"fontshare", never>;
//#endregion
//#region src/providers/fontsource.d.ts
declare const _default$3: () => Provider<"fontsource", never>;
//#endregion
//#region src/utils.d.ts
export declare function defineFontProvider<Name extends string, Provider extends ProviderDefinition<never, never>>(name: Name, provider: Provider): Provider extends ProviderDefinition<infer Options, infer FamilyOptions> ? ProviderFactory<Name, Options, FamilyOptions> : never;
declare const formatMap: {
  woff2: string;
  woff: string;
  otf: string;
  ttf: string;
  eot: string;
};
//#endregion
//#region src/types.d.ts
type Awaitable$1<T> = T | Promise<T>;
interface ProviderContext {
  storage: {
    getItem: {
      <T = unknown>(key: string): Promise<T | null>;
      <T = unknown>(key: string, init: () => Awaitable$1<T>): Promise<T>;
    };
    setItem: (key: string, value: unknown) => Awaitable$1<void>;
  };
  /**
   * Requests a provider API, retrying transient failures. Requests are routed through the
   * `apiBase` proxy if one is configured, so providers should always request the upstream URL.
   */
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
}
type FontStyles = 'normal' | 'italic' | 'oblique';
type FontFormat = keyof typeof formatMap;
/** A registered OpenType variation axis tag, such as `opsz`, `slnt` or `wdth`. */
type VariableAxis = 'opsz' | 'slnt' | 'wdth' | (string & {});
type VariableAxisBound = number | string;
/** A single axis value (`1`) or an inclusive range of values (`{ min: 0, max: 1 }`). */
type VariableAxisValue = VariableAxisBound | [VariableAxisBound, VariableAxisBound] | {
  min: VariableAxisBound;
  max: VariableAxisBound;
};
/** A `variableAxis` request with every value normalised to a single value or a `[min, max]` pair. */
type NormalizedVariableAxis = Partial<Record<VariableAxis, (string | [string, string])[]>>;
interface ResolvedVariableAxis {
  values: (string | [string, string])[];
  /**
   * `font-file` when the file is instanced or limited to these values, `variation-settings` when
   * they are in the descriptor, and `none` when they are left for you to apply.
   */
  appliedAs: 'font-file' | 'variation-settings' | 'none';
}
/** The range of values a family publishes for a variation axis. */
interface FontAxis {
  tag: VariableAxis;
  min: number;
  max: number;
  defaultValue: number;
}
interface ResolveFontOptions<FamilyOptions extends Record<string, any> | never = never> {
  weights: string[];
  styles: FontStyles[];
  subsets: string[];
  formats: FontFormat[];
  /**
   * Values to request for variation axes other than weight and style, keyed by axis tag.
   * `variableAxis` on the result reports what became of each one.
   * @example { CASL: [1], slnt: [{ min: -15, max: 0 }] }
   */
  variableAxis?: Partial<Record<VariableAxis, VariableAxisValue[]>>;
  options?: [FamilyOptions] extends [never] ? undefined : FamilyOptions;
}
/** The options a provider receives, with every `variableAxis` value normalised. */
interface ProviderResolveFontOptions<FamilyOptions extends Record<string, any> | never = never> extends Omit<ResolveFontOptions<FamilyOptions>, 'variableAxis'> {
  variableAxis?: NormalizedVariableAxis;
}
interface RemoteFontSource {
  url: string;
  originalURL?: string;
  format?: string;
  tech?: string;
}
interface LocalFontSource {
  name: string;
}
interface FontFaceMeta {
  /** The priority of the font face, usually used to indicate fallbacks. Smaller is more prioritized. */
  priority?: number;
  /**
   * The subset name of the font face. Many fonts provides font subsets such as latin, latin-ext, cyrillic, etc.
   */
  subset?: string;
  /**
   * A `RequestInit` object that should be used when fetching this font. This can be useful for
   * adding authorization headers and other metadata required for a font request.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/RequestInit
   */
  init?: RequestInit;
}
/**
 * Font metrics in font units, using the same vocabulary as `@capsizecss/metrics`, from which
 * fallback metric overrides (`size-adjust`, `ascent-override`, ...) can be calculated without
 * downloading and parsing the font file.
 */
interface FontMetrics {
  /** The number of font units per em square. */
  unitsPerEm: number;
  /** The ascender, in font units. */
  ascent?: number;
  /** The descender, in font units. Usually negative. */
  descent?: number;
  /** The line gap, in font units. */
  lineGap?: number;
  /** The height of capital letters, in font units. */
  capHeight?: number;
  /** The height of lowercase letters, in font units. */
  xHeight?: number;
  /** The average width of a lowercase character, in font units. */
  xWidthAvg?: number;
}
interface FontFaceData {
  src: Array<LocalFontSource | RemoteFontSource>;
  /**
   * The font-display descriptor.
   * @default 'swap'
   */
  display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
  /** A font-weight value. */
  weight?: string | number | [number, number];
  /** A font-stretch value. */
  stretch?: string;
  /** A font-style value. */
  style?: string;
  /** The range of Unicode code points to be used from the font. */
  unicodeRange?: string[];
  /** Allows control over advanced typographic features in OpenType fonts. */
  featureSettings?: string;
  /** Allows low-level control over OpenType or TrueType font variations, by specifying the four letter axis names of the features to vary, along with their variation values. */
  variationSettings?: string;
  /**
   * Metrics reported by the provider for this font face, if it knows them.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/size-adjust
   */
  metrics?: FontMetrics;
  /** Metadata for the font face used by unifont */
  meta?: FontFaceMeta;
}
interface ResolveFontResult {
  /**
   * What became of each axis requested through `variableAxis`, for a consumer that can instance
   * the font file itself. `undefined` when no axes were requested.
   */
  variableAxis?: Partial<Record<VariableAxis, ResolvedVariableAxis>>;
  /**
   * Values the returned font file is instanced or limited to, keyed by axis tag, set by providers
   * that instance. unifont derives `variableAxis` from it and does not pass it on.
   */
  appliedVariableAxis?: NormalizedVariableAxis;
  /**
   * Return data used to generate @font-face declarations.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face
   */
  fonts: FontFaceData[];
  fallbacks?: string[];
}
interface FontProperties {
  /**
   * Weights available for the font family. Values are either discrete weights (`'400'`)
   * or variable ranges expressed as `'<min> <max>'` (`'100 900'`).
   */
  weights?: string[];
  /** Styles available for the font family. */
  styles?: FontStyles[];
  /**
   * Subsets available for the font family. `undefined` means the provider does not
   * expose subset information, not that no subsets are available.
   */
  subsets?: string[];
  /**
   * Formats the provider can serve. This reflects provider capability rather than
   * per-family availability, so some formats may not exist for every family.
   */
  formats?: FontFormat[];
  /**
   * Variation axes the family publishes, for use with the `variableAxis` resolve option.
   * `undefined` means the provider does not expose axis information, not that the family
   * has no axes.
   */
  axes?: FontAxis[];
  /**
   * Metrics for the family's default font face, if the provider knows them. Individual
   * faces may report different metrics from `resolveFont`.
   */
  metrics?: FontMetrics;
}
interface InitializedProvider<FamilyOptions extends Record<string, any> = never> {
  resolveFont: (family: string, options: ProviderResolveFontOptions<FamilyOptions>) => Awaitable$1<ResolveFontResult | undefined>;
  /**
   * Returns the properties available for a font family, or `undefined` when the
   * provider does not know the family (so unifont consults later providers).
   */
  getFontProperties?: (family: string) => Awaitable$1<FontProperties | undefined>;
  listFonts?: (() => Awaitable$1<string[] | undefined>) | undefined;
}
interface ProviderDefinition<Options extends Record<string, any> = never, FamilyOptions extends Record<string, any> = never> {
  (options: Options, ctx: ProviderContext): Awaitable$1<InitializedProvider<FamilyOptions> | undefined>;
}
interface Provider<Name extends string = string, FamilyOptions extends Record<string, any> = never> {
  _name: Name;
  _options: unknown;
  (ctx: ProviderContext): Awaitable$1<InitializedProvider<FamilyOptions> | undefined>;
}
type ProviderFactory<Name extends string, Options extends Record<string, any> = never, FamilyOptions extends Record<string, any> = never> = [Options] extends [never] ? () => Provider<Name, FamilyOptions> : Partial<Options> extends Options ? (options?: Options) => Provider<Name, FamilyOptions> : (options: Options) => Provider<Name, FamilyOptions>;
//#endregion
//#region src/providers/google.d.ts
interface GoogleProviderOptions {
  experimental?: {
    /**
     * Experimental: Setting variable axis configuration on a per-font basis.
     */
    variableAxis?: {
      [fontFamily: string]: Partial<Record<VariableAxis, VariableAxisValue[]>>;
    };
    /**
     * Experimental: Specifying a list of glyphs to be included in the font for each font family.
     * This can reduce the size of the font file.
     */
    glyphs?: {
      [fontFamily: string]: string[];
    };
  };
}
interface GoogleFamilyOptions {
  experimental?: {
    /**
     * Experimental: Setting variable axis configuration on a per-font basis.
     */
    variableAxis?: Partial<Record<VariableAxis, VariableAxisValue[]>>;
    /**
     * Experimental: Specifying a list of glyphs to be included in the font for each font family.
     * This can reduce the size of the font file.
     */
    glyphs?: string[];
  };
}
declare const _default$2: (options?: GoogleProviderOptions | undefined) => Provider<"google", GoogleFamilyOptions>;
//#endregion
//#region src/providers/googleicons.d.ts
interface GoogleiconsProviderOptions {
  experimental?: {
    /**
     * Experimental: Specifying a list of icons to be included in the font for each font family.
     * This can reduce the size of the font file.
     *
     * **Only available when resolving the new `Material Symbols` icons.**
     */
    glyphs?: {
      [fontFamily: string]: string[];
    };
  };
}
interface GoogleiconsFamilyOptions {
  experimental?: {
    /**
     * Experimental: Specifying a list of icons to be included in the font for each font family.
     * This can reduce the size of the font file.
     *
     * **Only available when resolving the new `Material Symbols` icons.**
     */
    glyphs?: string[];
  };
}
declare const _default$1: (options?: GoogleiconsProviderOptions | undefined) => Provider<"googleicons", GoogleiconsFamilyOptions>;
//#endregion
//#region src/providers/npm.d.ts
interface NpmProviderOptions {
  /**
   * CDN to use for fetching npm packages remotely.
   * @default 'https://cdn.jsdelivr.net/npm'
   */
  cdn?: string;
  /**
   * Whether to fall back to fetching from the CDN when local resolution
   * fails or `readFile` is not provided.
   *
   * Set to `false` to only resolve from locally installed packages, emitting
   * `file://` URLs for font files found in `node_modules`.
   * This is useful when another provider (e.g. `fontsource`) already
   * handles CDN resolution.
   *
   * @default true
   */
  remote?: boolean;
  /**
   * Optional function to read a file from the local filesystem.
   * When provided, the provider will try to resolve fonts from locally
   * installed packages in `node_modules` before falling back to the CDN
   * (unless `remote` is set to `false`).
   *
   * @example
   * ```ts
   * import { readFile } from 'node:fs/promises'
   * providers.npm({
   *   readFile: path => readFile(path, 'utf-8').catch(() => null),
   *   remote: false, // only resolve from local node_modules
   * })
   * ```
   */
  readFile?: (path: string) => Promise<string | null>;
  /**
   * Optional function to check whether a file exists on the local filesystem.
   * Used when resolving font files with `remote: false`; when not provided,
   * `readFile` is used instead, which reads and decodes the whole font binary.
   *
   * @example
   * ```ts
   * import { access, readFile } from 'node:fs/promises'
   * providers.npm({
   *   readFile: path => readFile(path, 'utf-8').catch(() => null),
   *   exists: path => access(path).then(() => true).catch(() => false),
   *   remote: false,
   * })
   * ```
   */
  exists?: (path: string) => Promise<boolean>;
  /**
   * Optional function to resolve a package-relative specifier (such as
   * `@fontsource/roboto/index.css`) to an absolute path on disk.
   *
   * Return `null` (or throw) when the package is not installed; the provider
   * treats that as "not available locally" and falls back to the CDN unless
   * `remote` is `false`.
   *
   * When not provided, `import.meta.resolve` is used, falling back to
   * `<root>/node_modules/<specifier>`. Supplying a resolver is necessary for
   * layouts where the package is not linked into a `node_modules` directory
   * under `root`: pnpm's isolated store, hoisting to a monorepo root, Yarn PnP,
   * or a bundler alias.
   *
   * @example
   * ```ts
   * import { fileURLToPath } from 'node:url'
   * providers.npm({
   *   resolve: id => fileURLToPath(import.meta.resolve(id)),
   * })
   * ```
   */
  resolve?: (id: string) => string | null | Promise<string | null>;
  /**
   * Root directory of the project for resolving local packages.
   * Used to find `package.json`, and `node_modules` when no `resolve` function
   * is provided.
   * @default '.' (current working directory)
   */
  root?: string;
}
interface NpmFamilyOptions {
  /**
   * The npm package name.
   * When not specified, the provider will try to find the font family
   * in known font package patterns (e.g. `@fontsource/${family}`).
   */
  package?: string;
  /**
   * The version of the package (used for CDN resolution only).
   * @default 'latest'
   */
  version?: string;
  /**
   * The entry CSS file to parse from the package.
   *
   * When not specified, per-weight and per-style entry points
   * (`<weight>.css`, `<weight>-italic.css`) are resolved for the requested
   * weights and styles, falling back to `index.css` and then to the
   * stylesheet declared in the package's `package.json` `style` or `main`
   * field.
   *
   * When set, and the file declares exactly one family, that family is used
   * whatever its name. This is how icon fonts that name their face something
   * other than the requested family (such as `css/solid.css` in
   * `@fortawesome/fontawesome-free`) are resolved.
   */
  file?: string;
}
declare const _default: (options?: NpmProviderOptions | undefined) => Provider<"npm", NpmFamilyOptions>;
declare namespace providers_d_exports {
  export { _default$6 as adobe, _default$5 as bunny, _default$4 as fontshare, _default$3 as fontsource, _default$2 as google, _default$1 as googleicons, _default as npm };
}
//#endregion
//#region src/cache.d.ts
type Awaitable<T> = T | Promise<T>;
type StorageValue = string | Record<string, unknown>;
interface Storage {
  getItem: (key: string) => Awaitable<any | null>;
  setItem: <T extends StorageValue = StorageValue>(key: string, value: T) => Awaitable<void>;
}
//#endregion
//#region src/unifont.d.ts
interface UnifontOptions {
  storage?: Storage;
  throwOnError?: boolean;
  /**
   * Base URL of a `unifont` proxy to route provider API requests through, for environments
   * (browsers, web containers) that cannot call the provider APIs directly. Providers whose APIs
   * are already reachable cross-origin, such as `npm`, are unaffected.
   *
   * Defaults to `https://proxy.unifont.dev` in a browser or a StackBlitz web container, where the
   * provider APIs are unreachable anyway, and to no proxy elsewhere. Pass `false` to always
   * request the provider APIs directly.
   *
   * **Experimental.** `https://proxy.unifont.dev` is best-effort, rate-limited at our discretion,
   * and may change or disappear without notice. Deploy your own if you need one in production.
   * @example 'https://proxy.unifont.dev'
   */
  apiBase?: string | false;
}
type ExtractFamilyOptions<T extends Provider> = Exclude<Parameters<NonNullable<Awaited<ReturnType<T>>>['resolveFont']>[1]['options'], undefined>;
interface Unifont<T extends Provider[]> {
  resolveFont: (fontFamily: string, options?: Partial<ResolveFontOptions<{ [K in T[number] as K['_name']]?: ExtractFamilyOptions<K>; }>>, providers?: T[number]['_name'][]) => Promise<ResolveFontResult & {
    provider?: T[number]['_name'];
  }>;
  getFontProperties: (fontFamily: string, providers?: T[number]['_name'][]) => Promise<(FontProperties & {
    provider?: T[number]['_name'];
  }) | undefined>;
  listFonts: (providers?: T[number]['_name'][]) => Promise<string[] | undefined>;
}
export declare const defaultResolveOptions: ProviderResolveFontOptions;
export declare function createUnifont<T extends [Provider, ...Provider[]]>(providers: T, unifontOptions?: UnifontOptions): Promise<Unifont<T>>;
//#endregion
export { type AdobeProviderOptions, type FontAxis, type FontFaceData, type FontFaceMeta, type FontFormat, type FontMetrics, type FontProperties, type FontStyles, type GoogleFamilyOptions, type GoogleProviderOptions, type GoogleiconsFamilyOptions, type GoogleiconsProviderOptions, type InitializedProvider, type LocalFontSource, type NormalizedVariableAxis, type NpmFamilyOptions, type NpmProviderOptions, type Provider, type ProviderContext, type ProviderDefinition, type ProviderFactory, type ProviderResolveFontOptions, type RemoteFontSource, type ResolveFontOptions, type ResolveFontResult, type ResolvedVariableAxis, type Unifont, type UnifontOptions, type VariableAxis, type VariableAxisBound, type VariableAxisValue, providers_d_exports as providers };