import { createOnigurumaEngine } from "shiki/engine/oniguruma";
export function loadShikiEngine() {
	// @ts-ignore wasm type
	return createOnigurumaEngine(import("shiki/onig.wasm"));
}
