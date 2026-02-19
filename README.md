# Prototype Quiz Maker (N7–N9)

This is a **static** (no database) prototype you can drop into a single GitHub repo and run on **GitHub Pages**.

## What’s included
- `index.html` — the **dashboard + student quiz** in one page
- `questionBank.js` — the **question bank module** (N7, N8, N9 generators + rendering + marking)

## Run locally (recommended)
Because this uses ES Modules (`import ... from "./questionBank.js"`), you should run a local web server (not `file://`).

### Option A: Python
From the folder containing `index.html`:

```bash
python -m http.server 8000
```

Then open:
- `http://localhost:8000/`

### Option B: VS Code Live Server
Right-click `index.html` → **Open with Live Server**

## Run on GitHub Pages
1. Create a GitHub repo (public is simplest for testing).
2. Upload `index.html` and `questionBank.js` to the repo root.
3. In the repo: **Settings → Pages**
   - Source: `Deploy from a branch`
   - Branch: `main` / `/ (root)`
4. Open the Pages URL GitHub gives you.

## How to use
1. In **Create quiz**:
   - Set a quiz title (optional)
   - Set number of questions (or use “Add question”)
2. For each question slot:
   - Choose topic (N7/N8/N9), marks (1–5), and paper (calculator/non‑calculator)
   - Use “New numbers” to regenerate that slot’s random values
3. Click **Generate quiz**
4. Fill in answers and click **Submit & mark**
5. Optional: **Reveal answers** (shows a full answer key per question)

## Notes
- Marking and randomisation come directly from your last working N7–N9 generator logic.
- No storage: everything is in-memory for prototype testing.
