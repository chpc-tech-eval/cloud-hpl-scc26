export class ProcessCloudIdeProvider {
	name = Boolean(process.env.GITPOD_REPO_ROOT) ? "gitpod" : null;
}
