import { getPropagationHint as getHint, isPropagatingHint } from "../../../../core/head-propagation/resolver.js";
export function isAstroComponentFactory(obj) {
	return obj == null ? false : obj.isAstroComponentFactory === true;
}
export function isAPropagatingComponent(result, factory) {
	return isPropagatingHint(getPropagationHint(result, factory));
}
export function getPropagationHint(result, factory) {
	return getHint(result, factory);
}
