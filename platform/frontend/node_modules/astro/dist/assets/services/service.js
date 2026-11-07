import { isRemoteAllowed } from "@astrojs/internal-helpers/remote";
import { AstroError, AstroErrorData } from "../../core/errors/index.js";
import { isRemotePath, joinPaths } from "../../core/path.js";
import { DEFAULT_HASH_PROPS, VALID_SUPPORTED_FORMATS } from "../consts.js";
import { isESMImportedImage, isRemoteImage } from "../utils/imageKind.js";
import { inferSourceFormat, resolveDefaultOutputFormat } from "../utils/inferSourceFormat.js";
import { inferRemoteSize } from "../utils/remoteProbe.js";
export function isLocalService(service) {
	if (!service) {
		return false;
	}
	return "transform" in service;
}
export function parseQuality(quality) {
	let result = Number.parseInt(quality);
	if (Number.isNaN(result)) {
		return quality;
	}
	return result;
}
const sortNumeric = (a, b) => a - b;
export function verifyOptions(options) {
	// `src` is missing or is `undefined`.
	if (!options.src || !isRemoteImage(options.src) && !isESMImportedImage(options.src)) {
		throw new AstroError({
			...AstroErrorData.ExpectedImage,
			message: AstroErrorData.ExpectedImage.message(JSON.stringify(options.src), typeof options.src, JSON.stringify(options, (_, v) => v === undefined ? null : v))
		});
	}
	if (!isESMImportedImage(options.src)) {
		// User passed an `/@fs/` path or a filesystem path instead of the full image.
		if (options.src.startsWith("/@fs/") || !isRemotePath(options.src) && !options.src.startsWith("/")) {
			throw new AstroError({
				...AstroErrorData.LocalImageUsedWrongly,
				message: AstroErrorData.LocalImageUsedWrongly.message(options.src)
			});
		}
		// For remote images, width and height are explicitly required as we can't infer them from the file
		let missingDimension;
		if (!options.width && !options.height) {
			missingDimension = "both";
		} else if (!options.width && options.height) {
			missingDimension = "width";
		} else if (options.width && !options.height) {
			missingDimension = "height";
		}
		if (missingDimension) {
			throw new AstroError({
				...AstroErrorData.MissingImageDimension,
				message: AstroErrorData.MissingImageDimension.message(missingDimension, options.src)
			});
		}
	} else {
		if (!VALID_SUPPORTED_FORMATS.includes(options.src.format)) {
			throw new AstroError({
				...AstroErrorData.UnsupportedImageFormat,
				message: AstroErrorData.UnsupportedImageFormat.message(options.src.format, options.src.src, VALID_SUPPORTED_FORMATS)
			});
		}
		if (options.widths && options.densities) {
			throw new AstroError(AstroErrorData.IncompatibleDescriptorOptions);
		}
		if (options.src.format !== "svg" && options.format === "svg") {
			throw new AstroError(AstroErrorData.UnsupportedImageConversion);
		}
	}
}
/**
* Basic local service using the included `_image` endpoint.
* This service intentionally does not implement `transform`.
*
* Example usage:
* ```ts
* const service = {
*  getURL: baseService.getURL,
*  parseURL: baseService.parseURL,
*  getHTMLAttributes: baseService.getHTMLAttributes,
*  async transform(inputBuffer, transformOptions) {...}
* }
* ```
*
* This service adhere to the included services limitations:
* - Only a limited amount of formats are supported.
* - For remote images, `width` and `height` are always required.
*
*/
export const baseService = {
	propertiesToHash: DEFAULT_HASH_PROPS,
	validateOptions(options) {
		// Run verification-only checks
		verifyOptions(options);
		// Apply defaults and normalization separate from verification
		if (!options.format) {
			if (isESMImportedImage(options.src)) {
				options.format = resolveDefaultOutputFormat(options.src.format);
			} else {
				const inferred = inferSourceFormat(options.src);
				if (inferred) options.format = resolveDefaultOutputFormat(inferred);
			}
		}
		if (options.width) options.width = Math.round(options.width);
		if (options.height) options.height = Math.round(options.height);
		if (options.layout) {
			delete options.layout;
		}
		if (options.fit === "none") {
			delete options.fit;
		}
		return options;
	},
	getHTMLAttributes(options) {
		const { targetWidth, targetHeight } = getTargetDimensions(options);
		const { src, width, height, format, quality, densities, widths, formats, layout, priority, fit, position, background, ...attributes } = options;
		return {
			...attributes,
			width: targetWidth,
			height: targetHeight,
			loading: attributes.loading ?? "lazy",
			decoding: attributes.decoding ?? "async"
		};
	},
	getSrcSet(options) {
		const { targetWidth, targetHeight } = getTargetDimensions(options);
		const aspectRatio = targetWidth / targetHeight;
		const { widths, densities } = options;
		// When format is undefined the response type is resolved from the buffer at request time,
		// so leave the <source type> attribute off rather than asserting webp.
		const targetFormat = options.format;
		let transformedWidths = (widths ?? []).sort(sortNumeric);
		// For remote images, we don't know the original image's dimensions, so we cannot know the maximum width
		// It is ultimately the user's responsibility to make sure they don't request images larger than the original
		let imageWidth = options.width;
		let maxWidth = Number.POSITIVE_INFINITY;
		// However, if it's an imported image, we can use the original image's width as a maximum width
		if (isESMImportedImage(options.src)) {
			imageWidth = options.src.width;
			maxWidth = imageWidth;
			// We've already sorted the widths, so we'll remove any that are larger than the original image's width
			if (transformedWidths.length > 0 && transformedWidths.at(-1) > maxWidth) {
				transformedWidths = transformedWidths.filter((width) => width <= maxWidth);
				// If we've had to remove some widths, we'll add the maximum width back in
				transformedWidths.push(maxWidth);
			}
		}
		// Dedupe the widths
		transformedWidths = Array.from(new Set(transformedWidths));
		// Since `widths` and `densities` ultimately control the width and height of the image,
		// we don't want the dimensions to be user specified, we'll create those ourselves.
		const { width: transformWidth, height: transformHeight, ...transformWithoutDimensions } = options;
		// Collect widths to generate from specified densities or widths
		let allWidths = [];
		if (densities) {
			// Densities can either be specified as numbers, or descriptors (ex: '1x'), we'll convert them all to numbers
			const densityValues = Array.from(new Set(densities.map((density) => {
				if (typeof density === "number") {
					return density;
				} else {
					return Number.parseFloat(density);
				}
			})));
			// Calculate the widths for each density, rounding to avoid floats.
			const densityWidths = densityValues.sort(sortNumeric).map((density) => Math.round(targetWidth * density));
			allWidths = densityWidths.map((width, index) => ({
				width,
				descriptor: `${densityValues[index]}x`
			}));
		} else if (transformedWidths.length > 0) {
			allWidths = transformedWidths.map((width) => ({
				width,
				descriptor: `${width}w`
			}));
		}
		return allWidths.map(({ width, descriptor }) => {
			const height = Math.round(width / aspectRatio);
			const transform = {
				...transformWithoutDimensions,
				width,
				height
			};
			return {
				transform,
				descriptor,
				attributes: targetFormat ? { type: `image/${targetFormat}` } : {}
			};
		});
	},
	getURL(options, imageConfig) {
		const searchParams = new URLSearchParams();
		if (isESMImportedImage(options.src)) {
			searchParams.append("href", options.src.src);
		} else if (isRemoteAllowed(options.src, imageConfig)) {
			searchParams.append("href", options.src);
		} else {
			// If it's not an imported image, nor is it allowed using the current domains or remote patterns, we'll just return the original URL
			return options.src;
		}
		const params = {
			w: "width",
			h: "height",
			q: "quality",
			f: "format",
			fit: "fit",
			position: "position",
			background: "background"
		};
		Object.entries(params).forEach(([param, key]) => {
			options[key] && searchParams.append(param, options[key].toString());
		});
		const imageEndpoint = joinPaths(import.meta.env.BASE_URL, imageConfig.endpoint.route);
		let url = `${imageEndpoint}?${searchParams}`;
		// Append assetQueryParams if available (for adapter-level tracking like skew protection)
		if (imageConfig.assetQueryParams) {
			const assetQueryString = imageConfig.assetQueryParams.toString();
			if (assetQueryString) {
				url += "&" + assetQueryString;
			}
		}
		return url;
	},
	parseURL(url) {
		const params = url.searchParams;
		if (!params.has("href")) {
			return undefined;
		}
		const transform = {
			src: params.get("href"),
			width: params.has("w") ? Number.parseInt(params.get("w")) : undefined,
			height: params.has("h") ? Number.parseInt(params.get("h")) : undefined,
			format: params.has("f") ? params.get("f") : undefined,
			quality: params.get("q"),
			fit: params.get("fit"),
			position: params.get("position") ?? undefined,
			background: params.get("background") ?? undefined
		};
		return transform;
	},
	getRemoteSize(url, imageConfig) {
		return inferRemoteSize(url, imageConfig);
	}
};
/**
* Returns the final dimensions of an image based on the user's options.
*
* For local images:
* - If the user specified both width and height, we'll use those.
* - If the user specified only one of them, we'll use the original image's aspect ratio to calculate the other.
* - If the user didn't specify either, we'll use the original image's dimensions.
*
* For remote images:
* - Widths and heights are always required, so we'll use the user's specified width and height.
*/
function getTargetDimensions(options) {
	let targetWidth = options.width;
	let targetHeight = options.height;
	if (isESMImportedImage(options.src)) {
		const aspectRatio = options.src.width / options.src.height;
		if (targetHeight && !targetWidth) {
			// If we have a height but no width, use height to calculate the width
			targetWidth = Math.round(targetHeight * aspectRatio);
		} else if (targetWidth && !targetHeight) {
			// If we have a width but no height, use width to calculate the height
			targetHeight = Math.round(targetWidth / aspectRatio);
		} else if (!targetWidth && !targetHeight) {
			// If we have neither width or height, use the original image's dimensions
			targetWidth = options.src.width;
			targetHeight = options.src.height;
		}
	}
	// TypeScript doesn't know this, but because of previous hooks we always know that targetWidth and targetHeight are defined
	return {
		targetWidth,
		targetHeight
	};
}
