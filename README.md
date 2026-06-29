# codeclub

> **Ignacio Agustin Angelone · Argentina**

Offline-first AI IDE. BYOK — connect your own API key. No subscription, no telemetry, no cloud.
IDE de IA offline-first. BYOK — conectá tu propia API key. Sin suscripción, sin telemetría, sin nube.

[AGPLv3](LICENSE) — Free personal/educational · Gratis personal/educativo | Commercial license · Licencia comercial
[www.codeclubide.com](https://www.codeclubide.com)

---

## Quick Start / Inicio Rápido

```bash
npm install
npm run dev
```

## Requirements / Requisitos

| Requirement / Requisito | Minimum / Mínimo      |
| ----------------------- | --------------------- |
| Node.js                 | ≥ 18                  |
| npm                     | ≥ 9                   |
| Disk / Disco            | 500 MB                |
| OS                      | Windows, macOS, Linux |

## Features / Funcionalidades

- **Semantic Git (Topographic):** AST-based file editing, atomic operations, undo by hash, cross-file node movement.
- **AI Agent:** Swarm multi-agent (up to 4 parallel), plan/todo tracking, checkpoints with rollback, persistent memory, RAG snippet library, custom skills.
- **Built-in Debugger:** DAP support for Python (debugpy) and Rust (CodeLLDB). Breakpoints, launch configs.
- **Local RAG:** Word2Vec indexer auto-syncs on workspace open. 3D graph visualization.
- **MCP Support:** Connect external tools via stdio (local) or SSE (remote).
- **Multi-terminal:** PowerShell, Git Bash, WSL. Multi-session with detach/resize.
- **Auto-updater:** Silent downloads, update notifications.
- **Image viewer:** PNG, JPG, GIF, WebP, SVG, BMP, ICO.
- **Cross-platform:** Windows, macOS, Linux. Single codebase, native packaging.

![Screenshot](docs/Coding%20mode.png)

## Modes / Modos

**Coding Mode / Modo Código**
Standard IDE. File explorer, Monaco editor (same engine as VS Code), integrated terminal (PowerShell, WSL, Git Bash), AI agent panel. Multi-chat sessions, sandbox safety mode, checkpoints with rollback, split layouts (single, 2-col, 4-quadrant).

**Studio Mode / Modo Studio**
Project management workspace. Table view with custom columns, status tracking, and file references. Data persists locally as CSV (`.codeclub/data/table_1.csv`). No external database.

**Design Mode / Modo Diseño**
Vector design tool. Layers, shapes, freehand drawing, text, fills, strokes, shadows, inner shadows, blur. Components and instances with overrides. Auto-layout (Flexbox via Yoga). Boolean operations. Design tokens (colors, typography, spacing, gradients, shadows) with `$token` references. Figma import. Export to PNG, JSX/TSX + CSS + tokens. CanvasKit (Skia WASM) renderer.

## AI Providers / Proveedores IA

| Provider  | Notes / Notas                            |
| --------- | ---------------------------------------- |
| OpenAI    | GPT-4o, o1, o3                           |
| Anthropic | Claude. Prompt caching enabled           |
| Google    | Gemini                                   |
| Ollama    | Local models. No API key required        |
| LM Studio | Local models. OpenAI-compatible endpoint |

## Development / Desarrollo

```bash
npm run dev          # Start with HMR
npm run build        # Build for production
npm run typecheck    # TypeScript validation
npm run test         # Run tests
npm run package:win  # Package for Windows
npm run package:linux # Package for Linux (AppImage, deb, rpm)
npm run package:mac  # Package for macOS
```

## Privacy / Privacidad

All AI traffic goes directly from your device to the configured provider. codeclub does not proxy, log, or store any requests or responses.
Todo el tráfico de IA va directo de tu dispositivo al proveedor. codeclub no proxy, no loguea ni almacena nada.

## Licensing / Licencia

| License / Licencia         | Use Case / Caso de Uso                                                                    | Cost / Costo  |
| -------------------------- | ----------------------------------------------------------------------------------------- | ------------- |
| **AGPLv3**                 | Personal, educational, academic, research / Personal, educativo, académico, investigación | Free / Gratis |
| **Commercial / Comercial** | Enterprise, corporate, SaaS, for-profit / Empresarial, corporativo, SaaS, fines de lucro  | Paid / Pago   |

- Full text in [LICENSE](LICENSE) / Texto completo en [LICENSE](LICENSE).
- Commercial inquiries / Consultas comerciales: **iangel.oned@gmail.com**
- DCO sign-off required for contributions. See [CONTRIBUTING.md](CONTRIBUTING.md). / DCO sign-off requerido para contribuir.

## Intellectual Property / Propiedad Intelectual

Copyright **Ignacio Agustin Angelone · Argentina**. All rights reserved where not explicitly granted by AGPLv3.
Todos los derechos reservados donde no estén expresamente otorgados por AGPLv3.
