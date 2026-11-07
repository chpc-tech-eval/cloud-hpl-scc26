import { createKey, encodeKey } from "../../../core/encryption.js";
export class CryptoKeyGenerator {
	async generate() {
		const key = await createKey();
		const encoded = await encodeKey(key);
		return encoded;
	}
}
