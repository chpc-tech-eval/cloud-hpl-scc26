import { isValidPlacement } from "./ui-library/window.js";
export const defaultSettings = {
	disableAppNotification: false,
	verbose: false,
	placement: "bottom-center"
};
export const settings = getSettings();
function getSettings() {
	// 1. Start with hardcoded defaults
	let _settings = { ...defaultSettings };
	// 2. Override with config placement (if provided)
	const configPlacement = globalThis.__astro_dev_toolbar__?.placement;
	if (configPlacement && isValidPlacement(configPlacement)) {
		_settings.placement = configPlacement;
	}
	// 3. Override with localStorage (preserves user's UI choice)
	const toolbarSettings = localStorage.getItem("astro:dev-toolbar:settings");
	if (toolbarSettings) {
		_settings = {
			..._settings,
			...JSON.parse(toolbarSettings)
		};
	}
	function updateSetting(key, value) {
		_settings[key] = value;
		localStorage.setItem("astro:dev-toolbar:settings", JSON.stringify(_settings));
	}
	function log(message, level = "log") {
		// biome-ignore lint/suspicious/noConsole: it can't infer types yet
		console[level](`%cAstro`, "background: linear-gradient(66.77deg, #D83333 0%, #F041FF 100%); color: white; padding-inline: 4px; border-radius: 2px; font-family: monospace;", message);
	}
	return {
		get config() {
			return _settings;
		},
		updateSetting,
		logger: {
			log,
			warn: (message) => {
				log(message, "warn");
			},
			error: (message) => {
				log(message, "error");
			},
			verboseLog: (message) => {
				if (_settings.verbose) {
					log(message);
				}
			}
		}
	};
}
