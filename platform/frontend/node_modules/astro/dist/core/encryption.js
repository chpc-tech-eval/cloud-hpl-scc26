import { decodeBase64, decodeHex, encodeBase64, encodeHexLowerCase, encodeHexUpperCase } from "@oslojs/encoding";
import { ALGORITHMS } from "./csp/config.js";
// Chose this algorithm for no particular reason, can change.
// This algo does check against text manipulation though. See
// https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt#aes-gcm
const ALGORITHM = "AES-GCM";
/**
* Creates a CryptoKey object that can be used to encrypt any string.
*/
export async function createKey() {
	const key = await crypto.subtle.generateKey({
		name: ALGORITHM,
		length: 256
	}, true, ["encrypt", "decrypt"]);
	return key;
}
// The environment variable name that can be used to provide the encrypted key.
const ENVIRONMENT_KEY_NAME = "ASTRO_KEY";
/**
* Get the encoded value of the ASTRO_KEY env var.
*/
function getEncodedEnvironmentKey() {
	return process.env[ENVIRONMENT_KEY_NAME] || "";
}
/**
* See if the environment variable key ASTRO_KEY is set.
*/
export function hasEnvironmentKey() {
	return getEncodedEnvironmentKey() !== "";
}
/**
* Get the environment variable key and decode it into a CryptoKey.
*/
export async function getEnvironmentKey() {
	// This should never happen, because we always check `hasEnvironmentKey` before this is called.
	if (!hasEnvironmentKey()) {
		throw new Error(`There is no environment key defined. If you see this error there is a bug in Astro.`);
	}
	const encodedKey = getEncodedEnvironmentKey();
	return decodeKey(encodedKey);
}
/**
* Hash a CryptoKey into a one-way hex digest safe to persist. Server-island
* ciphertext is bound to the key, so the incremental build cache uses this to
* detect when the key changed between builds.
*/
export async function hashCryptoKey(key) {
	const exported = await crypto.subtle.exportKey("raw", key);
	const digest = await crypto.subtle.digest("SHA-256", exported);
	return encodeHexLowerCase(new Uint8Array(digest));
}
/**
* Encodes a CryptoKey to base64 string, so that it can be embedded in JSON / JavaScript
*/
export async function encodeKey(key) {
	const exported = await crypto.subtle.exportKey("raw", key);
	const encodedKey = encodeBase64(new Uint8Array(exported));
	return encodedKey;
}
/**
* Decodes a base64 string into bytes and then imports the key.
*/
export async function decodeKey(encoded) {
	const bytes = decodeBase64(encoded);
	return crypto.subtle.importKey("raw", bytes.buffer, ALGORITHM, true, ["encrypt", "decrypt"]);
}
const encoder = new TextEncoder();
const decoder = new TextDecoder();
// The length of the initialization vector
// See https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams
const IV_LENGTH = 24;
/**
* Using a CryptoKey, encrypt a string into a base64 string.
* @param additionalData Optional authenticated context (e.g. "props:ComponentName") that is
*   verified during decryption but not included in the ciphertext. Both sides must agree on
*   the same value or decryption will fail.
*/
export async function encryptString(key, raw, additionalData) {
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH / 2));
	const data = encoder.encode(raw);
	const params = {
		name: ALGORITHM,
		iv
	};
	if (additionalData) {
		params.additionalData = encoder.encode(additionalData);
	}
	const buffer = await crypto.subtle.encrypt(params, key, data);
	// iv is 12, hex brings it to 24
	return encodeHexUpperCase(iv) + encodeBase64(new Uint8Array(buffer));
}
/**
* Takes a base64 encoded string, decodes it and returns the decrypted text.
* @param additionalData Must match the value used during encryption, or decryption will fail.
*/
export async function decryptString(key, encoded, additionalData) {
	const iv = decodeHex(encoded.slice(0, IV_LENGTH));
	const dataArray = decodeBase64(encoded.slice(IV_LENGTH));
	const params = {
		name: ALGORITHM,
		iv
	};
	if (additionalData) {
		params.additionalData = encoder.encode(additionalData);
	}
	const decryptedBuffer = await crypto.subtle.decrypt(params, key, dataArray);
	const decryptedString = decoder.decode(decryptedBuffer);
	return decryptedString;
}
/**
* Generates an SHA-256 digest of the given string.
* @param {string} data The string to hash.
* @param {CspAlgorithm} algorithm The algorithm to use.
*/
export async function generateCspDigest(data, algorithm) {
	const hashBuffer = await crypto.subtle.digest(algorithm, encoder.encode(data));
	const hash = encodeBase64(new Uint8Array(hashBuffer));
	return `${ALGORITHMS[algorithm]}${hash}`;
}
/**
* Generate SHA-256 hash of buffer.
* @param {ArrayBuffer} data The buffer data to hash
* @returns {Promise<string>} A hex string of the first 16 characters of the SHA-256 hash
*/
export async function generateContentHash(data) {
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = new Uint8Array(hashBuffer);
	return encodeBase64(hashArray);
}
