import { DEFAULT_404_ROUTE } from "./internal/astro-designed-error-pages.js";
import { isRoute404 } from "./internal/route-errors.js";
export function ensure404Route(manifest) {
	if (!manifest.routes.some((route) => isRoute404(route.route))) {
		manifest.routes.push(DEFAULT_404_ROUTE);
	}
	return manifest;
}
