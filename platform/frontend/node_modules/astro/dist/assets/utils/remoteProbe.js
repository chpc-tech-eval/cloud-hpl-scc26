import { isRemoteAllowed } from "@astrojs/internal-helpers/remote";
import { AstroError, AstroErrorData } from "../../core/errors/index.js";
import { imageMetadata } from "./metadata.js";
import { fetchWithRedirects } from "./redirectValidation.js";
/**
* Infers the dimensions of a remote image by streaming its data and analyzing it progressively until sufficient metadata is available.
*
* @param {string} url - The URL of the remote image from which to infer size metadata.
* @param {RemoteImageConfig} [imageConfig] - Optional image config used to validate remote allowlists.
* @return {Promise<Omit<ImageMetadata, 'src' | 'fsPath'>>} Returns a promise that resolves to an object containing the image dimensions metadata excluding `src` and `fsPath`.
* @throws {AstroError} Thrown when the fetching fails or metadata cannot be extracted.
*/
export async function inferRemoteSize(url, imageConfig) {
	if (!URL.canParse(url)) {
		throw new AstroError({
			...AstroErrorData.FailedToFetchRemoteImageDimensions,
			message: AstroErrorData.FailedToFetchRemoteImageDimensions.message(url)
		});
	}
	const allowlistConfig = imageConfig ? {
		domains: imageConfig.domains ?? [],
		remotePatterns: imageConfig.remotePatterns ?? []
	} : undefined;
	if (!allowlistConfig) {
		const parsedUrl = new URL(url);
		if (!["http:", "https:"].includes(parsedUrl.protocol)) {
			throw new AstroError({
				...AstroErrorData.FailedToFetchRemoteImageDimensions,
				message: AstroErrorData.FailedToFetchRemoteImageDimensions.message(url)
			});
		}
	}
	if (allowlistConfig && !isRemoteAllowed(url, allowlistConfig)) {
		throw new AstroError({
			...AstroErrorData.RemoteImageNotAllowed,
			message: AstroErrorData.RemoteImageNotAllowed.message(url)
		});
	}
	// Start fetching the image with redirect validation
	let response;
	try {
		response = await fetchWithRedirects({
			url,
			onMaxRedirectsExceeded: (u) => new AstroError({
				...AstroErrorData.FailedToFetchRemoteImageDimensions,
				message: AstroErrorData.FailedToFetchRemoteImageDimensions.message(u)
			}),
			onMissingLocationHeader: (_status, u) => new AstroError({
				...AstroErrorData.FailedToFetchRemoteImageDimensions,
				message: AstroErrorData.FailedToFetchRemoteImageDimensions.message(u)
			}),
			imageConfig: imageConfig ?? {
				remotePatterns: [],
				domains: []
			}
		});
	} catch (_err) {
		throw new AstroError({
			...AstroErrorData.FailedToFetchRemoteImageDimensions,
			message: AstroErrorData.FailedToFetchRemoteImageDimensions.message(url)
		});
	}
	// Validate that the final URL (after redirects) is allowed
	if (allowlistConfig && !isRemoteAllowed(response.url, allowlistConfig)) {
		throw new AstroError({
			...AstroErrorData.RemoteImageNotAllowed,
			message: AstroErrorData.RemoteImageNotAllowed.message(url)
		});
	}
	if (!response.body || !response.ok) {
		throw new AstroError({
			...AstroErrorData.FailedToFetchRemoteImageDimensions,
			message: AstroErrorData.FailedToFetchRemoteImageDimensions.message(url)
		});
	}
	const reader = response.body.getReader();
	let done, value;
	let accumulatedChunks = new Uint8Array();
	// Process the stream chunk by chunk
	while (!done) {
		const readResult = await reader.read();
		done = readResult.done;
		if (done) break;
		if (readResult.value) {
			value = readResult.value;
			// Accumulate chunks
			let tmp = new Uint8Array(accumulatedChunks.length + value.length);
			tmp.set(accumulatedChunks, 0);
			tmp.set(value, accumulatedChunks.length);
			accumulatedChunks = tmp;
			try {
				// Attempt to determine the size with each new chunk
				const dimensions = await imageMetadata(accumulatedChunks, url);
				if (dimensions) {
					await reader.cancel();
					return dimensions;
				}
			} catch {}
		}
	}
	throw new AstroError({
		...AstroErrorData.NoImageMetadata,
		message: AstroErrorData.NoImageMetadata.message(url)
	});
}
