import { useEffect, useState } from "react";
import { BottomSheet } from "../../../components/BottomSheet";
import type { RoomAnnotation } from "../annotationTypes";

type RectShapeEditorSheetProps = {
  rect?: RoomAnnotation;
  isOpen: boolean;
  onDismiss: () => void;
  onUpdate: (rect: RoomAnnotation) => void;
};

export function RectShapeEditorSheet({ rect, isOpen, onDismiss, onUpdate }: RectShapeEditorSheetProps) {
  const [label, setLabel] = useState("");
  const [internalWidth, setInternalWidth] = useState("");
  const [internalHeight, setInternalHeight] = useState("");
  const [fillColour, setFillColour] = useState("#ffffff");

  useEffect(() => {
    setLabel(rect?.label ?? "");
    setInternalWidth(rect?.internalWidth ?? "");
    setInternalHeight(rect?.internalHeight ?? "");
    setFillColour(rect?.fillColour ?? "#ffffff");
  }, [rect]);

  function commit() {
    if (!rect) return;
    onUpdate({
      ...rect,
      label: label.trim() || undefined,
      internalWidth: internalWidth.trim() || rect.internalWidth,
      internalHeight: internalHeight.trim() || rect.internalHeight,
      fillColour,
    });
    onDismiss();
  }

  if (!rect) return null;

  return (
    <BottomSheet
      title="Room"
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
          <span>Room name</span>
          <input value={label} onChange={(event) => setLabel(event.target.value)} />
        </label>
        <label>
          <span>Internal width</span>
          <input value={internalWidth} inputMode="decimal" onChange={(event) => setInternalWidth(event.target.value)} />
        </label>
        <label>
          <span>Internal length</span>
          <input value={internalHeight} inputMode="decimal" onChange={(event) => setInternalHeight(event.target.value)} />
        </label>
        <label>
          <span>Room fill</span>
          <div className="room-fill-control">
            <input type="color" value={fillColour} onChange={(event) => setFillColour(event.target.value)} />
            <input value={fillColour} aria-label="Room fill colour" onChange={(event) => /^#[0-9a-f]{0,6}$/i.test(event.target.value) && setFillColour(event.target.value)} />
          </div>
        </label>
      </div>
    </BottomSheet>
  );
}
