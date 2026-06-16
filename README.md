# AgentChat — a Claude Code build crew

A zero-extra-infrastructure setup that lets a single Claude Code session act as an **orchestrator** which delegates large builds to specialist **worker subagents** — so you stop being the copy-paste messenger between separate AI chat windows.

Everything runs inside Claude Code on one provider (Anthropic): no servers, no API keys to wire up, no cross-platform glue. On a Claude/Claude Code subscription, subagent usage draws from the plan you already pay for.

## How it works

- **You talk to one session** (the orchestrator).
- It **delegates** to the workers defined in `.claude/agents/`, runs independent work **in parallel**, and **reports back**.
- Worker models are mixed for cost: Opus for planning/review, Sonnet for building, Haiku for read-only research.

```
You ──▶ Orchestrator (main session, Opus)
            ├─▶ architect         (plan)        Opus
            ├─▶ backend-engineer  (build)       Sonnet
            ├─▶ frontend-engineer (build)       Sonnet
            ├─▶ test-engineer     (verify)      Sonnet
            ├─▶ code-reviewer     (review)      Opus
            └─▶ researcher        (investigate) Haiku
```

## Using it

Open this repo in Claude Code and state a goal, e.g.:

> Build a REST API for a todo app with a React frontend and tests.

The orchestrator plans it with `architect`, fans the workstreams out to the engineers in parallel, runs `test-engineer` and `code-reviewer`, then summarizes.

**Address the crew naturally:**
- Plain goal → the orchestrator decomposes and delegates for you.
- Tag one → "have the **reviewer** check the auth module."
- Force one → `@"code-reviewer (agent)"`.

## The crew

| Agent | Does | Model | Access |
|---|---|---|---|
| architect | Turns a goal into a plan of workstreams | opus | read-only |
| backend-engineer | Server / API / data / logic | sonnet | full |
| frontend-engineer | UI / client | sonnet | full |
| test-engineer | Writes & runs tests | sonnet | full |
| code-reviewer | Reviews diffs for bugs/security/quality | opus | read + run checks |
| researcher | Explores code + researches the web | haiku | read-only |

## Customizing

- **Edit a role:** open `.claude/agents/<name>.md`. Change the system prompt (body), the `model`, or the allowed `tools`.
- **Add a role:** create `.claude/agents/<name>.md` with frontmatter (`name`, `description`, `model`, and `tools` or `disallowedTools`) plus a system-prompt body. The `description` drives when the orchestrator auto-delegates — make it specific (include "use proactively" for ones that should fire automatically).
- **Change the model mix:** adjust the `model:` line per agent (`opus` / `sonnet` / `haiku` / `fable` / `inherit`).
- **Orchestration policy** lives in `CLAUDE.md`.

## Why all-Claude (vs ChatGPT + Claude + Perplexity)

Cross-platform is possible, but the integration unit is each provider's **API** — not the consumer chat apps — and you'd build and maintain a message-bus hub with turn-taking, format translation, and three billing accounts. For coding/build work the model-diversity payoff is small (Claude is top-tier at code, and Claude Code already has web search built in), so staying in-Claude is **easier**, usually **cheaper** (one subscription, mixed models, prompt caching), and far **more efficient** to coordinate.

If you later want a literal chat-room UI where you watch agents post and inject messages mid-build, that's a thin app on the [Claude Agent SDK](https://code.claude.com/docs/en/claude-code-on-the-web) — a fraction of the cross-platform hub's complexity. This crew setup is the zero-build starting point; reach for the app only if you find you miss the live watch-and-inject experience.
