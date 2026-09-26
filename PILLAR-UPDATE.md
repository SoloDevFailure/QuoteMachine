# PILLAR BUILDWORKS implementation report

## Implemented

Rebuilt the app around a local construction notebook, with charcoal surfaces, lime accents, a drafting-style PILLAR wordmark, compact project rows and attachment tiles. Added richer job/client editing, persistent thumbnails, save coordination and local A4 work-order generation. The supplied reference guided the visual direction; unavailable quote/calculator features are not presented as working destinations.

## UI / navigation

Home and Projects are the main destinations. A project opens its notebook directly. New Job uses the same consolidated form as editing an existing job. Quick Draw asks which project owns the sketch. Legacy saved project/drawing routes resolve into the new workspace. Existing projects with multiple notebooks retain a notebook selector.

## Site Notes

The workspace has a sticky project header, compact client details and Notes, Drawings and Photos tabs. Sections can be renamed, collapsed, dragged by their handle or reordered through menus. Mixed text, photo and drawing items retain their stored sequence. Item menus support reordering, moving between sections, insertion and removal. The compact add sheet supports camera capture, multiple gallery photos, text and new/existing drawings. Drawing lists also support rename and deletion with confirmation.

Text saves are debounced, with explicit flushes before in-app transitions and export. Failed saves remain available for retry instead of silently discarding edits. The footer provides Add Section and Generate Work Order.

## Client / job data

Added optional suburb, state, postcode, job reference, general job notes, client company, alternate phone, billing address and internal client notes. Existing contact selection and optional contact updates are integrated into the job form. Contact updates preserve the original creation date and existing fields omitted from the edit. Project cover photos can be selected or removed. Cancelling a new-job form does not create an empty persisted job.

Older records remain valid because the new fields are optional. Existing project/contact IDs are retained.

## Thumbnails

Schema version 7 adds a separate `thumbnails` store keyed by original asset ID. Thumbnails are generated lazily at a maximum dimension of 192 pixels, without upscaling, and cached as WebP blobs. Concurrent requests share generation work. Project rows and notebook photo tiles load these small cached assets; opening a photo loads its original blob. Originals are never replaced by thumbnail generation.

The browser fixture produced a 1,202-byte thumbnail from a 44,388-byte original. Asset cleanup also removes cached thumbnails, while reference checks protect assets still used as project covers or elsewhere.

## Work order

Generate Work Order flushes edits and reads a fresh project snapshot. All notebooks are included in creation order, with sections and mixed content in their saved order. The PDF includes job/client/site information, general job notes, numbered sections, selectable text, large photos, full-page drawings, headers and page numbers. Internal client notes are excluded.

Generation runs locally with jsPDF and a bundled, licensed Unicode font. Photos use original assets, resized only in the export copy. A separate read-only drawing adapter uses the existing annotation renderer, respects hidden layers and fits drawing bounds. Missing attachments produce a clear export failure rather than silently incomplete paperwork. The result can be viewed and downloaded locally; no API key or network generation service is required.

Implementation: `src/features/documents/workOrderModel.ts`, `generateWorkOrder.ts`, `workOrderPdf.ts`, `renderDrawing.tsx` and `WorkOrderSheet.tsx`.

## Drawing system

Changed drawing entry/return navigation, notebook preview sizing and interaction, layer-aware preview ordering, and the export filename prefix. Added a separate PDF rendering adapter. Scoped styling preserves the existing light drawing workspace and control contrast inside the dark application shell.

No drawing geometry, room-join calculations, annotation editing tools or core SVG renderers were rewritten. The protected-file comparison identified only `DrawingWorkspace.tsx` as changed; its intended functional change is the export filename prefix. That file also underwent text-file rewriting, so it is not claimed to be byte-identical apart from the prefix. Browser testing confirmed work-order generation did not modify stored annotation data. Existing room-join tests pass.

## Persistence

The IndexedDB database remains `fortestack`. Migration 6 → 7 adds only the thumbnail store; existing records and IDs survive. Additional fields require no destructive conversion.

The pending-save queue serializes revisions and retains failed work. Ordering operations now merge against current stored records so inserting or reordering items cannot overwrite newly flushed text, section titles or destination changes. Project/contact/cover creation is transactional. Asset deletion checks shared references. Connections close on database version changes.

The service worker now precaches the complete build, including the lazy PDF generator and font. Production testing verified reopening a saved job and generating the first PDF with networking disabled.

## Branding

Updated the visible app name, wordmark, document branding, page metadata, install manifest, icon artwork, version stamp, export filenames, launcher messages and deployment workflow label. Added `Start-PillarBuildworks.cmd`; the old launcher remains compatible.

Intentionally retained internal identifiers: database `fortestack`, saved route key `fortestack.activeRoute`, package name, icon filename, compatible cache naming and legacy diagnostic prefixes. These are not displayed as the new product identity and retaining them avoids unnecessary compatibility changes.

## Tests

- TypeScript and production build passed, including complete offline precache generation.
- 22 automated tests passed: 9 existing room-join tests and 13 migration, persistence, asset-reference, save-queue, document-ordering and rendering-helper tests.
- Isolated Edge browser checks passed at mobile and desktop widths, including new job creation, immediate save flush, drawing entry/return, form keyboard focus, section drag/menu ordering, content ordering, original-photo viewing, gallery import, PDF download and unchanged drawing annotations after export. No page errors were reported.
- Production offline checks passed for saved-job reopening and first-time PDF generation without networking.
- The eight-page fixture PDF was rendered and visually reviewed; A4 dimensions, extracted text and content ordering were also checked.
- Dependency audit reported zero vulnerabilities after compatible dependency updates.

Fixtures used fresh browser contexts, not the user's saved projects. Screenshots and sample PDFs are in `tmp/pillar-audit` and are excluded from version control.

## Remaining issues / acceptance checks

- Real-device acceptance is still needed for camera permissions, soft keyboards, touch dragging/drawing, pinch gestures, PDF viewing/downloading and installed-app updates, especially on iOS Safari.
- Browser shutdown protection is best-effort. An operating-system kill cannot guarantee completion of asynchronous writes; in-app transitions do await saves.
- There is no cloud sync, full-project backup/import, frozen work-order revision history or saved document library in this version.
- The PDF library is loaded on demand and produces a bundle-size advisory; it is included in offline precaching so first offline generation works.
- Keep using the same scheme, host and port to access existing browser data. Do not clear site storage to update. The standard launcher retains `http://127.0.0.1:4173`.
- No public deployment was performed. Existing hosted/PWA installations receive this version only after it is deployed through the normal project workflow.

## Important files

| Area | Files |
| --- | --- |
| App flow | `src/app/App.tsx`, `src/app/routes.ts` |
| Visual system | `src/styles/pillar.css`, `src/components/Brand.tsx` |
| Projects / contacts | Project list, Home, ProjectRow and ProjectInfoSheet components; project/client types and stores |
| Notebook | `SiteNoteScreen.tsx`, `SiteNoteText.tsx`, `siteNoteStore.ts` |
| Save coordination | `src/storage/pendingSaves.ts` |
| Thumbnail cache | `src/features/assets/thumbnails.ts`, ThumbnailImage component, IndexedDB schema |
| Documents | `src/features/documents/` |
| Offline app | `public/sw.js`, `scripts/prepare-offline.mjs`, manifest and icon |
| Checks | `scripts/test-pillar.mjs`, `scripts/test-pillar-browser.mjs`, `scripts/test-pillar-offline.mjs` |
| Launch / instructions | `Start-PillarBuildworks.cmd`, `README.md` |
