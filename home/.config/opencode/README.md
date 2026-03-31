# OpenCode Enhancement Setup Guide

This document records all enhancements made to the OpenCode configuration, serving as a quick restoration reference after reinstalling.

## Prerequisites

- Go (for installing CLI tools)
- Bun (for managing OpenCode plugin dependencies)
- A modern terminal emulator (WezTerm, Ghostty, Kitty, etc.)

## Directory Structure

```
~/.config/opencode/
  opencode.json    # Main config (plugins, etc. - no secrets)
  config.json      # Provider config with secrets (git-ignored, create manually)
  tui.json         # TUI theme and scroll settings
  package.json     # Plugin SDK dependencies
  .gitignore       # Excludes node_modules and config.json
```

---

## 1. Provider Configuration

Provider config (API keys, base URLs) is stored in a separate `config.json` file that is git-ignored. OpenCode automatically loads and merges `config.json` → `opencode.json` → `opencode.jsonc` from `~/.config/opencode/` on startup, just like `tui.json` -- no environment variables needed.

### Restore steps

After cloning this dotfiles repo, manually create `~/.config/opencode/config.json`:

```json
{
    "$schema": "https://opencode.ai/config.json",
    "provider": {
        "anthropic": {
            "options": {
                "apiKey": "YOUR_API_KEY_HERE",
                "baseURL": "https://YOUR_BASE_URL/v1"
            }
        },
        "openai": {
            "options": {
                "apiKey": "YOUR_API_KEY_HERE",
                "baseURL": "https://YOUR_BASE_URL/v1"
            }
        }
    }
}
```

> **Note:** `config.json` is listed in `.gitignore` and will NOT be committed to git.

---

## 2. TUI Configuration

**File:** `tui.json`

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "theme": "catppuccin",
  "scroll_acceleration": {
    "enabled": true
  }
}
```

---

## 3. Installed Plugins

All plugins are configured in `opencode.json` under the `plugin` field and auto-loaded on startup.

### 3.1 opencode-snip

- **Purpose:** Prefixes shell commands with `snip` to filter verbose output (git, npm, cargo, docker, etc.), reducing token consumption by 60-90%.
- **Install:** `opencode-snip@latest` (npm plugin)
- **Dependency:** Requires the `snip` CLI tool (`go install github.com/edouard-claude/snip/cmd/snip@latest`)
- **Repo:** https://github.com/VincentHardouin/opencode-snip

### 3.2 CC Safety Net

- **Purpose:** Catches destructive git and filesystem commands (`git reset --hard`, `rm -rf`, etc.) before they execute. Prevents agent-caused code loss.
- **Install:** `cc-safety-net@latest` (npm plugin)
- **Repo:** https://github.com/kenryu42/claude-code-safety-net

### 3.3 Dynamic Context Pruning (DCP)

- **Purpose:** Intelligently manages conversation context - deduplicates tool calls, prunes errored tool inputs, and can compress stale content into summaries. Reduces token usage and prevents context pollution.
- **Install:** `@tarquinen/opencode-dcp@latest` (npm plugin)
- **Commands:** `/dcp context`, `/dcp stats`, `/dcp sweep`, `/dcp compress`
- **Config:** Auto-creates `~/.config/opencode/dcp.jsonc` on first run
- **Repo:** https://github.com/Opencode-DCP/opencode-dynamic-context-pruning

### 3.4 Agent Memory

- **Purpose:** Persistent, self-editable memory blocks (Letta-inspired). Agent remembers project context, preferences, and learnings across sessions. Includes journal with semantic search.
- **Install:** `opencode-agent-memory` (npm plugin)
- **Tools:** `memory_list`, `memory_set`, `memory_replace`
- **Default blocks:** `persona` (global), `human` (global), `project` (per-project)
- **Memory files:** `~/.config/opencode/memory/*.md` (global), `.opencode/memory/*.md` (project)
- **Optional journal:** Enable in `~/.config/opencode/agent-memory.json`
- **Repo:** https://github.com/joshuadavidthomas/opencode-agent-memory

---

## 4. Pending Installations

| Plugin | Status | Notes |
|--------|--------|-------|
| opencode-notify | Needs OCX | Requires `npm install -g ocx` (needs root or user-local prefix). Once OCX is installed: `ocx add kdco/notify --from https://registry.kdco.dev` |

Install OCX with user-local prefix:
```bash
npm install -g ocx --prefix="$HOME/.local"
# then:
ocx add kdco/notify --from https://registry.kdco.dev
```

---

## 5. Tips

- Run `/init` in any new project to generate `AGENTS.md` for project context.
- Use `Tab` to switch between Plan mode and Build mode.
- Use `/compact` to compress context when conversations get long.
- Use `/undo` and `/redo` to revert or reapply agent changes.
- Press `ctrl+p` to list all available actions.
- Use `/dcp context` to see token usage breakdown.
- Ask the agent to "remember this" to use Agent Memory.
