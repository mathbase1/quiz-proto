# Prototype Quiz Maker (GitHub Pages)

This is a **static, no‑backend** prototype quiz maker you can host on **GitHub Pages** (and later move to Cloudways).

## Files

- `index.html` — Teacher dashboard + student quiz view (single-page app).
- `questionBank.js` — The question bank + generators (N7–N9).

## GitHub Pages setup (single repo)

1. Upload **both** files to the **root** of one GitHub repo:
   - `index.html`
   - `questionBank.js`

2. GitHub → **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: `main`
   - Folder: `/(root)`

3. Open the Pages URL:
   - `https://<username>.github.io/<repo>/`

> Important: Do **not** open `index.html` from the GitHub file viewer on `github.com`.
> Scripts often won’t run there. Use the **github.io** Pages URL.

## Local testing

Because this prototype uses `fetch()` to load the bank, it will not work from `file://`.

Run a local server:

```bash
python -m http.server 8000
```

Then open:

- `http://localhost:8000/`

## Notes

- Nothing is stored on a server.
- Refreshing the page resets the quiz.
