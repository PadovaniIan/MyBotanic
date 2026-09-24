# Deploying to GitHub Pages

Everything you need is in this archive, including the hidden files (`.nojekyll`, `.gitignore`) and
the workflow at `.github/workflows/pages.yml`.

**Do not rearrange the files.** `index.html` expects `style.css`, `app.js` and `data.js` to sit
beside it in the same folder. The flat layout is deliberate: GitHub Pages serves a repository root
with no configuration at all.

---

## Option A — Git command line (recommended)

This is the only method guaranteed to include the hidden files.

```bash
unzip botanical-bed-builder.zip
cd botanical-bed-builder

git init
git add -A                     # picks up .nojekyll and .github/
git commit -m "Botanical Bed Builder"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

Then, in the repository on github.com:

**Settings → Pages → Build and deployment → Source → "GitHub Actions"**

The workflow runs on that push and on every later one. Watch it under the **Actions** tab; the
first deploy takes one to two minutes.

Your site will be at `https://YOUR-USERNAME.github.io/YOUR-REPO/`.

Confirm the hidden files were committed:

```bash
git ls-files | grep -E '^\.'
# expected:
#   .github/workflows/pages.yml
#   .gitignore
#   .nojekyll
```

---

## Option B — Drag and drop in the browser

Workable, but **your operating system's file picker normally hides dotfiles**, so `.nojekyll` and
`.github/` get silently dropped. The site still works without them: no filename in this project
begins with an underscore, so Jekyll has nothing to strip, and the repository root is already a
valid static site. You only lose the automated test run.

1. Create the repository on GitHub, then choose **uploading an existing file**.
2. Select every visible file from the unzipped folder and commit.
3. **Settings → Pages → Build and deployment → Source → "Deploy from a branch"**, branch `main`,
   folder **`/ (root)`**, then Save.

To add the workflow afterwards: **Add file → Create new file**, type
`.github/workflows/pages.yml` as the filename (GitHub creates the folders as you type each slash),
paste the contents from this archive, commit, then switch the Pages source to "GitHub Actions".

---

## Check it before you push

No build step is required, because `data.js` is committed:

```bash
python3 -m http.server 8000      # then open http://localhost:8000
```

`rendered-output-snapshot.html` shows real generated beds for five locations — open it directly in
a browser to see the output immediately, without running anything.

Optional, if you have Python 3 and Node:

```bash
python3 build_reference_data.py && python3 build_data.py   # revalidate and rebuild the data
node run_tests.js                                          # engine test suite
node geometry_check.js                                     # plan coverage and height ordering
node snapshot.js && python3 check_render.py                # verify the rendered markup
node ascii_plan.js                                         # see a planting plan as an ASCII map
node sample_output.js                                      # print real beds as text
```

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "Could not load data.js" on the page | `data.js` was not uploaded, or files were split into different folders. All site files must sit together in the repository root. |
| Blank white page | Open the browser console. Almost always a missing `data.js` or `app.js`. |
| 404 at the Pages URL | Deployment has not finished, or the Pages source was never set. Check **Settings → Pages** and the **Actions** tab. |
| Actions tab shows a red X | Read the failing step. `build_data.py` deliberately fails the build when `plants_source.txt` has an error, and the log names the species and the problem. |
| Works locally, not on Pages | You are at `https://user.github.io/repo/` rather than a domain root. Every path here is relative, so this normally just works — hard-refresh to clear the cache. |
| Edits do not appear | Pages caches aggressively. Hard-refresh with Ctrl/Cmd + Shift + R and confirm the Actions run finished. |

## Custom domain

Add a file named `CNAME` in the root containing only your domain (for example
`beds.example.com`), then set up the DNS records GitHub shows under **Settings → Pages**.
