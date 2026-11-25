# ST-AI-14 checkpoint

Branch: `feat/ST-AI-14-rag-embedding-pipeline-du-lieu-khach-san`; base `develop` at `ae5d6cae13a3c93248a325eea318ed84c471e766`.

Implemented: approved-snapshot extractor, pgvector migration, model/dimension guarded retrieval, BullMQ worker/reconciliation/backfill, moderation hooks, test-only fake provider tests. Current working tree also contains pre-existing user changes to `DACN2/README.md` and unrelated untracked directories; do not stage them. No push/merge.

Local test PostgreSQL Docker is mapped to port 55432 in the running container to avoid a Windows PostgreSQL process also bound to 5432. This was a process environment override only; no Compose port was changed. Two isolated test databases were created. Clean migration, schema-copy upgrade, 10 AI tests, full API suite (67 suites/297 tests), build, typecheck, full lint, backfill dry-run, Compose validation and `git diff --check` passed. See `docs/ST-AI-14.md` for evidence, operations and remaining gates. Real embedding provider and downstream AI consumer remain unverified/unavailable.
