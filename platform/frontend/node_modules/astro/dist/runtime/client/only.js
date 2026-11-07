/**
* Hydrate this component only on the client
*/
const onlyDirective = async (load) => {
	const hydrate = await load();
	await hydrate();
};
export default onlyDirective;
