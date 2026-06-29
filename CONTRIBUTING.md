# Contributing to codeclub / Contribuir a codeclub

## Developer Certificate of Origin (DCO)

**English:**

In lieu of a formal Contributor License Agreement, this project uses the **Developer Certificate of Origin (DCO)**. By signing off each commit, you confirm ownership and grant the project the right to relicense your contribution under AGPLv3 and/or a commercial license. This is necessary to maintain the dual-licensing model.

To sign off, use `git commit -s` or add `Signed-off-by: Your Name <your@email.com>` at the end of your commit message.

---

**Español:**

En lugar de un Acuerdo de Licencia de Contribuidor formal, este proyecto usa el **Developer Certificate of Origin (DCO)**. Al firmar cada commit, confirmás la titularidad del código y otorgás al proyecto el derecho de relicenciar tu contribución bajo AGPLv3 y/o licencia comercial. Esto es necesario para mantener el modelo de licencia dual.

Para firmar, usá `git commit -s` o agregá `Signed-off-by: Tu Nombre <tu@email.com>` al final de tu mensaje de commit.

---

### DCO Full Text / Texto Completo

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

---

## How to Contribute / Cómo Contribuir

### English

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes. Follow the existing code style.
4. Run `npm run typecheck` and ensure it passes.
5. Commit with sign-off: `git commit -s -m "Description of change"`
6. Submit a pull request.

### Español

1. Hacé un fork del repositorio.
2. Creá una rama de feature: `git checkout -b feature/mi-feature`
3. Hacé tus cambios. Seguí el estilo de código existente.
4. Ejecutá `npm run typecheck` y asegurate de que pase.
5. Commit con sign-off: `git commit -s -m "Descripción del cambio"`
6. Enviá un pull request.

---

## Code Style / Estilo de Código

- TypeScript strict mode.
- No `any` types unless absolutely necessary.
- POSIX paths in WSL environments.
- Existing patterns in `src/main/` and `src/renderer/src/` take priority over personal preference.
