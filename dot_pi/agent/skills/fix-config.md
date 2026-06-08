---
name: fix-config
description: Create, modify, refactor, and review application or system configuration files. Use when working on dotfiles, YAML/TOML/JSON/INI configs, editor/tool configs, service configs, CI configs, shell profiles, package manager configs, or any task that asks to improve, clean up, split, merge, or validate configuration.
---

# Fix Config

Help the user create, modify, refactor, or review application/system configuration so the result is correct, maintainable, minimal, and grounded in real references.

## Core standard

A good configuration must:

1. Be based on the target tool's official documentation and official example configuration.
2. Cross-check patterns against high-quality public configurations, preferably from official repos, well-maintained projects, reputable dotfiles, or widely used templates.
3. Use sensible layering when the config format supports it, but avoid splitting so finely that the structure becomes harder to understand.
4. Remove or comment out redundant, obsolete, duplicated, contradictory, or cargo-culted settings after checking the existing configuration.
5. Be validated with the target tool's own validation, dry-run, lint, or effective-config inspection commands whenever available.

## Workflow

### 1. Establish scope and safety

Before editing, identify:

- Target application/tool/service and its version when available.
- Operating system, runtime, package manager, or deployment environment if relevant.
- The actual config file paths and include/import mechanism.
- Whether the config affects production, credentials, service availability, permissions, networking, or destructive actions.

Ask the user before destructive or risky operations, including deleting files, changing production/service state, rotating credentials, rewriting history, modifying broad permissions, or restarting/reloading live services.

Do not read or print secrets. If secrets are encountered, mention only their location and risk, not their value.

### 2. Inspect the current configuration first

Read the existing config and nearby project docs before proposing changes.

Check for:

- Multiple config files for the same tool.
- Include/import/source order and override precedence.
- Environment-specific files and local overrides.
- Deprecated options, aliases, old migration leftovers, duplicated defaults, and contradictory settings.
- Generated files or files owned by package managers that should not be hand-edited.

Prefer the repository's README, AGENTS.md, comments, CI config, package scripts, Makefile, and existing tests over assumptions.

### 3. Research references

For non-trivial config work, consult sources in this order:

1. Official documentation for the exact version or nearest supported version.
2. Official example config, default config, schema, or migration guide.
3. High-quality public examples on GitHub or trusted repositories.

When using external references:

- Prefer current, maintained, version-matched examples.
- Avoid copying unexplained snippets.
- Treat random dotfiles/blog snippets as inspiration, not authority.
- Record the key source URLs or file paths for the final summary.

If web access is unavailable or unnecessary for a very small local edit, state the limitation or reason and proceed from local evidence.

### 4. Design the shape before editing

Keep the structure simple and explicit.

Use layering only when it improves clarity, such as:

- `base` / `common` settings shared by all environments.
- `local` or untracked overrides for machine-specific values.
- `production`, `development`, or `test` overrides when the tool has real environment differences.
- Thematic modules for large configs, such as `ui`, `keybindings`, `plugins`, `lint`, or `servers`.

Avoid over-layering:

- Do not create many tiny files for settings that are usually read together.
- Do not add abstraction around simple values.
- Do not introduce a second source of truth.
- Do not split config if the tool's merge/precedence behavior is surprising or poorly documented.

### 5. Edit with minimal, explainable changes

When changing config:

- Prefer official option names, schemas, and documented defaults.
- Remove redundant settings when they are definitely defaults, unused, duplicated, or superseded.
- Comment out a setting only when keeping it visible is useful for future choice or rollback; include a short reason.
- Delete stale comments that no longer match behavior.
- Keep comments focused on intent, caveats, and non-obvious trade-offs.
- Preserve formatting conventions used by the existing file unless the tool has a canonical formatter.
- Avoid adding new dependencies or plugins unless the user explicitly wants that.

### 6. Validate the result

Use the most specific validation available for the target tool, for example:

- Native validation: `configtest`, `--check`, `--validate`, `doctor`, `diagnose`.
- Effective config inspection: `--print-config`, `--show-config`, `config list`, `debug config`.
- Formatter/linter/schema validation for JSON, YAML, TOML, Lua, shell, etc.
- Targeted smoke tests or dry-runs.

Do not restart, reload, deploy, or apply live service changes unless the user explicitly approves. If validation cannot be run, explain why and what command the user should run.

### 7. Final response checklist

Report concisely:

- Files changed.
- Official docs/examples and public references consulted, if any.
- Redundant or obsolete settings removed/commented and why.
- Layering structure chosen and why it is not over-split.
- Validation commands run and their result.
- Any remaining assumptions, risks, or user actions needed.
