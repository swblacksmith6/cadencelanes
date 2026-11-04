# cadencelanes (SwimAcademy)

FastAPI + SQLite (one DB per club) backend, React/Vite PWA frontend. Read `docs/README.md` first; it indexes everything.

- Start with `docs/architecture.md` and `docs/conventions.md`. Feature behaviour is in `docs/features/`.
- Run `./run_tests.sh` before every commit. It must pass. Add or update a test with each behaviour change.
- Update the matching doc under `docs/` in the same change as the code.
- No git hooks and no GitHub Actions; do not add them.
- Never read or commit `.env` files or real keys. Secrets come from `.env` at deploy time.
- No emojis anywhere. Commit messages are 100 words or fewer.
- Everything needs the internet: do not add offline caching or write queues.
