import { markHTMLString } from "../escape.js";
import { renderSlotToString } from "./slot.js";
import { INVALID_ATTR_NAME_CHAR, toAttributeString } from "./util.js";
export function componentIsHTMLElement(Component) {
	return typeof HTMLElement !== "undefined" && HTMLElement.isPrototypeOf(Component);
}
export async function renderHTMLElement(result, constructor, props, slots) {
	const name = getHTMLElementName(constructor);
	let attrHTML = "";
	for (const attr in props) {
		// Reject attribute names with characters that could break out of the attribute context.
		// Without this guard, untrusted prop keys spread onto the element could inject arbitrary
		// markup or event-handler attributes (XSS). Mirrors the guard in `addAttribute`.
		if (INVALID_ATTR_NAME_CHAR.test(attr)) {
			continue;
		}
		attrHTML += ` ${attr}="${toAttributeString(await props[attr])}"`;
	}
	return markHTMLString(`<${name}${attrHTML}>${await renderSlotToString(result, slots?.default)}</${name}>`);
}
function getHTMLElementName(constructor) {
	const definedName = customElements.getName(constructor);
	if (definedName) return definedName;
	const assignedName = constructor.name.replace(/^HTML|Element$/g, "").replace(/[A-Z]/g, "-$&").toLowerCase().replace(/^-/, "html-");
	return assignedName;
}
