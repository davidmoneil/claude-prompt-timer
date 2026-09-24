# claude-prompt-timer

A Claude Code hook that gives Claude temporal awareness by injecting the current time and elapsed time since the last prompt into every interaction.

## Why?

Claude Code has no built-in sense of time. It doesn't know if you just sent a message 30 seconds ago or came back after an 8-hour break. This hook fixes that by injecting timing context into every prompt, so Claude can:

- Know the current date, time, and timezone
- Detect the first prompt of a new session
- Understand how long you've been away and adjust accordingly

## What Claude sees

On your first prompt:
```
--- Prompt Timing ---
Current: 2026-04-09 14:52:03 CDT
First prompt of session
---
```

After a long break:
```
--- Prompt Timing ---
Current: 2026-04-09 22:15:00 CDT
8h 23m since last prompt — long gap, context may have shifted significantly
---
```

### Thresholds

| Gap | Behavior |
|-----|----------|
| < 2 min | Timestamp only — rapid conversation, no comment needed |
| 2-30 min | Shows elapsed time |
| 30 min - 2h | "short break" |
| 2-8h | "extended break, context may need refresh" |
| 8h+ | "long gap, context may have shifted significantly" |

New sessions (different `session_id`) always show "First prompt of session" regardless of time gap.

## Installation

### Option 1: Plugin marketplace (recommended)

```bash
# Add the marketplace source
/plugin marketplace add davidmoneil/claude-prompt-timer

# Install the plugin
/plugin install prompt-timer@claude-prompt-timer
```

### Option 2: Plugin directory (local/development)

```bash
git clone https://github.com/davidmoneil/claude-prompt-timer.git
claude --plugin-dir ./claude-prompt-timer/
```

### Option 3: Manual hook (settings.json)

Copy `scripts/prompt-timer.js` somewhere accessible, then add to your `.claude/settings.json` (project-level or `~/.claude/settings.json` for all projects):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"/path/to/prompt-timer.js\""
          }
        ]
      }
    ]
  }
}
```

## How it works

- Runs as a `UserPromptSubmit` hook — executes on every prompt before Claude processes it
- Persists a tiny state file at `~/.claude/prompt-timer-state.json` with the last prompt time and session ID
- Compares current time against stored state to compute elapsed time
- Injects timing context via `hookSpecificOutput.additionalContext`
- Uses `session_id` from Claude Code to detect new sessions

## Requirements

- Node.js 12+ (uses `Intl.DateTimeFormat` for timezone detection)
- Zero external dependencies

## State file

Located at `~/.claude/prompt-timer-state.json`:

```json
{
  "lastPromptTime": "2026-04-09T20:52:03.000Z",
  "lastSessionId": "abc123"
}
```

Delete this file at any time to reset — the hook treats a missing file as "first prompt."

## License

MIT
