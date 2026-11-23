# Work from a GitHub issue

Use [AGENTS.md](../AGENTS.md#issue-first-workflow) for the issue-first rules and owner-approval areas.

1. Capture the idea with the [idea template](../.github/ISSUE_TEMPLATE/idea.md).
2. Refine it with [issue-enhance](../.agents/skills/issue-enhance/SKILL.md) and the [implementation template](../.github/ISSUE_TEMPLATE/implementation.md).
3. For a UI change, use [ui-design-gate](../.agents/skills/ui-design-gate/SKILL.md). Record the selected option and its acceptance criterion in the issue.
4. Record the owner's approval in the issue and apply the `ai-ready` label.
5. Use [implement-from-issue](../.agents/skills/implement-from-issue/SKILL.md) on a `codex/issue-<number>-<slug>` branch. Use [verify](../.agents/skills/verify/SKILL.md) for browser evidence and record the checks in the linked PR.
6. Use [review-pr](../.agents/skills/review-pr/SKILL.md) in a session that did not write the change. The owner merges once checks and reviews pass.

To start a stage, name the skill and the issue or PR in your prompt. For example, say `Use issue-enhance on #12` or `Use review-pr on PR #15`.

Check for an existing issue branch or PR before starting. If you hand off an unfinished issue, record the branch, last check, and remaining work in the issue or PR. The `ai-ready` label records approval. GitHub branch rules and required checks, when configured, enforce merge policy.
