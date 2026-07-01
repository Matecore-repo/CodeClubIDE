# codeclub

Offline-first, BYOK AI IDE. Built with React 19, Electron, TypeScript. No telemetry, no cloud dependency.

## Architecture

- `src/main/` — Main process. IPC handlers for filesystem, search, terminal, debug, and indexer.
- `src/renderer/src/` — Renderer. Monaco editor, xterm.js terminal, AI tooling.

## Modes

**Coding Mode** — Standard IDE. File explorer, Monaco editor, integrated terminal, AI agent panel.

**Studio Mode** — Project management. Table-based workspace stored as CSV (`.codeclub/data/table_1.csv`) with schema in `.codeclub/studio.json`.

**Design Mode** — Vector design tool. Layers, fills, strokes, text, freehand drawing, shapes. Components/instances, auto-layout (Yoga), boolean ops. Design tokens (colors, typography, spacing, gradients, shadows). Figma import. CanvasKit (Skia WASM) renderer. Exports to PNG, JSX/TSX + CSS.

## AI Providers

OpenAI, Anthropic (Claude), Google (Gemini), Ollama (local), LM Studio. Provider selected per-conversation.

## Agent Capabilities

- **Swarm subagents** — Up to 4 concurrent AI workers with independent context.
- **Plan & todo tracking** — Macro strategy (`update_plan`) and micro tasks (`update_todo`).
- **Checkpoints & rollback** — Auto-snapshot before each message. Restores chat + file state.
- **Memory** — Persistent key-value store per workspace (`memory:*`).
- **RAG blocks** — Code snippet library with semantic search (`rag:*`).
- **Skills** — Workspace-level agent instructions in `.agents/skills/<name>/SKILL.md`.
- **Tool chain** — Atomic batch of up to 8 file operations with conflict verification.

## Licensing / Licencia

Dual model / modelo dual:

| License / Licencia         | Use Case / Caso de Uso                                                                    | Cost / Costo  |
| -------------------------- | ----------------------------------------------------------------------------------------- | ------------- |
| **AGPLv3**                 | Personal, educational, academic, research / Personal, educativo, académico, investigación | Free / Gratis |
| **Commercial / Comercial** | Enterprise, corporate, SaaS, for-profit / Empresarial, corporativo, SaaS, fines de lucro  | Paid / Pago   |

- See [LICENSE](LICENSE) / Ver [LICENSE](LICENSE).
- Commercial inquiries / Consultas comerciales: **iangel.oned@gmail.com**
- DCO sign-off required for contributions. See [CONTRIBUTING.md](CONTRIBUTING.md). / DCO sign-off requerido para contribuir.

## Rules

- Run `npm run typecheck` before considering any task complete.
- POSIX paths required in WSL environments.
- Use AST tools (`read/edit/search`) for all file operations.
- Local Word2Vec indexer auto-syncs on workspace open.
