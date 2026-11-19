# mise

a self-hosted recipe manager, inspired by mealie.

![demo](demo.png)

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
- **my stores**: save the stores you shop at with their sections in the order you walk them (and aisle numbers), then sort the shopping list into that route.
- **pantry**: keep track of what you have, with use-by dates. tick things off the shopping list and move them in. "what can I make" ranks your recipes by what you already have and adds the missing items to your list, and claude (optional) can search the web for new recipes that use your pantry.
- **themes**: light, dark, espresso, herb, or follow the system.
- **meal plan**: a weekly planner. drag recipes onto days, or tap add on a phone.
- **ratings and cooking log**: everyone rates recipes and logs when they cooked them, with notes.
- **share links**: a read-only link to one recipe for someone without an account. it can be turned off at any time.
- **collections**: private groups of recipes, like "thanksgiving" or "weeknight dinners".
- **nutrition**: an estimate per serving from a built-in food table. nothing is sent anywhere.
- **import**: paste a recipe link (sites, TikTok, or Instagram), or upload a paprika export (`.paprikarecipes`), a mealie export or backup (`.zip`/`.json`), schema.org json-ld, or a saved recipe page. reels need `yt-dlp`, `ffmpeg`, and `MISE_WHISPER_*` when the caption is not the recipe.
- **backup and restore**: admins download a zip of everything (recipes, images, logs, plans, lists, and a copy of the database) and restore it later.
- **installable app**: install from settings (or add to home screen on iphone). recipes you have opened stay readable offline, and the shopping list works with no signal, syncing when you're back online. long-press the icon for shortcuts like scan & shop.
- **scan & shop**: scan barcodes with the camera to check items off (names come from open food facts). done shopping asks how much of each item goes in the pantry.
- **share to mise** (android): share a recipe link from any app to import it.
- **notifications**: timers that ring with the phone locked, a 9am "use soon" heads-up for expiring pantry items, and a 6pm note about tomorrow's meals. turn them on per device in settings. on iphone, install mise first.
- **ai (optional)**: turn pasted text or a photo of a recipe card into a recipe, ask about substitutions, find new recipes from your pantry, and add to the pantry from a photo of a receipt or your fridge. off unless an api key is set. [groq](https://console.groq.com) has a pretty generous free tier for both chat models (set `MISE_AI_MODEL` like `openai:…` with `MISE_AI_BASE_URL=https://api.groq.com/openai/v1`) and Whisper for reels (`MISE_WHISPER_MODEL=groq:whisper-large-v3-turbo`).

## settings

| variable                                           | default                     | what it does                                                                                           |
| -------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `DATA_DIR`                                         | `./data`                    | where the database and uploads live                                                                    |
| `PORT`                                             | `3000` (`3001` in dev)      | port the server listens on                                                                             |
| `HOST`                                             | `0.0.0.0`                   | address to bind; use `127.0.0.1` behind a tunnel or proxy                                              |
| `BETTER_AUTH_URL`                                  |                             | the public origin, such as `https://mise.example.com`                                                  |
| `BETTER_AUTH_SECRET`                               | generated into `DATA_DIR`   | session signing secret                                                                                 |
| `MISE_AI_API_KEY`                                  |                             | turns on the optional model features. one key, for whichever provider the model names                  |
| `MISE_AI_MODEL`                                    | `anthropic:claude-opus-5-5` | `anthropic:`, `openai:`, `openrouter:`, or `local:` plus the model id. the prefix is required          |
| `MISE_AI_BASE_URL`                                 | Ollama on this machine      | address of a local or openai-compatible server. `local:` uses `http://localhost:11434/v1` when unset   |
| `MISE_WHISPER_API_KEY`                             |                             | speech-to-text for TikTok / Instagram imports (separate from chat; Anthropic has no audio API)         |
| `MISE_WHISPER_MODEL`                               |                             | `groq:`, `openai:`, or `openrouter:` plus the Whisper model id, e.g. `groq:whisper-large-v3-turbo`     |
| `MISE_YT_DLP`                                      | `yt-dlp`                    | path to yt-dlp if it is not on `PATH`. reels also need `ffmpeg` on `PATH` (Docker image includes both) |
| `MISE_VAPID_PUBLIC_KEY` / `MISE_VAPID_PRIVATE_KEY` | generated into `DATA_DIR`   | keys for push notifications                                                                            |

## backups

download a backup from the admin page. restoring from the admin page merges the backup into the site and matches people by email. to roll everything back, including accounts, stop mise, delete `mise.db-wal` and `mise.db-shm` from `DATA_DIR` if they exist, then copy the backup's `mise.db` and `uploads/` folder into `DATA_DIR`.
