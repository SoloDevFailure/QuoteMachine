import type { SaveState } from "../storage/saveState";

export function SaveStatus({ state, error }: { state: SaveState; error?: string }) {
  if (state === "idle") return null;
  return (
    <p className={`save-status save-status--${state}`} role={state === "error" ? "alert" : "status"}>
      {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : error || "Changes could not be saved"}
    </p>
  );
}
