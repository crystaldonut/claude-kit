# savvy-progress

A Claude Code mod: a progress bar above the prompt and a live panel of subagents. Made for the [savvy-flow](../savvy-flow) skill, and useful with any subagents.

- **Progress bar**: the flow's title, phase, accepted tasks out of planned, and a button with the crew size that opens the panel. It appears once something reports progress (savvy-flow does) or a `savvy-*` worker starts.
- **Agents panel** (`/agents-info` toggles it; `/agents-info open` opens it or brings it forward without toggling): running, finished and planned subagents with model, effort, task progress, context, estimated cost and time. Working crabs walk, and each savvy tier animates its prop: the astronaut floats, the detective sweeps the magnifier, the engineer turns the wrench, the chef tosses the omelette, the racer runs with a fluttering flag. `prefers-reduced-motion` stops them.

## Tools it adds

- `mcp__savvy-progress__progress`: the orchestrator reports the plan, phase and accepted tasks. Only the main session can: a call from a subagent is ignored, so a worker cannot rename, finish or reset the flow.
- `mcp__savvy-progress__step`: a worker reports its own steps (`done`, `total`, `note`). A worker that does not report shows its context fill in grey instead. The tool is listed up front rather than behind ToolSearch, and each `savvy-*` worker gets one line at the end of its brief asking for these reports.

Cost is a rough estimate from token counts and a built-in per-model price table (`PRICES` in `hooks/register.tsx`, list prices as of 2026-10-10), not a bill. Cache writes are priced at the 1-hour rate, which is what Claude Code writes on a subscription; a session that writes 5-minute entries is overestimated there.

## Settings

`language`: `auto` (default), `en`, `ru` or `he`. Hebrew draws the bar and the panel right to left. `auto` follows Claude Code's `language` setting, then the system locale, and falls back to English. Set it in `/config`, or, for a mod loaded by hand, in `~/.claude/settings.json`:

```json
{ "pluginConfigs": { "savvy-progress": { "options": { "language": "ru" } } } }
```

`autoOpen`: `savvy` (default) or `any`. With `savvy` the panel opens by itself when a `savvy-*` worker starts or a plan is reported. With `any` it also opens, once per session, when any other subagent starts. `/agents-info` toggles it either way.

`avatars`: the path of an avatars file, `~/.claude/savvy-progress/avatars.json` by default. Without one, every agent row in the terminal gets a pixel crab colored by its type: savvy tiers keep their colors, the built-in types (`general-purpose`, `web-fetch`, `Explore`, `Plan`, ...) have their own, and any other type gets a color picked by its name.

## Avatars

The avatars file gives agents their own art, color and label. The first rule that fits an agent wins:

```json
{
  "avatars": [
    { "match": "paranoid", "label": "Paranoid", "color": "#D95F5F", "art": [" .---. ", "( ◉_◉ )", " /| |\\ "] },
    { "match": "^ceo", "label": "CEO", "color": "#C9A227", "art": [" _===_", " (•‿•)", " /|$|\\"] },
    { "type": "web-fetch", "art": ["  ~~~", " (o.o)~", " /| |\\"], "walk": ["  ~~~", "~(o.o)", " /| |\\"] }
  ]
}
```

- `type`: the agent type, as `subagent_type` names it. Left out, or `*`, any type.
- `match`: a case-insensitive pattern on the agent's name (the description in the panel), so one type, say `general-purpose`, splits into roles. A pattern that does not compile drops its rule.
- `art`: up to 4 lines of up to 16 cells, drawn beside the row. Emoji work and count as two cells, joined ones (🧑‍💼) and flags included; each line is padded so the text beside it stays put. How an emoji looks is up to the terminal's font.
- `walk`: a second frame a running agent swaps to every second.
- `color`: `#rrggbb`, for the art, the bar and the status mark; the desktop panel uses it too.
- `label`: shown in place of the type on the row's second line.

The panel reads the file again when it changes. A pane under 40 columns keeps the plain square. `avatars.example.json` beside this README is a starting point.

Install instructions are in the [repository README](../../README.md).
