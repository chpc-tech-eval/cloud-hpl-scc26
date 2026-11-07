/**
* Hydrate this component when one of its children becomes visible
* We target the children because `astro-island` is set to `display: contents`
* which doesn't work with IntersectionObserver
*/
const visibleDirective = (load, options, el) => {
	const cb = async () => {
		const hydrate = await load();
		await hydrate();
	};
	const rawOptions = typeof options.value === "object" ? options.value : undefined;
	const ioOptions = { rootMargin: rawOptions?.rootMargin };
	const io = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			// As soon as we hydrate, disconnect this IntersectionObserver for every `astro-island`
			io.disconnect();
			cb();
			break;
		}
	}, ioOptions);
	for (const child of el.children) {
		io.observe(child);
	}
};
export default visibleDirective;
