import { useEffect, useState } from "react";
import { BottomSheet } from "../../../components/BottomSheet";
import type { RectangleAnnotation, ShapeBorderStyle, ShapeFillStyle } from "../annotationTypes";

type RectangleEditorSheetProps = {
  rectangle?: RectangleAnnotation;
  isOpen: boolean;
  onDismiss: () => void;
  onUpdate: (rectangle: RectangleAnnotation) => void;
};

const fillOptions: Array<{ label: string; value: ShapeFillStyle }> = [
  { label: "None", value: "outline" },
  { label: "Solid", value: "solid" },
  { label: "Diagonal cross", value: "diagonalCross" },
  { label: "Cross hatch", value: "crossHatch" },
];

const colourOptions = ["#dbeafe", "#dcfce7", "#fef3c7", "#fee2e2", "#e5e7eb"];

export function RectangleEditorSheet({ rectangle, isOpen, onDismiss, onUpdate }: RectangleEditorSheetProps) {
  const [borderStyle, setBorderStyle] = useState<ShapeBorderStyle>("solid");
  const [fillStyle, setFillStyle] = useState<ShapeFillStyle>("outline");
  const [fillColour, setFillColour] = useState("#dbeafe");

  useEffect(() => {
    setBorderStyle(rectangle?.borderStyle ?? (rectangle?.fillStyle === "hidden" ? "broken" : "solid"));
    setFillStyle(rectangle?.fillStyle === "hidden" ? "outline" : rectangle?.fillStyle ?? "outline");
    setFillColour(rectangle?.fillColour ?? "#dbeafe");
  }, [rectangle]);

  function commit() {
    if (!rectangle) return;
    onUpdate({
      ...rectangle,
      borderStyle,
      fillStyle,
      fillColour,
      updatedAt: new Date().toISOString(),
    });
    onDismiss();
  }

  if (!rectangle) return null;

  return (
    <BottomSheet
      title="Rectangle"
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
      <div className="rectangle-editor">
        <section>
          <span className="field-label">Border</span>
          <div className="segmented-control" role="group" aria-label="Rectangle border">
            <button className={borderStyle === "solid" ? "is-active" : ""} type="button" onClick={() => setBorderStyle("solid")}>
              Solid
            </button>
            <button className={borderStyle === "broken" ? "is-active" : ""} type="button" onClick={() => setBorderStyle("broken")}>
              Broken
            </button>
          </div>
        </section>

        <section>
          <span className="field-label">Fill</span>
          <div className="rectangle-fill-grid">
            {fillOptions.map((option) => (
              <button
                className={fillStyle === option.value ? "is-active" : ""}
                key={option.value}
                type="button"
                onClick={() => setFillStyle(option.value)}
              >
                <span className={`rectangle-fill-swatch rectangle-fill-swatch--${option.value}`} style={{ backgroundColor: option.value === "solid" ? fillColour : undefined }} />
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <span className="field-label">Solid colour</span>
          <div className="colour-swatch-row">
            {colourOptions.map((colour) => (
              <button
                aria-label={`Use ${colour}`}
                className={fillColour === colour ? "is-active" : ""}
                key={colour}
                style={{ backgroundColor: colour }}
                type="button"
                onClick={() => setFillColour(colour)}
              />
            ))}
          </div>
        </section>
      </div>
    </BottomSheet>
  );
}
