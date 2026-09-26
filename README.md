# PILLAR BUILDWORKS

A local-first construction notebook: create a job, capture ordered notes/photos/drawings, then generate an A4 work-order PDF.

## Open the app

Double-click `Start-PillarBuildworks.cmd`. The legacy `Start-ForteStack.cmd` launcher also remains compatible. Both build and serve the app at **http://127.0.0.1:4173**.

For development: `npm install`, then `npm run dev`. Do not open the root HTML file directly.

## Workflow

- **Home → Projects → Notebook.** New Job opens one job/client form. Quick Draw explicitly asks which job owns the drawing.
- **Notes:** rename, collapse, drag a section handle, or use its menu to move it. Content menus move items earlier/later or into another section and support insertion between items.
- **Attachments:** small cached photo thumbnails; tap for the original. Drawings open the existing editor and return to the same notebook.
- **Generate Work Order:** generates a local A4 PDF from all of the project's notebooks, in creation order, with sections and mixed contents in their stored order. Photos are large and drawings get their own pages. Internal client notes are excluded.
- The current notebook is authoritative. V1 exports are not frozen revisions or saved document records.

## Data and updates

The database remains **`fortestack`**, now schema version **7**. The only new store is `thumbnails`; original asset blobs and drawing geometry are unchanged. Additional job/contact fields are optional. The old route key `fortestack.activeRoute` and existing PWA identity/scope are retained.

Keep the same origin (scheme, hostname and port) to retain access to browser data. The development server, localhost, 127.0.0.1 and a hosted domain each have separate storage. Do not clear site data to update the app. There is no cloud sync or in-app full-project backup/import yet.

Pending notebook edits are flushed before in-app navigation, collapse, drawing entry and export. Save failures remain retryable and block those actions. Browser close protection is best-effort; operating-system termination cannot guarantee a final asynchronous write.

## Phone / offline

The GitHub Pages workflow builds and publishes on pushes to main. Open the HTTPS address and install/Add to Home Screen. A successful service-worker installation caches the complete application, including the PDF generator and document font. Device camera, soft keyboard, download handling and touch drawing still need real-device acceptance testing.

## Validation

- `npm run build`: TypeScript, production build and offline bundle.
- `npm test`: room joins plus migration/storage/document ordering tests.
- `npm run test:browser`: isolated browser checks against a development server at port 5175 (override `PILLAR_TEST_URL`). Uses Playwright and installed Edge by default; set `PILLAR_TEST_BROWSER=chromium` to use an installed Playwright Chromium.
- Start that server with `npm run dev -- --host 127.0.0.1 --port 5175 --strictPort`.

Browser fixtures exist only in a fresh test context. Test PDFs and screenshots go under `tmp/pillar-audit`; they are not user projects.

The DejaVu Sans font used in PDFs is distributed with its license in `public/fonts/LICENSE-DejaVu.txt`.
