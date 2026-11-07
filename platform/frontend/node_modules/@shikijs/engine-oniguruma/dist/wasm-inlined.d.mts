import { W as WebAssemblyInstantiator } from './chunk-index.d.mjs';

declare const wasmBinaryPromise: Promise<Uint8Array<ArrayBuffer>>;
declare const getWasmInstance: WebAssemblyInstantiator;

export { getWasmInstance as default, getWasmInstance, wasmBinaryPromise };
