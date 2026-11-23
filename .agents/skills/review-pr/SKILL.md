---
name: review-pr
description: Independently review a TripSplit pull request against its issue, acceptance criteria, repository rules, and verification evidence.
---

# Review a pull request

1. Use a session that did not write the change. Read the linked issue and its decisions, then inspect the full PR diff.
2. Trace behavior affected by the diff. For expense changes check the selected sheet, mutations, and cached state. For travel books check the public route bypass, date behavior, and itinerary data exposure.
3. Compare the evidence with [the applicable checks](../../../AGENTS.md#verification-guidance), and flag any [owner-approval areas](../../../AGENTS.md#issue-first-workflow). Identify deployed behavior that remains unverified.
4. Report actionable findings in severity order with file and line references. If posting is authorized, submit a comment-only review. Leave approval and merging to the owner.
