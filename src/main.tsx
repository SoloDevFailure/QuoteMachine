import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { disableDevelopmentCaches } from "./app/devCache";
import "./styles/tokens.css";
import "./styles/global.css";

disableDevelopmentCaches();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL("./sw.js", document.baseURI)).catch((error) => {
      console.warn("[ForteStack] offline service worker registration failed", error);
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
