import { createRenderInstruction } from "./instruction.js";
const TEMPLATE_ENTER = Object.freeze(createRenderInstruction({ type: "template-enter" }));
const TEMPLATE_EXIT = Object.freeze(createRenderInstruction({ type: "template-exit" }));
/**
* Emitted by the compiler when entering an HTML `<template>` element.
*/
export function templateEnter(_result) {
	return TEMPLATE_ENTER;
}
/**
* Emitted by the compiler when exiting an HTML `<template>` element.
*/
export function templateExit(_result) {
	return TEMPLATE_EXIT;
}
