export class NoopPackageManager {
	name = "unknown";
	async getPackageVersion() {
		return undefined;
	}
}
