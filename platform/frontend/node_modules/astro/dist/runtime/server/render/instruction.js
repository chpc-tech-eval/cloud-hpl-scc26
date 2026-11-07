const RenderInstructionSymbol = Symbol.for("astro:render");
export function createRenderInstruction(instruction) {
	instruction[RenderInstructionSymbol] = true;
	return instruction;
}
export function isRenderInstruction(chunk) {
	return chunk && typeof chunk === "object" && chunk[RenderInstructionSymbol];
}
export function isScriptInstruction(chunk) {
	return chunk && typeof chunk === "object" && "type" in chunk && chunk.type === "script";
}
