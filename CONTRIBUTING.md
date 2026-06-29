# Contributing to codeclub / Contribuir a codeclub

## Contributor License Agreement (CLA)

**English:**

Before we can accept any pull request, you must sign a Contributor License Agreement (CLA). This is a legal document that grants the project maintainer (Ignacio Agustin Angelone) the right to relicense your contributions under the AGPLv3 and/or a commercial license. This is necessary to maintain the dual-licensing model.

By submitting a pull request, you confirm that:

1. You own the copyright to the code you are contributing.
2. You grant Ignacio Agustin Angelone a perpetual, worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and distribute your contribution under both the AGPLv3 and a separate commercial license.
3. You are not submitting code that violates any third-party rights or licenses.

To sign the CLA, add your name and email to the `CLA-SIGNATURES.md` file in your pull request, or email a signed copy to **iangel.oned@gmail.com**.

---

**Español:**

Antes de que podamos aceptar cualquier pull request, debes firmar un Acuerdo de Licencia de Contribuidor (CLA). Este es un documento legal que otorga al mantenedor del proyecto (Ignacio Agustin Angelone) el derecho de relicenciar tus contribuciones bajo AGPLv3 y/o una licencia comercial. Esto es necesario para mantener el modelo de licencia dual.

Al enviar un pull request, confirmás que:

1. Sos titular del copyright del código que estás contribuyendo.
2. Otorgás a Ignacio Agustin Angelone una licencia perpetua, mundial, no exclusiva y libre de regalías para usar, reproducir, modificar y distribuir tu contribución tanto bajo AGPLv3 como bajo una licencia comercial separada.
3. No estás enviando código que viole derechos de terceros o licencias existentes.

Para firmar el CLA, agregá tu nombre y email al archivo `CLA-SIGNATURES.md` en tu pull request, o enviá una copia firmada a **iangel.oned@gmail.com**.

---

## How to Contribute / Cómo Contribuir

### English

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes. Follow the existing code style.
4. Run `npm run typecheck` and ensure it passes.
5. Sign the CLA (see above).
6. Submit a pull request.

### Español

1. Hacé un fork del repositorio.
2. Creá una rama de feature: `git checkout -b feature/mi-feature`
3. Hacé tus cambios. Seguí el estilo de código existente.
4. Ejecutá `npm run typecheck` y asegurate de que pase.
5. Firmá el CLA (ver arriba).
6. Enviá un pull request.

---

## Code Style / Estilo de Código

- TypeScript strict mode.
- No `any` types unless absolutely necessary.
- POSIX paths in WSL environments.
- Existing patterns in `src/main/` and `src/renderer/src/` take priority over personal preference.
