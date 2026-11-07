import { swap } from "./swap-functions.js";
export const triggerEvent = (name) => document.dispatchEvent(new Event(name));
export const onPageLoad = () => triggerEvent("astro:page-load");
/*
* Common stuff
*/
class BeforeEvent extends Event {
	from;
	to;
	direction;
	navigationType;
	sourceElement;
	info;
	newDocument;
	signal;
	constructor(type, eventInitDict, from, to, direction, navigationType, sourceElement, info, newDocument, signal) {
		super(type, eventInitDict);
		this.from = from;
		this.to = to;
		this.direction = direction;
		this.navigationType = navigationType;
		this.sourceElement = sourceElement;
		this.info = info;
		this.newDocument = newDocument;
		this.signal = signal;
		Object.defineProperties(this, {
			from: { enumerable: true },
			to: {
				enumerable: true,
				writable: true
			},
			direction: {
				enumerable: true,
				writable: true
			},
			navigationType: { enumerable: true },
			sourceElement: { enumerable: true },
			info: { enumerable: true },
			newDocument: {
				enumerable: true,
				writable: true
			},
			signal: { enumerable: true }
		});
	}
}
/*
* TransitionBeforePreparationEvent

*/
export class TransitionBeforePreparationEvent extends BeforeEvent {
	formData;
	loader;
	constructor(from, to, direction, navigationType, sourceElement, info, newDocument, signal, formData, loader) {
		super("astro:before-preparation", { cancelable: true }, from, to, direction, navigationType, sourceElement, info, newDocument, signal);
		this.formData = formData;
		this.loader = loader.bind(this, this);
		Object.defineProperties(this, {
			formData: { enumerable: true },
			loader: {
				enumerable: true,
				writable: true
			}
		});
	}
}
/*
* TransitionBeforeSwapEvent
*/
export class TransitionBeforeSwapEvent extends BeforeEvent {
	direction;
	viewTransition;
	swap;
	constructor(afterPreparation, viewTransition) {
		super("astro:before-swap", undefined, afterPreparation.from, afterPreparation.to, afterPreparation.direction, afterPreparation.navigationType, afterPreparation.sourceElement, afterPreparation.info, afterPreparation.newDocument, afterPreparation.signal);
		this.direction = afterPreparation.direction;
		this.viewTransition = viewTransition;
		this.swap = () => swap(this.newDocument);
		Object.defineProperties(this, {
			direction: { enumerable: true },
			viewTransition: { enumerable: true },
			swap: {
				enumerable: true,
				writable: true
			}
		});
	}
}
export async function doPreparation(from, to, direction, navigationType, sourceElement, info, signal, formData, defaultLoader) {
	const event = new TransitionBeforePreparationEvent(from, to, direction, navigationType, sourceElement, info, window.document, signal, formData, defaultLoader);
	if (document.dispatchEvent(event)) {
		await event.loader();
		if (!event.defaultPrevented) {
			triggerEvent("astro:after-preparation");
			if (event.navigationType !== "traverse") {
				// save the current scroll position before we change the DOM and transition to the new page
				updateScrollPosition({
					scrollX,
					scrollY
				});
			}
		}
	}
	return event;
}
// only update history entries that are managed by us
// leave other entries alone and do not accidentally add state.
export const updateScrollPosition = (positions) => {
	if (history.state) {
		history.scrollRestoration = "manual";
		history.replaceState({
			...history.state,
			...positions
		}, "");
	}
};
export async function doSwap(afterPreparation, viewTransition, afterDispatch) {
	const event = new TransitionBeforeSwapEvent(afterPreparation, viewTransition);
	document.dispatchEvent(event);
	if (afterDispatch) {
		await afterDispatch();
	}
	event.swap();
	return event;
}
