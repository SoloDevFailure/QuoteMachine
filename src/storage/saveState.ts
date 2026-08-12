import { useCallback, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useSaveState() {
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string>();
  const operation = useRef(0);

  const run = useCallback(async <T,>(save: () => Promise<T>) => {
    const current = ++operation.current;
    setState("saving");
    setError(undefined);
    try {
      const result = await save();
      if (current === operation.current) setState("saved");
      return result;
    } catch (reason) {
      if (current === operation.current) {
        setState("error");
        setError(reason instanceof Error ? reason.message : String(reason));
      }
      throw reason;
    }
  }, []);

  const reset = useCallback(() => {
    operation.current += 1;
    setState("idle");
    setError(undefined);
  }, []);

  return { state, error, run, reset };
}
