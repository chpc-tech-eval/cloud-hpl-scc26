const headAndContentSym = Symbol.for("astro.headAndContent");
export function isHeadAndContent(obj) {
	return typeof obj === "object" && obj !== null && !!obj[headAndContentSym];
}
export function createHeadAndContent(head, content) {
	return {
		[headAndContentSym]: true,
		head,
		content
	};
}
export function createThinHead() {
	return { [headAndContentSym]: true };
}
