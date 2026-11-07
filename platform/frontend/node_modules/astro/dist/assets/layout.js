// Common screen widths. These will be filtered according to the image size and layout
export const DEFAULT_RESOLUTIONS = [
	640,
	750,
	828,
	960,
	1080,
	1280,
	1668,
	1920,
	2048,
	2560,
	3200,
	3840,
	4480,
	5120,
	6016
];
// A more limited set of screen widths, for statically generated images
export const LIMITED_RESOLUTIONS = [
	640,
	750,
	828,
	1080,
	1280,
	1668,
	2048,
	2560
];
/**
* Gets the breakpoints for an image, based on the layout and width
*
* The rules are as follows:
*
* - For full-width layout we return all breakpoints smaller than the original image width
* - For fixed layout we return 1x and 2x the requested width, unless the original image is smaller than that.
* - For responsive layout we return all breakpoints smaller than 2x the requested width, unless the original image is smaller than that.
*/
export const getWidths = ({ width, layout, breakpoints = DEFAULT_RESOLUTIONS, originalWidth }) => {
	const smallerThanOriginal = (w) => !originalWidth || w <= originalWidth;
	// For full-width layout we return all breakpoints smaller than the original image width
	if (layout === "full-width") {
		return breakpoints.filter(smallerThanOriginal);
	}
	// For other layouts we need a width to generate breakpoints. If no width is provided, we return an empty array
	if (!width) {
		return [];
	}
	const doubleWidth = width * 2;
	// For fixed layout we want to return the 1x and 2x widths. We only do this if the original image is large enough to do this though.
	const maxSize = originalWidth ? Math.min(doubleWidth, originalWidth) : doubleWidth;
	if (layout === "fixed") {
		return originalWidth && width > originalWidth ? [originalWidth] : [width, maxSize];
	}
	// For constrained layout we want to return all breakpoints smaller than 2x requested width.
	if (layout === "constrained") {
		return [
			width,
			doubleWidth,
			...breakpoints
		].filter((w) => w <= maxSize).sort((a, b) => a - b);
	}
	return [];
};
/**
* Gets the `sizes` attribute for an image, based on the layout and width
*/
export const getSizesAttribute = ({ width, layout }) => {
	if (!width || !layout) {
		return undefined;
	}
	switch (layout) {
		// If screen is wider than the max size then image width is the max size,
		// otherwise it's the width of the screen
		case "constrained": return `(min-width: ${width}px) ${width}px, 100vw`;
		// Image is always the same width, whatever the size of the screen
		case "fixed": return `${width}px`;
		// Image is always the width of the screen
		case "full-width": return `100vw`;
		case "none":
		default: return undefined;
	}
};
