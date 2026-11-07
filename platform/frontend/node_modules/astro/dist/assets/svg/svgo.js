import { optimize } from "svgo";
/** SVG optimizer using [SVGO](https://svgo.dev/). */
export function svgoOptimizer(config) {
	return {
		name: "svgo",
		optimize: (contents, path) => optimize(contents, {
			...config,
			path
		}).data
	};
}
