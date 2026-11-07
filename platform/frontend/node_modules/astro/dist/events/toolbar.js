const EVENT_TOOLBAR_APP_TOGGLED = "ASTRO_TOOLBAR_APP_TOGGLED";
export function eventAppToggled(options) {
	const payload = { app: options.appName };
	return [{
		eventName: EVENT_TOOLBAR_APP_TOGGLED,
		payload
	}];
}
