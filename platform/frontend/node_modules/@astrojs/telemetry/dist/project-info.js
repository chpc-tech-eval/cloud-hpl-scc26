import { exec } from "node:child_process";
import { createHash } from "node:crypto";
import { detect } from "package-manager-detector";
function createAnonymousValue(payload) {
	// We use empty string to represent an empty value. Avoid hashing this
	// since that would create a real hash and remove its "empty" meaning.
	if (payload === "") {
		return payload;
	}
	// Otherwise, create a new hash from the payload and return it.
	const hash = createHash("sha256");
	hash.update(payload);
	return hash.digest("hex");
}
function getProjectIdFromGit() {
	return new Promise((resolve) => {
		try {
			const child = exec(`git rev-list --max-parents=0 HEAD`, { timeout: 500 }, (error, stdout) => resolve(error ? null : String(stdout).trim() || null));
			child.stdin?.end();
		} catch {
			resolve(null);
		}
	});
}
async function getProjectId(isCI) {
	const projectIdFromGit = await getProjectIdFromGit();
	if (projectIdFromGit) {
		return {
			isGit: true,
			anonymousProjectId: createAnonymousValue(projectIdFromGit)
		};
	}
	// If we're running in CI, the current working directory is not unique.
	// If the cwd is a single level deep (ex: '/app'), it's probably not unique.
	const cwd = process.cwd();
	const isCwdGeneric = (cwd.match(/[/|\\]/g) || []).length === 1;
	if (isCI || isCwdGeneric) {
		return {
			isGit: false,
			anonymousProjectId: undefined
		};
	}
	return {
		isGit: false,
		anonymousProjectId: createAnonymousValue(cwd)
	};
}
export async function getProjectInfo(isCI) {
	const [projectId, packageManager] = await Promise.all([getProjectId(isCI), detect()]);
	return {
		...projectId,
		packageManager: packageManager?.name,
		packageManagerVersion: packageManager?.version
	};
}
