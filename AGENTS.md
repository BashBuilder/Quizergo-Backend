# Agent rules

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:

- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

## Database & Migration Safety (STRICT)

You are strictly prohibited from deleting, dropping, or truncating any data—either directly or via database migrations—without explicit, written confirmation from the user in the current conversation.

### 1. Prohibited Destructive Operations

Never execute or generate migrations containing the following without prior explicit approval:

- `DROP TABLE`, `DROP COLUMN`, `DROP SCHEMA`, or `DROP DATABASE`
- `TRUNCATE`
- `DELETE` statements (unless explicitly requested for specific test/seed cleanup)
- Column type changes or constraints (`ALTER COLUMN ... TYPE`, `SET NOT NULL`) that could cause data truncation or fail on existing rows
- Reset commands prisma migrate reset

### 2. Mandatory Migration Workflow

Whenever a task requires schema changes:

1. **Generate only:** Generate the migration file(s) first, but **do not run/apply** them automatically.
2. **Inspect & warn:** Read the generated SQL file completely. If it contains any destructive operations or potential data loss risks, explicitly highlight the exact SQL lines and explain what data will be affected.
3. **Ask for permission:** Pause and ask the user for explicit approval before executing the migration against any database (local, staging, or production).
4. **Safer alternatives:** Prefer additive, non-destructive patterns (e.g., expand-and-contract: add a new column, backfill data, and deprecate the old column rather than dropping/renaming in place).
