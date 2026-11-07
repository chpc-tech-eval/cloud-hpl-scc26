import { createOnigurumaEngine } from "shiki/engine/oniguruma";
export function loadShikiEngine() {
	return createOnigurumaEngine(import("shiki/wasm"));
}
