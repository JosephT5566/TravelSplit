---
name: implement-from-issue
description: Implement an approved TripSplit GitHub Issue on its own branch, verify the acceptance criteria, and prepare a linked pull request.
---

# Implement from an issue

1. Read the issue and check its `ai-ready` label, approval checklist, and decision log. Return incomplete or materially changed specs to [issue-enhance](../issue-enhance/SKILL.md).
2. Check for an existing branch, PR, or overlapping issue. Use `codex/issue-<number>-<slug>` and a separate worktree when other work shares the checkout.
3. Read the relevant sources in [AGENTS.md](../../../AGENTS.md#context-routing) and implement the agreed criteria. Follow the selected design for UI changes.
4. Run [the applicable checks](../../../AGENTS.md#verification-guidance). For UI changes use [verify](../verify/SKILL.md). Consult [tripsplit-guide](../tripsplit-guide/SKILL.md) for any affected documentation.
5. Use the [PR template](../../../.github/pull_request_template.md) to record criteria, actual results, UI evidence, and gaps. Open the PR and link it on the issue when authorized. Leave the merge to the owner.
