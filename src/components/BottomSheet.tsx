import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useKeyboardAwareViewport } from "./useKeyboardAwareViewport";

type BottomSheetProps = {
  title: string;
  isOpen: boolean;
  children: ReactNode;
  footer?: ReactNode;
  placement?: "bottom" | "center";
  onDismiss: () => void;
};

export function BottomSheet({
  title,
  isOpen,
  children,
  footer,
  placement = "bottom",
  onDismiss,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  useKeyboardAwareViewport(isOpen, sheetRef);

  useEffect(() => {
    if (!isOpen) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const sheet = sheetRef.current;
    const focusable = () => [...(sheet?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])];
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onDismiss(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", handleKeyDown); openerRef.current?.focus(); };
  }, [isOpen, onDismiss]);

  if (!isOpen) return null;

  return (
    <div className={`sheet-overlay sheet-overlay--${placement}`} role="presentation" onClick={onDismiss}>
      <section
        ref={sheetRef}
        className={`bottom-sheet bottom-sheet--${placement}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        {placement === "bottom" ? <div className="bottom-sheet__handle" /> : null}
        <div className="bottom-sheet__header">
          <h2>{title}</h2>
          <button className="text-button" type="button" onClick={onDismiss}>
            Cancel
          </button>
        </div>
        <div className="bottom-sheet__content">{children}</div>
        {footer ? <div className="bottom-sheet__footer">{footer}</div> : null}
      </section>
    </div>
  );
}
