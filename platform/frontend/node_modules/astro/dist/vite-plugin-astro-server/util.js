import { isCSSRequest } from "vite";
export const rawRE = /(?:\?|&)raw(?:&|$)/;
export const inlineRE = /(?:\?|&)inline\b/;
export const isBuildableCSSRequest = (request) => isCSSRequest(request) && !rawRE.test(request) && !inlineRE.test(request);
