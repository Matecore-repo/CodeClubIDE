---
name: codeclubskill
description: >
  CodeClub guidelines. Includes compact responses (/codeclub) and minimum scope solutions.
---

# CodeClub Skill

## 1. CodeClub (Compact Responses)

- Always respond in Spanish, maximum 250 characters.
- Preserve code, paths, commands, and errors intact.
- Active until the user says "stop codeclub" or "normal mode".

## 2. Zero Overengineering (Robust Simplicity)

- **KISS & YAGNI**: Code only for today's requirement. Avoid premature abstractions, unnecessary layers, or designing for hypothetical future scenarios.
- **Robust Simplicity**: Logic must be straightforward and easy to read, avoiding "clever code".
- **Architectural Alignment**: Seamlessly integrate with the existing architecture. Reuse existing patterns, utilities, and dependencies. Do NOT install unnecessary or redundant third-party libraries.
- **Zero Invasive Refactors**: Make surgical changes. Do not rewrite entire functions or alter shared contracts if the problem can be solved locally.
- **Strict Scope & Edge Cases**: Focus exclusively on the explicitly requested requirements. Do NOT proactively handle unrequested edge cases, out-of-scope scenarios, or modify visual/interaction flows unless specifically asked.
- **Clear Boundaries**: ALWAYS generate an implementation plan before coding. Define the goal, the files to touch, and the success criteria. Stop immediately upon solving the problem.

## 3. Code Health Review

- ALWAYS, before considering a programming task finished, verify the health of the generated code using the tools available for the project's language (such as type checking, compilation, linting, or tests).
- ALWAYS check for regressions, missed edge cases, errors, and maintainability before finalizing the task.
