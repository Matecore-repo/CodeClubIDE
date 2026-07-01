# Code Club IDE

> **Ignacio Agustin Angelone · Argentina**

Offline-first AI IDE. BYOK — connect your own API key. No subscription, no telemetry, no cloud.
IDE de IA offline-first. BYOK — conectá tu propia API key. Sin suscripción, sin telemetría, sin nube.

[AGPLv3](LICENSE) — Free personal/educational · Gratis personal/educativo | Commercial license · Licencia comercial
[www.codeclubide.com](https://www.codeclubide.com) · [Donate / Donar](https://ko-fi.com/codeclubide)

![License](https://img.shields.io/badge/license-AGPLv3-blue?style=flat)
![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat)
![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat)
![Platform](https://img.shields.io/badge/platform-Win%20%7C%20Mac%20%7C%20Linux-lightgrey?style=flat)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
[![Donate](https://img.shields.io/badge/donate-Ko--fi-FF5E5B?style=flat&logo=kofi)](https://ko-fi.com/codeclubide)

---

## Contributors / Colaboradores

We ❤️ contributors! Check our [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
¡Agradecemos a quienes contribuyen! Revisá [CONTRIBUTING.md](CONTRIBUTING.md) para empezar.

<a href="https://github.com/Matecore-repo/CodeClubIDE/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Matecore-repo/CodeClubIDE" alt="Contributors / Colaboradores" />
</a>

---

## Quick Start / Inicio Rápido

```bash
vp install
vp run dev
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

![Screenshot](docs/Graph%20view.png)

## Modes / Modos

## Product Boundaries / Límites del producto

Code Club IDE is intentionally split into three bounded modes, not one mixed surface. Coding Mode is the core IDE, Studio Mode is a local table-based project workspace, and Design Mode is a lightweight vector design tool. Each mode has its own data model, workflow, and responsibility.

Code Club IDE está dividido intencionalmente en tres modos con límites claros, no en una sola superficie mezclada. Modo Código es el IDE principal, Modo Studio es un espacio local de gestión basado en tablas, y Modo Diseño es una herramienta liviana de diseño vectorial. Cada modo tiene su propio modelo de datos, flujo de trabajo y responsabilidad.

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
vp run dev           # Start with HMR
vp run build         # Build for production
vp check             # Format, lint & TypeScript validation
vp test              # Run tests
vp run package:win   # Package for Windows
vp run package:linux # Package for Linux (AppImage, deb, rpm)
vp run package:mac   # Package for macOS
```

## Privacy / Privacidad

All AI traffic goes directly from your device to the configured provider. codeclub does not proxy, log, or store any requests or responses.
Todo el tráfico de IA va directo de tu dispositivo al proveedor. codeclub no proxy, no loguea ni almacena nada.

## Rules of the Club / Reglas del Club

| #   | English                                                               | Español                                                                           |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | Nobody talks about the editor.                                        | Nadie habla del editor.                                                           |
| 2   | Nobody talks about the editor! If it has no owner, it has no name.    | ¡Nadie habla del editor! Si no tiene dueño, no tiene nombre.                      |
| 3   | Dead code is a corpse. Nobody keeps corpses.                          | El código muerto es un cadáver. Nadie guarda cadáveres.                           |
| 4   | In a debugging session, only two: you and the bug. One leaves.        | En una depuración solo dos: tú y el bug. Uno fuera.                               |
| 5   | One problem at a time. Busy isn't productive, it's scattered.         | Un solo problema a la vez. Estar ocupado no te hace productivo, te hace disperso. |
| 6   | You enter the terminal with no history and no past.                   | Entras a la terminal sin historia ni pasado.                                      |
| 7   | The debugging takes as long as it has to take.                        | El debugging durará lo que tenga que durar.                                       |
| 8   | First night at Code Club? Open the editor and tame the silicon beast. | ¿Primera noche en el Code Club? Abrís el editor y domás a la bestia de silicio.   |

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
