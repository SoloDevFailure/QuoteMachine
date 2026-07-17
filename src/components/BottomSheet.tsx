import { useRef } from "react";
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
  useKeyboardAwareViewport(isOpen, sheetRef);

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
