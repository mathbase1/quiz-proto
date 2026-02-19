# Prototype Quiz Maker (Static) — N7–N9

This is a **static** prototype (no database) intended to run on **GitHub Pages** (or any static host).

## Files
- `index.html` — Dashboard + quiz runner (teacher builds a quiz, student view, auto-marking).
- `questionBank.js` — Question generator + rendering + marking logic (N7–N9).

## Run on GitHub Pages
1. Upload **both** files (`index.html`, `questionBank.js`) to the **root** of your repo.
2. Go to **Settings → Pages**.
3. Set:
   - **Source**: Deploy from a branch
   - **Branch**: `main`
   - **Folder**: `/ (root)`
4. Open the **github.io** URL GitHub shows.

## Common “buttons do nothing” cause
If you open the HTML **inside github.com** (file viewer), scripts will **not run**.

You must open the **GitHub Pages** URL:
- `https://<username>.github.io/<repo>/`

## Local test
Use any local web server, e.g.
```bash
python -m http.server 8000
```
then open:
- `http://localhost:8000/`

## Troubleshooting
- Make sure the filename is exactly `questionBank.js` (case-sensitive).
- Make sure it is in the same folder as `index.html`.
- Open DevTools Console for any errors.
