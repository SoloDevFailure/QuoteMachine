import { BottomSheet } from "../../../components/BottomSheet";
import type { SnapSettings } from "../drawingTypes";

type SnapSettingsSheetProps = {
  isOpen: boolean;
  settings: SnapSettings;
  onDismiss: () => void;
  onChange: (settings: SnapSettings) => void;
};

export function SnapSettingsSheet({
  isOpen,
  settings,
  onDismiss,
  onChange,
}: SnapSettingsSheetProps) {
  return (
    <BottomSheet title="Snap" isOpen={isOpen} onDismiss={onDismiss}>
      <div className="toggle-list">
        <SnapToggle
          label="Snap to reference points"
          checked={settings.snapToReferencePoints}
          onChange={(checked) => onChange({ ...settings, snapToReferencePoints: checked })}
        />
        <SnapToggle
          label="Snap to existing points"
          checked={settings.snapToExistingPoints}
          onChange={(checked) => onChange({ ...settings, snapToExistingPoints: checked })}
        />
        <SnapToggle
          label="Snap to grid"
          checked={settings.snapToGrid}
          onChange={(checked) => onChange({ ...settings, snapToGrid: checked })}
        />
      </div>
    </BottomSheet>
  );
}

function SnapToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
