---
name: viteplus
description: >
  Vite+ unified CLI toolchain reference. Use this when interacting with Vite+ (`vp`) projects 
  for runtime, dependencies, building, testing, linting, formatting, and executing scripts.
---

# Vite+ (`vp`) AI Reference

**Overview:** Unified toolchain replacing Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, Vite Task, Node version managers, and package managers.
**Docs:** https://viteplus.dev/guide/ | Full AI Context: https://viteplus.dev/llms-full.txt

## Installation

- macOS/Linux: `curl -fsSL https://vite.plus | bash`
- Windows (PS): `irm https://vite.plus/ps1 | iex`

## Core Commands

- `vp create`: Scaffold new project.
- `vp migrate [path] [--no-interactive] [--agent <name>]`: Migrate project to Vite+. Requires Vite 8+, Vitest 4.1+. Rewrites imports (`vite` -> `vite-plus`, `vitest` -> `vite-plus/test`), merges config (`tsdown` -> `pack`, `lint-staged` -> `staged`), updates deps.
- `vp dev`: Start dev server.
- `vp build`: Build web app for production.
- `vp pack`: Build library for production (using tsdown).
- `vp check`: Run format, lint (Oxlint), and type checks together.
- `vp lint`: Lint code with Oxlint.
- `vp fmt`: Format code with Oxfmt.
- `vp test [watch | run --coverage]`: Run tests with Vitest.

## Execution & Scripts

- `vp run <script>` (alias: `vpr`): Run `package.json` scripts or `vite.config.ts` tasks. Built-in caching & workspace-aware.
- `vp ws <cmd>`: Run command across monorepo workspaces.
- `vpx` | `vp exec` | `vp dlx`: Run binary without local install.
- `vp node <script>`: Run Node.js script using the resolved project runtime.

## Package Management

Abstracts pnpm, npm, yarn, bun.
**Detection Priority:** `package.json#packageManager` > `pnpm-workspace.yaml` > lockfiles > fallback: `pnpm`.

- `vp install`: Install deps (supports `--frozen-lockfile`, `-w`).
- `vp install -g <pkg>` / `vp uninstall -g <pkg>`: Global packages.
- `vp add <pkg> [-D]` / `vp remove <pkg>`: Add/remove dependencies.
- `vp update` / `vp dedupe` / `vp outdated`: Manage dependency versions.
- `vp list` / `vp why <pkg>` / `vp info <pkg>`: Inspect packages.
- `vp rebuild`: Rebuild native modules.
- `vp pm <cmd>`: Raw passthrough to underlying package manager.
- `vp pm stage`: Staged publishing workflow.

## Environment & Node Management (`vp env`)

**Managed Mode Default:** Resolves Node.js via `.node-version` > `package.json` (`devEngines.runtime` > `engines.node`) > global default (`vp env default`) > latest LTS.

- `vp env setup`: Create shims. (PS: add `. "$env:USERPROFILE\.vite-plus\env.ps1"` to `$PROFILE`).
- `vp env on` / `vp env off`: Managed mode vs system-first mode.
- `vp env pin <ver>`: Pin project Node version.
- `vp env use <ver>`: Session override.
- `vp env install` / `vp env uninstall`: Manage downloaded Node versions.
- `vp env current` / `vp env doctor` / `vp env which`: Diagnostics.
- **Corepack:** Safe shim included. `corepack enable` works safely under Vite+.

## System & Rules

- `vp upgrade`: Update Vite+.
- `vp implode`: Completely remove Vite+ from the machine.
- **NEVER** use `npm run dev`, `pnpm build`, `vite`, or `vitest` directly. **ALWAYS** use `vp <cmd>`.
