import { Magnet, Plus, Ruler, Settings } from "lucide-react";
import type { ToolMode } from "./toolTypes";

type WorkspaceToolbarProps = {
  activeTool: ToolMode;
  isAddPickerOpen: boolean;
  onAddClick: () => void;
  onToolChange: (tool: ToolMode) => void;
  onOpenDrawingSettings: () => void;
  onOpenSnapSettings: () => void;
};

export function WorkspaceToolbar({
  activeTool,
  isAddPickerOpen,
  onAddClick,
  onToolChange,
  onOpenDrawingSettings,
  onOpenSnapSettings,
}: WorkspaceToolbarProps) {
  return (
    <div className="workspace-toolbar" aria-label="Workspace tools">
      <button
        className={activeTool === "placingObject" || isAddPickerOpen ? "is-active" : ""}
        type="button"
        onClick={onAddClick}
      >
        <Plus size={18} />
        <span>Add</span>
      </button>
      <button
        className={activeTool === "dimension" ? "is-active" : ""}
        type="button"
        onClick={() => onToolChange("dimension")}
      >
        <Ruler size={18} />
        <span>Dim</span>
      </button>
      <button className="workspace-icon-action" type="button" onClick={onOpenSnapSettings} aria-label="Snap settings">
        <Magnet size={18} />
      </button>
      <button className="workspace-icon-action" type="button" onClick={onOpenDrawingSettings} aria-label="Drawing settings">
        <Settings size={18} />
      </button>
    </div>
  );
}
