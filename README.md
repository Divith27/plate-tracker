# Plate — your personal calorie tracker

A clean calorie and macro tracker built for you: your own daily budget (2250 kcal / 155g protein by default,
editable in Settings), a curated Indian home-food database (roti, dal, sabzi, paneer, your dinner rotation,
etc), plus live search against Open Food Facts for anything else. Everything is saved on your phone only
(no login, no server) via localStorage, and it installs like a real app via "Add to Home Screen."

## Deploy to GitHub Pages (5 minutes)

1. Create a new repo on GitHub, e.g. `plate-tracker` (can be private or public, Pages works either way on
   a paid plan; on the free plan the repo needs to be public for Pages to serve it).
2. Upload all files in this folder to the root of that repo (index.html, style.css, app.js, foods.json,
   manifest.json, sw.js, icons/, this README).
   - Easiest: on the repo page, "Add file" → "Upload files", drag all of them in, commit.
3. Go to the repo's **Settings → Pages**.
4. Under "Build and deployment", set **Source: Deploy from a branch**, branch: **main**, folder: **/ (root)**.
5. Save. GitHub gives you a URL like `https://yourusername.github.io/plate-tracker/` within a minute or two.
6. Open that URL on your phone in Chrome or Safari.
7. Tap the browser's share/menu icon → **"Add to Home Screen"**. It'll install like a normal app icon,
   full-screen, no browser bar.

That's it, no build step, no npm install, it's plain HTML/CSS/JS so GitHub just serves the files directly.

## Notes

- **Data lives only on the phone you use it on** (localStorage), per your earlier call to skip cross-device
  sync. If you clear your browser's site data or switch phones, use **Settings → Export all data** first as
  a backup — it downloads a JSON file with everything logged.
- **Food search**: typing 3+ characters also queries Open Food Facts live (needs internet). Your curated
  home-food list works fully offline.
- **Editing your food database**: open `foods.json` and add entries in the same shape — id, name, serving,
  kcal, protein, carbs, fat. No code changes needed, just re-upload the file to GitHub.
- **Offline**: after the first visit, the app shell is cached by the service worker, so it opens even
  without signal. Only live food search needs a connection.
