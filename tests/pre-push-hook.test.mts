import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOOK_PATH = path.join(REPO_ROOT, ".githooks", "pre-push");
const ZERO_SHA = "0000000000000000000000000000000000000000";
const SAMPLE_SHA = "1111111111111111111111111111111111111111";
const REMOTE_SHA = "2222222222222222222222222222222222222222";
const DEFAULT_URL = "https://github.com/JosephT5566/TravelSplit.git";

function resolveOnPath(tool: string): string | null {
    const entries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
    for (const dir of entries) {
        const candidate = path.join(dir, tool);
        if (existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

/** PATH containing only the non-gh utilities the hook needs, for the missing-gh case. */
function withToolsPathWithoutGh<T>(fn: (toolsPath: string) => T): T {
    const dir = mkdtempSync(path.join(os.tmpdir(), "tripsplit-pre-push-tools-"));
    try {
        for (const tool of ["tr", "git"]) {
            const resolved = resolveOnPath(tool);
            if (resolved) {
                symlinkSync(resolved, path.join(dir, tool));
            }
        }
        return fn(dir);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

function withStubDir<T>(stubScript: string | null, fn: (ctx: { binDir: string; logFile: string }) => T): T {
    const dir = mkdtempSync(path.join(os.tmpdir(), "tripsplit-pre-push-"));
    const logFile = path.join(dir, "gh-calls.log");
    try {
        if (stubScript !== null) {
            const ghPath = path.join(dir, "gh");
            writeFileSync(ghPath, stubScript, "utf8");
            chmodSync(ghPath, 0o755);
        }
        return fn({ binDir: dir, logFile });
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

function stubPath(binDir: string): string {
    return `${binDir}${path.delimiter}${process.env.PATH ?? ""}`;
}

function runHook(options: {
    stdin: string;
    remoteName?: string;
    remoteUrl?: string;
    envPath: string;
    cwd?: string;
    extraEnv?: Record<string, string>;
}) {
    const args: string[] = [];
    if (options.remoteName !== undefined) {
        args.push(options.remoteName);
        if (options.remoteUrl !== undefined) {
            args.push(options.remoteUrl);
        }
    }

    return spawnSync(HOOK_PATH, args, {
        input: options.stdin,
        encoding: "utf8",
        cwd: options.cwd ?? REPO_ROOT,
        env: {
            ...process.env,
            PATH: options.envPath,
            ...options.extraEnv,
        },
    });
}

test("pre-push allows codex/issue-<n>-<slug> when issue has ai-ready label", () => {
    withStubDir(
        `#!/bin/sh
printf '%s\\n' "$*" >> "$GH_LOG_FILE"
printf '%s\\n' '{"labels":[{"name":"enhancement"},{"name":"ai-ready"}],"state":"OPEN"}'
`,
        ({ binDir, logFile }) => {
            const res = runHook({
                stdin: `refs/heads/codex/issue-999-sample-feature ${SAMPLE_SHA} refs/heads/codex/issue-999-sample-feature ${ZERO_SHA}\n`,
                remoteName: "origin",
                remoteUrl: DEFAULT_URL,
                envPath: stubPath(binDir),
                extraEnv: { GH_LOG_FILE: logFile },
            });
            assert.equal(res.status, 0, res.stderr);
            const calls = readFileSync(logFile, "utf8").trim().split("\n");
            assert.deepEqual(calls, [
                "issue view 999 --repo JosephT5566/TravelSplit --json labels,state",
            ]);
        },
    );
});

test("pre-push allows codex/issue-<n> without slug and closed issue if ai-ready is present", () => {
    withStubDir(
        `#!/bin/sh
printf '%s\\n' "$*" >> "$GH_LOG_FILE"
printf '%s\\n' '{ "labels": [ { "id": "LA_1", "name": "ai-ready", "color": "0e8a16" } ], "state": "CLOSED" }'
`,
        ({ binDir, logFile }) => {
            const res = runHook({
                stdin: `refs/heads/codex/issue-123 ${SAMPLE_SHA} refs/heads/codex/issue-123 ${REMOTE_SHA}\n`,
                remoteName: "origin",
                remoteUrl: "git@github.com:ExampleOrg/ExampleRepo.git",
                envPath: stubPath(binDir),
                extraEnv: { GH_LOG_FILE: logFile },
            });
            assert.equal(res.status, 0, res.stderr);
            assert.equal(
                readFileSync(logFile, "utf8").trim(),
                "issue view 123 --repo ExampleOrg/ExampleRepo --json labels,state",
            );
        },
    );

    withStubDir(
        `#!/bin/sh
printf '%s\\n' '{ "labels": [ { "name": "ai-ready", "color": "0e8a16" } ], "state": "OPEN" }'
`,
        ({ binDir }) => {
            const res = runHook({
                stdin: `refs/heads/codex/issue-124-first-key ${SAMPLE_SHA} refs/heads/codex/issue-124-first-key ${ZERO_SHA}\n`,
                remoteName: "origin",
                remoteUrl: DEFAULT_URL,
                envPath: stubPath(binDir),
            });
            assert.equal(res.status, 0, res.stderr);
        },
    );
});

test("pre-push parses ssh:// URL and falls back to default repo when URL is unparsable", () => {
    withStubDir(
        `#!/bin/sh
printf '%s\\n' "$*" >> "$GH_LOG_FILE"
printf '%s\\n' '{"labels":[{"name":"ai-ready"}],"state":"OPEN"}'
`,
        ({ binDir, logFile }) => {
            const sshRes = runHook({
                stdin: `refs/heads/codex/issue-42-ssh ${SAMPLE_SHA} refs/heads/codex/issue-42-ssh ${ZERO_SHA}\n`,
                remoteName: "origin",
                remoteUrl: "ssh://git@github.com/AnotherOwner/AnotherRepo.git",
                envPath: stubPath(binDir),
                extraEnv: { GH_LOG_FILE: logFile },
            });
            assert.equal(sshRes.status, 0, sshRes.stderr);

            const fallbackRes = runHook({
                stdin: `refs/heads/codex/issue-43-fallback ${SAMPLE_SHA} refs/heads/codex/issue-43-fallback ${ZERO_SHA}\n`,
                remoteName: "origin",
                remoteUrl: "/tmp/local-bare-repo.git",
                envPath: stubPath(binDir),
                extraEnv: { GH_LOG_FILE: logFile },
                cwd: binDir,
            });
            assert.equal(fallbackRes.status, 0, fallbackRes.stderr);

            const calls = readFileSync(logFile, "utf8").trim().split("\n");
            assert.deepEqual(calls, [
                "issue view 42 --repo AnotherOwner/AnotherRepo --json labels,state",
                "issue view 43 --repo JosephT5566/TravelSplit --json labels,state",
            ]);
        },
    );
});

test("pre-push blocks codex/issue-<n>-* when ai-ready label is missing or only a substring", () => {
    withStubDir(
        `#!/bin/sh
printf '%s\\n' '{"labels":[{"name":"ai-ready-draft"},{"name":"bug"}],"state":"OPEN"}'
`,
        ({ binDir }) => {
            const res = runHook({
                stdin: `refs/heads/codex/issue-404-missing-label ${SAMPLE_SHA} refs/heads/codex/issue-404-missing-label ${ZERO_SHA}\n`,
                remoteName: "origin",
                remoteUrl: DEFAULT_URL,
                envPath: stubPath(binDir),
            });
            assert.equal(res.status, 1);
            assert.match(res.stderr, /ai-ready/);
            assert.match(res.stderr, /#404/);
        },
    );

    withStubDir(
        `#!/bin/sh
printf '%s\\n' '{"labels":[],"state":"OPEN"}'
`,
        ({ binDir }) => {
            const res = runHook({
                stdin: `refs/heads/codex/issue-405-empty-labels ${SAMPLE_SHA} refs/heads/codex/issue-405-empty-labels ${ZERO_SHA}\n`,
                remoteName: "origin",
                remoteUrl: DEFAULT_URL,
                envPath: stubPath(binDir),
            });
            assert.equal(res.status, 1);
            assert.match(res.stderr, /ai-ready/);
            assert.match(res.stderr, /#405/);
        },
    );
});

test("pre-push allows non-codex branches, non-digit codex/issue-foo, and empty stdin without calling gh", () => {
    withStubDir(
        `#!/bin/sh
echo "gh should not have been called" >&2
exit 99
`,
        ({ binDir }) => {
            const envPath = stubPath(binDir);

            const nonCodex = runHook({
                stdin: [
                    `refs/heads/main ${SAMPLE_SHA} refs/heads/main ${REMOTE_SHA}`,
                    `refs/heads/chore/pre-push-ai-ready-hook ${SAMPLE_SHA} refs/heads/chore/pre-push-ai-ready-hook ${ZERO_SHA}`,
                    `refs/tags/v1.0.0 ${SAMPLE_SHA} refs/tags/v1.0.0 ${ZERO_SHA}`,
                    `refs/heads/codex/issue-foo ${SAMPLE_SHA} refs/heads/codex/issue-foo ${ZERO_SHA}`,
                ].join("\n") + "\n",
                remoteName: "origin",
                remoteUrl: DEFAULT_URL,
                envPath,
            });
            assert.equal(nonCodex.status, 0, nonCodex.stderr);

            const emptyStdin = runHook({
                stdin: "",
                remoteName: "origin",
                remoteUrl: DEFAULT_URL,
                envPath,
            });
            assert.equal(emptyStdin.status, 0, emptyStdin.stderr);
        },
    );
});

test("pre-push warns but allows issue-<n>-* missing codex/ prefix without calling gh", () => {
    withStubDir(
        `#!/bin/sh
echo "gh should not have been called" >&2
exit 99
`,
        ({ binDir }) => {
            const res = runHook({
                stdin: `refs/heads/issue-777-missing-prefix ${SAMPLE_SHA} refs/heads/issue-777-missing-prefix ${ZERO_SHA}\n`,
                remoteName: "origin",
                remoteUrl: DEFAULT_URL,
                envPath: stubPath(binDir),
            });
            assert.equal(res.status, 0, res.stderr);
            assert.match(res.stderr, /codex\/issue-777-<slug>/);
            assert.match(res.stderr, /ai-ready/);
        },
    );
});

test("pre-push allows remote branch deletion of codex/issue-<n>-* without calling gh", () => {
    withStubDir(
        `#!/bin/sh
echo "gh should not have been called" >&2
exit 99
`,
        ({ binDir }) => {
            const res = runHook({
                stdin: `(delete) ${ZERO_SHA} refs/heads/codex/issue-888-old ${REMOTE_SHA}\nrefs/heads/codex/issue-889-old ${ZERO_SHA} refs/heads/codex/issue-889-old ${REMOTE_SHA}\n`,
                remoteName: "origin",
                remoteUrl: DEFAULT_URL,
                envPath: stubPath(binDir),
            });
            assert.equal(res.status, 0, res.stderr);
        },
    );
});

test("pre-push fails closed when gh exits non-zero, returns empty output, or is absent from PATH", () => {
    withStubDir(
        `#!/bin/sh
echo "authentication required" >&2
exit 1
`,
        ({ binDir }) => {
            const res = runHook({
                stdin: `refs/heads/codex/issue-500-gh-error ${SAMPLE_SHA} refs/heads/codex/issue-500-gh-error ${ZERO_SHA}\n`,
                remoteName: "origin",
                remoteUrl: DEFAULT_URL,
                envPath: stubPath(binDir),
            });
            assert.equal(res.status, 1);
            assert.match(res.stderr, /git push --no-verify/);
        },
    );

    withStubDir(
        `#!/bin/sh
exit 0
`,
        ({ binDir }) => {
            const res = runHook({
                stdin: `refs/heads/codex/issue-501-gh-empty ${SAMPLE_SHA} refs/heads/codex/issue-501-gh-empty ${ZERO_SHA}\n`,
                remoteName: "origin",
                remoteUrl: DEFAULT_URL,
                envPath: stubPath(binDir),
            });
            assert.equal(res.status, 1);
            assert.match(res.stderr, /git push --no-verify/);
        },
    );

    withToolsPathWithoutGh((toolsPath) => {
        const missingGh = runHook({
            stdin: `refs/heads/codex/issue-502-no-gh ${SAMPLE_SHA} refs/heads/codex/issue-502-no-gh ${ZERO_SHA}\n`,
            remoteName: "origin",
            remoteUrl: DEFAULT_URL,
            envPath: toolsPath,
        });
        assert.equal(missingGh.status, 1);
        assert.match(missingGh.stderr, /git push --no-verify/);
        assert.match(missingGh.stderr, /gh/);
    });
});

test("pre-push fails if any ref among multiple stdin lines is missing ai-ready", () => {
    withStubDir(
        `#!/bin/sh
if [ "$3" = "601" ]; then
  printf '%s\\n' '{"labels":[{"name":"ai-ready"}],"state":"OPEN"}'
else
  printf '%s\\n' '{"labels":[{"name":"needs-review"}],"state":"OPEN"}'
fi
`,
        ({ binDir }) => {
            const res = runHook({
                stdin: [
                    `refs/heads/codex/issue-601-ok ${SAMPLE_SHA} refs/heads/codex/issue-601-ok ${ZERO_SHA}`,
                    `refs/heads/codex/issue-602-blocked ${SAMPLE_SHA} refs/heads/codex/issue-602-blocked ${ZERO_SHA}`,
                ].join("\n") + "\n",
                remoteName: "origin",
                remoteUrl: DEFAULT_URL,
                envPath: stubPath(binDir),
            });
            assert.equal(res.status, 1);
            assert.match(res.stderr, /#602/);
            assert.match(res.stderr, /ai-ready/);
        },
    );
});

test("pre-push does not let gh consume remaining stdin refs", () => {
    withStubDir(
        `#!/bin/sh
# If stdin were inherited from the hook's while-read loop, this would drain later refs.
cat >/dev/null
printf '%s\\n' "$*" >> "$GH_LOG_FILE"
printf '%s\\n' '{"labels":[{"name":"ai-ready"}],"state":"OPEN"}'
`,
        ({ binDir, logFile }) => {
            const res = runHook({
                stdin: [
                    `refs/heads/codex/issue-701-first ${SAMPLE_SHA} refs/heads/codex/issue-701-first ${ZERO_SHA}`,
                    `refs/heads/codex/issue-702-second ${SAMPLE_SHA} refs/heads/codex/issue-702-second ${ZERO_SHA}`,
                ].join("\n") + "\n",
                remoteName: "origin",
                remoteUrl: DEFAULT_URL,
                envPath: stubPath(binDir),
                extraEnv: { GH_LOG_FILE: logFile },
            });
            assert.equal(res.status, 0, res.stderr);
            const calls = readFileSync(logFile, "utf8").trim().split("\n");
            assert.deepEqual(calls, [
                "issue view 701 --repo JosephT5566/TravelSplit --json labels,state",
                "issue view 702 --repo JosephT5566/TravelSplit --json labels,state",
            ]);
        },
    );
});
