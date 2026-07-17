import { useEffect, useRef, useState } from "react";
import { useKeyboardAwareViewport } from "../../../components/useKeyboardAwareViewport";

type DimensionValueSheetProps = {
  isOpen: boolean;
  initialValue?: string;
  onConfirm: (value: string) => Promise<void> | void;
  onDismiss: () => void;
};

export function DimensionValueSheet({ isOpen, initialValue = "", onConfirm, onDismiss }: DimensionValueSheetProps) {
  const [value, setValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLFormElement>(null);
  useKeyboardAwareViewport(isOpen, sheetRef);

  useEffect(() => {
    if (!isOpen) return;

    setValue(initialValue);
    setIsSaving(false);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 90);
  }, [initialValue, isOpen]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedValue = value.trim();
    if (!trimmedValue || isSaving) return;

    setIsSaving(true);
    try {
      await onConfirm(trimmedValue);
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="measurement-sheet-overlay" role="presentation" onClick={onDismiss}>
      <form
        className="measurement-sheet"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Measurement"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="measurement-field">
          <label htmlFor="dimension-measurement">Measurement</label>
          <div>
            <input
              id="dimension-measurement"
              ref={inputRef}
              value={value}
              autoComplete="off"
              enterKeyHint="done"
              inputMode="decimal"
              onChange={(event) => setValue(event.target.value)}
            />
            <span>mm</span>
          </div>
        </div>
        <button className="primary-button" type="submit" disabled={!value.trim() || isSaving}>
          {isSaving ? "Creating" : "Create"}
        </button>
      </form>
    </div>
  );
}
