import { LayoutTemplate } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { createDrawing } from "./drawingStore";
import type { Drawing } from "./drawingTypes";

type CreateDrawingSheetProps = {
  projectId: string;
  isOpen: boolean;
  onDismiss: () => void;
  onCreated: (drawing: Drawing) => void;
};

export function CreateDrawingSheet({
  projectId,
  isOpen,
  onDismiss,
  onCreated,
}: CreateDrawingSheetProps) {
  const [isCreating, setIsCreating] = useState(false);

  async function handleBlankDrawing() {
    setIsCreating(true);
    const drawing = await createDrawing(projectId, {
      name: "Untitled drawing",
      backgroundType: "blank",
    });
    setIsCreating(false);
    onCreated(drawing);
    onDismiss();
  }

  return (
    <BottomSheet title="New drawing" isOpen={isOpen} placement="center" onDismiss={onDismiss}>
      <div className="action-list">
        <button className="action-row" type="button" disabled={isCreating} onClick={handleBlankDrawing}>
          <span className="action-row__icon">
            <LayoutTemplate size={22} />
          </span>
          <span>
            <strong>New drawing</strong>
            <small>Start an infinite workspace, then add images and objects to layers.</small>
          </span>
        </button>
      </div>
    </BottomSheet>
  );
}
