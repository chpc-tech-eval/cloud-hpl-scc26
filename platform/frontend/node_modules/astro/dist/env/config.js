/**
* Return a valid env field to use in this Astro config for `env.schema`.
*/
export const envField = {
	string: (options) => ({
		...options,
		type: "string"
	}),
	number: (options) => ({
		...options,
		type: "number"
	}),
	boolean: (options) => ({
		...options,
		type: "boolean"
	}),
	enum: (options) => ({
		...options,
		type: "enum"
	})
};
