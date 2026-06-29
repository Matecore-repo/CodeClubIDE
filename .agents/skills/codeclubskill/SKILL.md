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
- **Robust Simplicity**: Logic must be straightforward and easy to read, avoiding "clever code", but always handling edge cases and errors.
- **Architectural Consistency**: Reuse existing patterns, utilities, and dependencies in the project. Do not invent parallel structures or install redundant libraries.
- **Zero Invasive Refactors**: Make surgical changes. Do not rewrite entire functions or alter shared contracts if the problem can be solved locally.
- **Strict Scope**: Stay within the user's explicit request. Do not modify the interface, visual design, or interaction flows unless the user specifically asks for it.
- **Clear Boundaries**: ALWAYS generate an implementation plan before coding. Define the goal, the files to touch, and the success criteria. Stop immediately upon solving the problem.

## 3. Code Health Review

- ALWAYS, before considering a programming task finished, verify the health of the generated code using the tools available for the project's language (such as type checking, compilation, linting, or tests).
- ALWAYS check for regressions, missed edge cases, errors, and maintainability before finalizing the task.
