import { useEffect, useRef, useState } from "react";
import { useKeyboardAwareViewport } from "../../../components/useKeyboardAwareViewport";

type RectShapeValueSheetProps = {
  isOpen: boolean;
  initialHeight?: string;
  initialWidth?: string;
  onConfirm: (values: { internalWidth: string; internalHeight: string; label?: string }) => void;
  onDismiss: () => void;
};

export function RectShapeValueSheet({ isOpen, initialHeight = "", initialWidth = "", onConfirm, onDismiss }: RectShapeValueSheetProps) {
  const [label, setLabel] = useState("");
  const [internalWidth, setInternalWidth] = useState("");
  const [internalHeight, setInternalHeight] = useState("");
  const widthRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLFormElement>(null);
  useKeyboardAwareViewport(isOpen, sheetRef);

  useEffect(() => {
    if (!isOpen) return;
    setLabel("");
    setInternalWidth(initialWidth);
    setInternalHeight(initialHeight);
    window.setTimeout(() => {
      widthRef.current?.focus();
      widthRef.current?.select();
    }, 90);
  }, [initialHeight, initialWidth, isOpen]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!internalWidth.trim() || !internalHeight.trim()) return;
    onConfirm({
      internalWidth: internalWidth.trim(),
      internalHeight: internalHeight.trim(),
      label: label.trim() || undefined,
    });
  }

  if (!isOpen) return null;

  return (
    <div className="measurement-sheet-overlay" role="presentation" onClick={onDismiss}>
      <form
        className="rect-value-sheet"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <label>
          <span>Room name</span>
          <input value={label} placeholder="Bathroom" onChange={(event) => setLabel(event.target.value)} />
        </label>
        <div className="rect-value-sheet__grid">
          <label>
            <span>Internal width</span>
            <input ref={widthRef} value={internalWidth} inputMode="decimal" enterKeyHint="next" onChange={(event) => setInternalWidth(event.target.value)} />
          </label>
          <label>
            <span>Internal length</span>
            <input value={internalHeight} inputMode="decimal" enterKeyHint="done" onChange={(event) => setInternalHeight(event.target.value)} />
          </label>
        </div>
        <button className="primary-button" type="submit" disabled={!internalWidth.trim() || !internalHeight.trim()}>
          Create
        </button>
      </form>
    </div>
  );
}
