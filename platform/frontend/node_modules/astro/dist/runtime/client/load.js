const loadDirective = async (load) => {
	const hydrate = await load();
	await hydrate();
};
export default loadDirective;
