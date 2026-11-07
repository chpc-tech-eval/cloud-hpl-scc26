import { existsSync, promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseYaml } from "@astrojs/internal-helpers/yaml";
import * as toml from "smol-toml";
import { DuplicateContentEntrySlugError, FileGlobNotSupported, FileParserNotFound } from "../../core/errors/errors-data.js";
import { AstroError } from "../../core/errors/index.js";
import { posixRelative } from "../utils.js";
/**
* Loads entries from a JSON file. The file must contain an array of objects that contain unique `id` fields, or an object with string keys.
* @param fileName The path to the JSON file to load, relative to the content directory.
* @param options Additional options for the file loader
*/
export function file(fileName, options) {
	if (fileName.includes("*")) {
		throw new AstroError(FileGlobNotSupported);
	}
	let parse = null;
	const ext = fileName.split(".").at(-1);
	if (ext === "json") {
		parse = JSON.parse;
	} else if (ext === "yml" || ext === "yaml") {
		parse = parseYaml;
	} else if (ext === "toml") {
		parse = toml.parse;
	}
	if (options?.parser) parse = options.parser;
	if (parse === null) {
		throw new AstroError({
			...FileParserNotFound,
			message: FileParserNotFound.message(fileName)
		});
	}
	async function syncData(filePath, { logger, parseData, store, config, collection }) {
		let data;
		try {
			const contents = await fs.readFile(filePath, "utf-8");
			data = await parse(contents);
		} catch (error) {
			logger.error(`Error reading data from ${fileName}`);
			logger.debug(error.message);
			return;
		}
		const normalizedFilePath = posixRelative(fileURLToPath(config.root), filePath);
		if (Array.isArray(data)) {
			if (data.length === 0) {
				logger.warn(`No items found in ${fileName}`);
			}
			logger.debug(`Found ${data.length} item array in ${fileName}`);
			store.clear();
			const idList = new Set();
			for (const rawItem of data) {
				const id = (rawItem.id ?? rawItem.slug)?.toString();
				if (!id) {
					logger.error(`Item in ${fileName} is missing an id or slug field.`);
					continue;
				}
				if (idList.has(id)) {
					const message = DuplicateContentEntrySlugError.message(collection, id, fileName, fileName);
					if (config.prerenderConflictBehavior === "error") {
						throw new AstroError({
							...DuplicateContentEntrySlugError,
							message
						});
					} else if (config.prerenderConflictBehavior !== "ignore") {
						logger.warn(message);
					}
				}
				idList.add(id);
				const parsedData = await parseData({
					id,
					data: rawItem,
					filePath
				});
				store.set({
					id,
					data: parsedData,
					filePath: normalizedFilePath
				});
			}
		} else if (typeof data === "object") {
			const entries = Object.entries(data);
			logger.debug(`Found object with ${entries.length} entries in ${fileName}`);
			store.clear();
			for (const [id, rawItem] of entries) {
				if (id === "$schema" && typeof rawItem === "string") {
					// Ignore JSON schema field.
					continue;
				}
				const parsedData = await parseData({
					id,
					data: rawItem,
					filePath
				});
				store.set({
					id,
					data: parsedData,
					filePath: normalizedFilePath
				});
			}
		} else {
			logger.error(`Invalid data in ${fileName}. Must be an array or object.`);
		}
	}
	return {
		name: "file-loader",
		load: async (context) => {
			const { config, logger, watcher } = context;
			logger.debug(`Loading data from ${fileName}`);
			const url = new URL(fileName, config.root);
			if (!existsSync(url)) {
				logger.error(`File not found: ${fileName}`);
				return;
			}
			const filePath = fileURLToPath(url);
			await syncData(filePath, context);
			watcher?.add(filePath);
			watcher?.on("change", async (changedPath) => {
				if (changedPath === filePath) {
					logger.info(`Reloading data from ${fileName}`);
					await syncData(filePath, context);
				}
			});
		}
	};
}
