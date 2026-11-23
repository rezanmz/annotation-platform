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
npm run dev
```

Open `http://localhost:5173/login`. Startup creates one annotator for each of the 17 corpus-language
pairs. Their initial email addresses and passwords are in `annotation-studio/.data/app.db.annotators.json`.
For a custom `DATABASE_PATH`, append `.annotators.json` to that path.
Startup imports `legal_annotation_guidelines.pdf`, `chemistry_annotation_guidelines.pdf`, and
`qualification-answer-keys.json` from this directory. For administrator and deployment setup,
see the [application README](annotation-studio/README.md).
