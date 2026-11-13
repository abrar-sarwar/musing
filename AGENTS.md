# Repository guidance

## Documentation source of truth

- Read `musing.md` and the root `README.md` before planning, implementing or documenting project work.
- Treat `musing.md` as the canonical source for product direction, terminology, priorities, experience design and trust rules.
- Treat the code, migrations and tests as the source for whether behavior is implemented and verified. The product brief describes direction and proposed work; it is not proof that a feature shipped.
- Use the brief's status language when relevant: `verified current behavior`, `core proposed`, `stretch` and `mock only`.
- Never describe Facebook Events, Groups, Marketplace, Reels, Feed or Messenger as live integrations unless approved API access and working behavior have been verified. The current catalog and handoffs are seeded or mock.
- Preserve the product boundaries in new documentation: friend-first matching, private declines and limits, consent-gated signals, grounded Muse IDs, and explicit user action before invitations, publishing, joining, seller contact or other external effects.
- Update the root README and any relevant component README when verified setup, architecture, security, operations or demo behavior changes. Link durable design documents from the root README.
- Clearly label deferred designs and open decisions; do not document proposed configuration or routes as active behavior.

## Repository care

- Preserve unrelated worktree changes.
- Keep documentation-only work on the active branch.
- Do not commit, push or merge unless the user explicitly requests it.
