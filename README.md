# Annotation platform

A private, guideline-gated annotation workspace for question–answer evaluation. The application is in
[`annotation-studio/`](annotation-studio/README.md); operations and recovery procedures are in
[`annotation-studio/docs/OPERATIONS.md`](annotation-studio/docs/OPERATIONS.md).

Production runs as a single Node 22 container on Railway with SQLite on a persistent `/data` volume.
Qualification answers and the supplied guideline PDFs are deployment secrets: they are not part of
this repository and never appear in its history.

```sh
cd annotation-studio
npm ci
npm run build
npm run migrate       # DATABASE_PATH defaults to .data/app.db
npm run bootstrap     # requires BOOTSTRAP_ADMIN_* and QUALIFICATION_KEYS_JSON
npm run dev
```
