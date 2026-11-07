// src/error.ts
var ShikiError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "ShikiError";
	}
};
export { ShikiError };
