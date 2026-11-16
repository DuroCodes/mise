# mise

a self-hosted recipe manager, inspired by mealie.

## dev

you need [bun](https://bun.sh).

```bash
bun install
bun dev
```

open [localhost:5173](http://localhost:5173). the api listens on port 3001, and vite proxies `/api` and `/uploads` to it.

the first visit asks you to create an admin account; after that, sign-up is closed and only admins can add new users. there are also three demo recipes to get you started.

## docker

on the machine that will run it:

```bash
mkdir mise
cd mise
curl -fsSL -o compose.yml https://raw.githubusercontent.com/durocodes/mise/main/compose.yml
docker compose up -d
```

open [localhost:3000](http://localhost:3000) to get started. the first visit creates the admin account.

### notes

set `BETTER_AUTH_URL` to the public origin, such as `https://mise.example.com`, when the site is not served from localhost.

`DATA_DIR` is where sqlite and uploads are stored. change the left side of `3000:3000` to use a different host port. you can customize these in the `compose.yml` file.

## features

- **library**: search, tag and favorite filters, and sorting (recently updated, newest, a to z, quickest, recently cooked, top rated).
- **recipes**: scale servings, switch between metric and imperial, a link back to the original source, and a print layout.
- **cook mode**: a full-screen view that keeps the screen awake, with an ingredient checklist and one step at a time (arrow keys or swipe).
- **timers**: durations in steps, like "simmer 10 minutes", become buttons that start a countdown and chime when done.
- **shopping list**: add a recipe or a whole week of the meal plan. matching ingredients are added together, converting units when they are compatible.
- **meal plan**: a weekly planner. drag recipes onto days, or tap add on a phone.
- **ratings and cooking log**: everyone rates recipes and logs when they cooked them, with notes.
- **share links**: a read-only link to one recipe for someone without an account. it can be turned off at any time.
- **collections**: private groups of recipes, like "thanksgiving" or "weeknight dinners".
- **nutrition**: an estimate per serving from a built-in food table. nothing is sent anywhere.
- **import**: paste a recipe link, or upload a paprika export (`.paprikarecipes`), a mealie export or backup (`.zip`/`.json`), schema.org json-ld, or a saved recipe page.
- **backup and restore**: admins download a zip of everything (recipes, images, logs, plans, lists, and a copy of the database) and restore it later.
- **installable app**: add mise to your home screen. recipes you have opened stay readable offline.
- **claude (optional)**: turn pasted text or a photo of a recipe card into a recipe, and ask about substitutions. off unless `ANTHROPIC_API_KEY` is set.

## settings

| variable | default | what it does |
| --- | --- | --- |
| `DATA_DIR` | `./data` | where the database and uploads live |
| `PORT` | `3000` (`3001` in dev) | port the server listens on |
| `HOST` | `0.0.0.0` | address to bind; use `127.0.0.1` behind a tunnel or proxy |
| `BETTER_AUTH_URL` | | the public origin, such as `https://mise.example.com` |
| `BETTER_AUTH_SECRET` | generated into `DATA_DIR` | session signing secret |
| `ANTHROPIC_API_KEY` | | turns on the claude features; recipe text and photos are sent to anthropic only when someone uses them |
| `MISE_AI_MODEL` | `claude-opus-5-5` | the claude model to use |

## backups

download a backup from the admin page. restoring from the admin page merges the backup into the site and matches people by email. to roll everything back, including accounts, stop mise, delete `mise.db-wal` and `mise.db-shm` from `DATA_DIR` if they exist, then copy the backup's `mise.db` and `uploads/` folder into `DATA_DIR`.
