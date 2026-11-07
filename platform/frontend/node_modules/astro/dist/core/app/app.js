import { BaseApp } from "./base.js";
export class App extends BaseApp {
	isDev() {
		return false;
	}
	// Should we log something for our users?
	logRequest(_options) {}
}
