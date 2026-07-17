import { useEffect, useState } from "react";
import { BottomSheet } from "../../../components/BottomSheet";
import type { DimensionAnnotation } from "../annotationTypes";

type DimensionEditorSheetProps = {
  dimension?: DimensionAnnotation;
  isOpen: boolean;
  onDismiss: () => void;
  onUpdate: (dimension: DimensionAnnotation) => void;
};

export function DimensionEditorSheet({
  dimension,
  isOpen,
  onDismiss,
  onUpdate,
}: DimensionEditorSheetProps) {
  const [value, setValue] = useState("");
  const [colour, setColour] = useState("#1677ff");
  const [note, setNote] = useState("");
  const [lineStyle,setLineStyle]=useState<"solid"|"dashed"|"dotted">("solid");
  const [opacity,setOpacity]=useState(1);
  const [textOutline,setTextOutline]=useState(true);
  const [textOutlineColour,setTextOutlineColour]=useState<"#000000"|"#ffffff">("#ffffff");

  useEffect(() => {
    setValue(dimension?.value ?? "");
    setColour(dimension?.colour ?? "#1677ff");
    setNote(dimension?.note ?? "");
    setLineStyle(dimension?.lineStyle??"solid");setOpacity(dimension?.opacity??1);setTextOutline(dimension?.textOutline??true);setTextOutlineColour(dimension?.textOutlineColour??"#ffffff");
  }, [dimension]);

  useEffect(() => {
    if (!isOpen) return;
    console.log("[ForteStack] measurement edit input received selection", {
      dimensionId: dimension?.id,
      value: dimension?.value,
    });
  }, [dimension?.id, dimension?.value, isOpen]);

  function commit() {
    if (!dimension) return;
    const updated = {
      ...dimension,
      value: value.trim() || dimension.value,
      colour,
      note: note.trim() || undefined,
      lineStyle,opacity,textOutline,textOutlineColour,
    };
    console.log("[ForteStack] measurement value submitted", {
      dimensionId: updated.id,
      value: updated.value,
    });
    onUpdate(updated);
    onDismiss();
  }

  if (!dimension) return null;

  return (
    <BottomSheet
      title="Dimension"
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
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          commit();
        }}
      >
        <label>
          <span>Measurement</span>
          <input
            value={value}
            enterKeyHint="done"
            inputMode="decimal"
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <label>
          <span>Colour</span>
          <input value={colour} type="color" onChange={(event) => setColour(event.target.value)} />
        </label>
        <label><span>Line style</span><select value={lineStyle} onChange={event=>setLineStyle(event.target.value as typeof lineStyle)}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label>
        <label><span>Line transparency · {Math.round(opacity*100)}%</span><input type="range" min="0.1" max="1" step="0.05" value={opacity} onChange={event=>setOpacity(Number(event.target.value))}/></label>
        <label className="export-lock-row"><input type="checkbox" checked={textOutline} onChange={event=>setTextOutline(event.target.checked)}/><span>Text outline</span></label>
        {textOutline?<label><span>Outline colour</span><select value={textOutlineColour} onChange={event=>setTextOutlineColour(event.target.value as typeof textOutlineColour)}><option value="#ffffff">White</option><option value="#000000">Black</option></select></label>:null}
        <label>
          <span>Note</span>
          <textarea value={note} rows={3} onChange={(event) => setNote(event.target.value)} />
        </label>
      </form>
    </BottomSheet>
  );
}
