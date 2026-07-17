import { useEffect, useState } from "react";
import { BottomSheet } from "../../../components/BottomSheet";
import type { DoorAnnotation, DoorKind } from "../annotationTypes";

type DoorEditorSheetProps = {
  door?: DoorAnnotation;
  isOpen: boolean;
  onDismiss: () => void;
  onUpdate: (door: DoorAnnotation) => void;
};

export function DoorEditorSheet({ door, isOpen, onDismiss, onUpdate }: DoorEditorSheetProps) {
  const [kind, setKind] = useState<DoorKind>("hinged");
  const [widthMm, setWidthMm] = useState("820");

  useEffect(() => {
    setKind(door?.kind ?? "hinged");
    setWidthMm(String(door?.widthMm ?? 820));
  }, [door]);

  function commit() {
    if (!door) return;
    const parsedWidth = Number.parseFloat(widthMm);
    onUpdate({
      ...door,
      kind,
      widthMm: Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : door.widthMm,
      updatedAt: new Date().toISOString(),
    });
    onDismiss();
  }

  if (!door) return null;

  return (
    <BottomSheet
      title="Door"
      isOpen={isOpen}
      placement="center"
      onDismiss={onDismiss}
      footer={
        <div className="sheet-actions">
          <button className="primary-button" type="button" onClick={commit}>
            Done
          </button>
        </div>
      }
    >
      <div className="form-stack">
        <label>
          <span>Type</span>
          <div className="segmented-control segmented-control--two">
            <button className={kind === "hinged" ? "is-active" : ""} type="button" onClick={() => setKind("hinged")}>
              Hinged
            </button>
            <button className={kind === "cavity" ? "is-active" : ""} type="button" onClick={() => setKind("cavity")}>
              Cavity slider
            </button>
          </div>
        </label>
        <label>
          <span>Width</span>
          <input value={widthMm} inputMode="decimal" onChange={(event) => setWidthMm(event.target.value)} />
        </label>
        <div className="door-editor-actions">
          <button type="button" onClick={() => onUpdate({ ...door, hingeSide: door.hingeSide === "start" ? "end" : "start", updatedAt: new Date().toISOString() })}>
            Flip hinge
          </button>
          <button type="button" onClick={() => onUpdate({ ...door, swingDirection: door.swingDirection === 1 ? -1 : 1, updatedAt: new Date().toISOString() })}>
            Flip swing
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
