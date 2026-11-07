import { RegexEngine } from "@shikijs/types";
/**
 * Raw JavaScript regex engine that only supports precompiled grammars.
 *
 * This further simplifies the engine by excluding the regex compilation step.
 *
 * Zero dependencies.
 */
export declare function createJavaScriptRawEngine(): RegexEngine;