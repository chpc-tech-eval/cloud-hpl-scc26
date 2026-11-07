const idleDirective = (load, options) => {
	const cb = async () => {
		const hydrate = await load();
		await hydrate();
	};
	const rawOptions = typeof options.value === "object" ? options.value : undefined;
	const idleOptions = { timeout: rawOptions?.timeout };
	if ("requestIdleCallback" in window) {
		window.requestIdleCallback(cb, idleOptions);
	} else {
		setTimeout(cb, idleOptions.timeout || 200);
	}
};
export default idleDirective;
