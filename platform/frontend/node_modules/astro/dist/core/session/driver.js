import { createAsyncManifestMemo } from "../manifest/memo.js";
const sessionDriverMemo = createAsyncManifestMemo(async (manifest) => {
	// Try to load the driver from the manifest; `null` (no driver configured
	// or the module has no default export) is cached like any other value.
	if (manifest.sessionDriver) {
		const driverModule = await manifest.sessionDriver();
		return driverModule?.default || null;
	}
	return null;
});
/** Resolves the session driver factory from the manifest, `null` when none. */
export function getSessionDriver(manifest) {
	return sessionDriverMemo.get(manifest);
}
