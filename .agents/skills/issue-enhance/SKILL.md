---
name: issue-enhance
description: Refine a TripSplit idea or incomplete GitHub Issue into an implementation specification with acceptance criteria and owner approval.
---

# Refine an issue

1. Read the issue and use [context routing](../../../AGENTS.md#context-routing) to check the affected code. For a chat-only idea, use the [idea template](../../../.github/ISSUE_TEMPLATE/idea.md) when issue creation is authorized.
2. Ask together about decisions that change implementation. Confirm the affected trip or flow, scope, dependencies, and data handling.
3. Draft the spec using the [implementation template](../../../.github/ISSUE_TEMPLATE/implementation.md). Make each acceptance criterion observable. Check sheet isolation, auth boundaries, trip dates, and public data exposure when relevant.
4. For UI changes, use [ui-design-gate](../ui-design-gate/SKILL.md) before approval.
5. Show the spec and unresolved decisions to the owner. Record explicit approval in the issue and apply the `ai-ready` label when authorized.

Use synthetic examples for expense and reservation data.
