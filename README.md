# ForteStack

ForteStack is a mobile-first construction workspace.

## Open The App

Double-click `Start-ForteStack.cmd`.

That will build the app, start the local app server, and open:

```text
http://127.0.0.1:4173
```

Do not open the root `index.html` directly. This app is built with React and Vite, so it needs to be served through a local app server.

## Publish And Install On A Phone

Push the project to the repository's `main` branch, then open the repository's
**Settings → Pages** and set **Source** to **GitHub Actions**. Each push will
build and publish the app automatically.

Open the published HTTPS address on the phone and choose **Add to Home screen**
or **Install app**. ForteStack launches in a standalone app window and caches
the application shell for offline reopening. Drawings and imported images are
stored locally by that browser installation, so clearing the site's storage or
uninstalling it can remove local drawing data.
