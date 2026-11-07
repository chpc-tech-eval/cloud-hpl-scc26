import { isPromise } from "../../util.js";
import { renderChild } from "../any.js";
import { registerIfPropagating } from "../head-propagation/runtime.js";
import { isHeadAndContent } from "./head-and-content.js";
const astroComponentInstanceSym = Symbol.for("astro.componentInstance");
const CLIENT_DIRECTIVE_PREFIX = "client:";
export class AstroComponentInstance {
	[astroComponentInstanceSym] = true;
	result;
	props;
	slotValues;
	factory;
	returnValue;
	constructor(result, props, slots, factory) {
		this.result = result;
		this.props = props;
		this.factory = factory;
		this.slotValues = slots;
		for (const name in slots) {
			if (this.slotValues === slots) {
				this.slotValues = {};
			}
			// prerender the slots eagerly to make collection entries propagate styles and scripts
			let didRender = false;
			let value = slots[name](result);
			// When a slot is async (contains `await` in its markup), the eager
			// pre-render above only runs up to the first `await`, so any propagating
			// component sequenced after it (e.g. a content collection `Content` with
			// styles) is not registered yet. On propagation routes, track the pending
			// pre-render so head buffering can await it and discover those propagators
			// before flushing the head. See `collectPropagatedHeadParts`.
			if (result._metadata.routeHasPropagation && isPromise(value)) {
				result._metadata.pendingSlotEvaluations.push(value);
			}
			this.slotValues[name] = () => {
				// use prerendered value only once
				if (!didRender) {
					didRender = true;
					return value;
				}
				// render afresh for the advanced use-case where the same slot is rendered multiple times
				return slots[name](result);
			};
		}
	}
	init(result) {
		if (this.returnValue !== undefined) {
			return this.returnValue;
		}
		this.returnValue = this.factory(result, this.props, this.slotValues);
		// Save the resolved value after promise is resolved for optimization
		if (isPromise(this.returnValue)) {
			this.returnValue.then((resolved) => {
				this.returnValue = resolved;
			}).catch(() => {
				// Ignore errors and appease unhandledrejection error
			});
		}
		return this.returnValue;
	}
	// NOTE: This render call can't be pre-invoked outside of this function as it'll also initialize the slots
	// recursively, which causes each Astro components in the tree to be called bottom-up, and is incorrect.
	// The slots are initialized eagerly for head propagation.
	render(destination) {
		const returnValue = this.init(this.result);
		if (isPromise(returnValue)) {
			return returnValue.then((x) => this.renderImpl(destination, x));
		}
		return this.renderImpl(destination, returnValue);
	}
	renderImpl(destination, returnValue) {
		if (isHeadAndContent(returnValue)) {
			return returnValue.content.render(destination);
		} else {
			return renderChild(destination, returnValue);
		}
	}
}
// Issue warnings for invalid props for Astro components
function validateComponentProps(props, clientDirectives, displayName) {
	if (props != null) {
		for (const prop in props) {
			if (prop.startsWith(CLIENT_DIRECTIVE_PREFIX) && clientDirectives.has(prop.slice(CLIENT_DIRECTIVE_PREFIX.length))) {
				console.warn(`You are attempting to render <${displayName} ${prop} />, but ${displayName} is an Astro component. Astro components do not render in the client and should not have a hydration directive. Please use a framework component for client rendering.`);
			}
		}
	}
}
export function createAstroComponentInstance(result, displayName, factory, props, slots = {}) {
	validateComponentProps(props, result.clientDirectives, displayName);
	const instance = new AstroComponentInstance(result, props, slots, factory);
	registerIfPropagating(result, factory, instance);
	return instance;
}
export function isAstroComponentInstance(obj) {
	return typeof obj === "object" && obj !== null && !!obj[astroComponentInstanceSym];
}
