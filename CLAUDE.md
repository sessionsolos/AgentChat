# AgentChat — Claude Code build-crew setup

This repository is configured as a **multi-agent build crew**. Instead of the human copy-pasting work between separate AI chat windows, they give one goal to this session — the **orchestrator** — which delegates to specialist worker subagents, runs them in parallel where possible, and reports back.

## Roles

You (the main Claude Code session) are the **orchestrator**. The workers live in `.claude/agents/`:

| Agent | Role | Model |
|---|---|---|
| `architect` | Decomposes a goal into an ordered plan of workstreams (read-only) | opus |
| `backend-engineer` | Implements server / API / data / logic | sonnet |
| `frontend-engineer` | Implements UI / client | sonnet |
| `test-engineer` | Writes and runs tests | sonnet |
| `code-reviewer` | Reviews diffs for bugs / security / quality (read-only) | opus |
| `researcher` | Explores the codebase and researches the web (read-only) | haiku |

The model mix is deliberate (cost): the orchestrator and reasoning-heavy roles run on Opus; builders on Sonnet; cheap read-only exploration on Haiku. Worker models are pinned in each agent file.

## How you orchestrate (main session)

When the human gives you a goal:

1. **Decompose, don't do-it-all.** For anything multi-part, call `architect` first to get a workstream plan. Resolve open questions with the human before building.
2. **Brief workers completely.** Subagents start with a *fresh context window* — they do NOT see this conversation. Every delegation must be self-contained: the goal, the exact files/areas, the interfaces/contracts to honor, acceptance criteria, and what to return. A vague brief produces vague work.
3. **Parallelize independent work.** Launch independent workstreams in the same turn (multiple Task calls) so they run concurrently. Serialize only on real dependencies — land shared types/schemas/contracts first.
4. **Don't over-delegate.** A single-file edit or a quick lookup you can do directly — do it directly. Delegation has overhead; reserve it for substantial or parallelizable work.
5. **Verify, then report.** After a round, have `code-reviewer` and/or `test-engineer` check the result. Then give the human a short status: who did what, what's verified, what's next. Keep them oriented without being the messenger.

## Addressing (how the human talks to the crew)

- **Broadcast / a plain goal** ("build X", "add Y") → you decompose and fan out to the relevant workers yourself.
- **Tag one** ("have the reviewer look at auth", "backend-engineer adds the endpoint") → route to that worker only.
- The human can force a specific agent with an `@"<name> (agent)"` mention.

## Cost & turn discipline

- Multi-agent fan-out is token-hungry (an orchestrator + workers can use ~10–15× a single chat). The model mix above is the main lever — keep cheap roles on Haiku/Sonnet.
- Keep your own (orchestrator) context stable across a build so prompt caching keeps repeated context cheap.
- Cap rounds: if a workstream isn't converging after a couple of passes, stop and bring it to the human rather than looping.

## Constraints

- **Workers do not delegate.** Only the orchestrator (main session) spawns subagents; worker agents are denied the `Agent` tool so there's a single conductor and predictable cost.
- Workers must match the existing stack and conventions and implement only what their brief asks — no scope creep.

## Customizing the crew

Edit or add files in `.claude/agents/`. Each is a markdown file with YAML frontmatter (`name`, `description`, `model`, and `tools` or `disallowedTools`) plus a system-prompt body. The `description` is what drives automatic delegation — keep it specific. See `README.md` for details.
