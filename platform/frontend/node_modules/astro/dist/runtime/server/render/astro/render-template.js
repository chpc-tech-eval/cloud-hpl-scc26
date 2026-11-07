import { markHTMLString } from "../../escape.js";
import { isPromise } from "../../util.js";
import { renderChild } from "../any.js";
import { createBufferedRenderer } from "../util.js";
const renderTemplateResultSym = Symbol.for("astro.renderTemplateResult");
const markedHtmlParts = new WeakMap();
function markHtmlParts(htmlParts) {
	let marked = markedHtmlParts.get(htmlParts);
	if (marked === undefined) {
		marked = new Array(htmlParts.length);
		for (let i = 0; i < htmlParts.length; i++) {
			marked[i] = htmlParts[i] ? markHTMLString(htmlParts[i]) : htmlParts[i];
		}
		markedHtmlParts.set(htmlParts, marked);
	}
	return marked;
}
// The return value when rendering a component.
// This is the result of calling render(), should this be named to RenderResult or...?
export class RenderTemplateResult {
	[renderTemplateResultSym] = true;
	htmlParts;
	expressions;
	error;
	wrapped;
	constructor(htmlParts, expressions) {
		this.htmlParts = htmlParts;
		this.error = undefined;
		this.expressions = expressions;
	}
	catchExpressionError(index, expression) {
		// Wrap Promise expressions so we can catch errors
		// There can only be 1 error that we rethrow from an Astro component,
		// so this keeps track of whether or not we have already done so.
		// Re-wrapping hits the `this.error` guard and resolves, swallowing the rejection.
		if (this.wrapped?.has(index)) return expression;
		const wrapped = Promise.resolve(expression).catch((err) => {
			if (!this.error) {
				this.error = err;
				throw err;
			}
		});
		(this.wrapped ??= new Set()).add(index);
		this.expressions[index] = wrapped;
		return wrapped;
	}
	render(destination) {
		// Fast path: render HTML parts and expressions directly to the
		// destination without buffering. If all expressions are sync,
		// this avoids all BufferedRenderer allocations. When an async
		// expression is encountered, fall back to buffered rendering
		// for the remaining expressions to preserve output ordering.
		//
		// Template structure: html[0] exp[0] html[1] exp[1] ... html[N]
		// (htmlParts.length === expressions.length + 1)
		const { expressions } = this;
		const htmlParts = markHtmlParts(this.htmlParts);
		for (let i = 0; i < htmlParts.length; i++) {
			const html = htmlParts[i];
			if (html) {
				destination.write(html);
			}
			// expressions[i] doesn't exist for the last htmlPart
			if (i >= expressions.length) break;
			let exp = expressions[i];
			// Skip render if falsy, except the number 0
			if (!(exp || exp === 0)) continue;
			if (isPromise(exp)) exp = this.catchExpressionError(i, exp);
			const result = renderChild(destination, exp);
			if (isPromise(result)) {
				// This expression is async. Buffer remaining expressions
				// in parallel to preserve ordering, then flush sequentially.
				const startIdx = i + 1;
				const remaining = expressions.length - startIdx;
				const flushers = new Array(remaining);
				for (let j = 0; j < remaining; j++) {
					let rExp = expressions[startIdx + j];
					if (isPromise(rExp)) rExp = this.catchExpressionError(startIdx + j, rExp);
					flushers[j] = createBufferedRenderer(destination, (bufferDestination) => {
						if (rExp || rExp === 0) {
							return renderChild(bufferDestination, rExp);
						}
					});
				}
				return result.then(() => {
					let k = 0;
					const iterate = () => {
						while (k < flushers.length) {
							// Write the HTML part that precedes this expression
							const rHtml = htmlParts[startIdx + k];
							if (rHtml) {
								destination.write(rHtml);
							}
							const flushResult = flushers[k++].flush();
							if (isPromise(flushResult)) {
								return flushResult.then(iterate);
							}
						}
						// Write the final trailing HTML part
						const lastHtml = htmlParts[htmlParts.length - 1];
						if (lastHtml) {
							destination.write(lastHtml);
						}
					};
					return iterate();
				});
			}
		}
	}
}
// Determines if a component is an .astro component
export function isRenderTemplateResult(obj) {
	return typeof obj === "object" && obj !== null && !!obj[renderTemplateResultSym];
}
export function renderTemplate(htmlParts, ...expressions) {
	return new RenderTemplateResult(htmlParts, expressions);
}
