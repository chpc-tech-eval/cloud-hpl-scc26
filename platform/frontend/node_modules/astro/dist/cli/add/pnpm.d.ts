/** Runs `pnpm` with the given arguments and resolves with its stdout. */
export type RunPnpm = (args: string[]) => Promise<string>;
export interface PnpmBuildApproval {
    /** Flags to pass to `pnpm add`. */
    flags: string[];
    /** Persists the approvals to the pnpm config. Must run before `pnpm add`, after the user confirms. */
    approve?: () => Promise<void>;
}
/**
 * Returns how to approve the build scripts of dependencies installed by the given integrations
 * when running `pnpm add`. `getVersion` is only called when such dependencies exist.
 *
 * pnpm v11+ enables `strictDepBuilds` by default, which makes `pnpm add` exit with
 * `ERR_PNPM_IGNORED_BUILDS` when a new dependency has an unapproved build script.
 *
 * - pnpm v11.23+: pass `--allow-build=<pkg>`, which pnpm merges into the existing `allowBuilds`.
 * - pnpm v11.0–v11.22: `--allow-build` replaces the existing `allowBuilds` map rather than merging
 *   into it, so the packages are merged into the existing map via `pnpm config set` instead.
 * - Older or unknown versions: nothing. They don't fail on unapproved builds and may not support
 *   the flag (pnpm v9 rejects it as an unknown option).
 *
 * @see https://pnpm.io/settings/build#strictdepbuilds
 * @see https://pnpm.io/settings/build#allowbuilds
 * @see https://pnpm.io/cli/add#--allow-build
 * @see https://github.com/pnpm/pnpm/issues/13872 (`--allow-build` merges since v11.23.0)
 */
export declare function getPnpmBuildApproval(integrationPackageNames: string[], getVersion: () => Promise<string | undefined>, runPnpm: RunPnpm): Promise<PnpmBuildApproval>;
/** Merges `packages` as approved into the JSON output of `pnpm config get allowBuilds --json`. */
export declare function mergeAllowBuilds(current: string, packages: string[]): Record<string, unknown>;
/** Returns the version of the `pnpm` binary run in `cwd`, or `undefined` if it can't be determined. */
export declare function getPnpmVersion(cwd: string | undefined): Promise<string | undefined>;
export declare function runPnpmIn(cwd: string | undefined): RunPnpm;
