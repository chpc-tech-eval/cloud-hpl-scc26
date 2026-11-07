export function createServerState() {
	return {
		routes: new Map(),
		state: "fresh"
	};
}
export function setRouteError(serverState, pathname, error) {
	if (serverState.routes.has(pathname)) {
		const routeState = serverState.routes.get(pathname);
		routeState.state = "error";
		routeState.error = error;
	} else {
		const routeState = {
			state: "error",
			error
		};
		serverState.routes.set(pathname, routeState);
	}
	serverState.state = "error";
	serverState.error = error;
}
export function setServerError(serverState, error) {
	serverState.state = "error";
	serverState.error = error;
}
export function clearRouteError(serverState, pathname) {
	if (serverState.routes.has(pathname)) {
		serverState.routes.delete(pathname);
	}
	serverState.state = "fresh";
	serverState.error = undefined;
}
