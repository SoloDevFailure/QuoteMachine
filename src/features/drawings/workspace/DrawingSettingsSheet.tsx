import { RotateCcw } from "lucide-react";
import { BottomSheet } from "../../../components/BottomSheet";
import type { Drawing } from "../drawingTypes";

type DrawingSettingsSheetProps = {
  drawing: Drawing;
  isOpen: boolean;
  onDismiss: () => void;
  onResetScale: () => void;
};

export function DrawingSettingsSheet({
  drawing,
  isOpen,
  onDismiss,
  onResetScale,
}: DrawingSettingsSheetProps) {
  const scale = drawing.scale;

  return (
    <BottomSheet title="Drawing settings" isOpen={isOpen} onDismiss={onDismiss}>
      <div className="drawing-settings">
        <section className="settings-panel">
          <span>Scale</span>
          {scale ? (
            <>
              <strong>{formatScale(scale.mmPerWorldUnit)}</strong>
              <small>
                Calibrated from {scale.calibratedFrom?.type ?? "reference"} ·{" "}
                {formatDate(scale.calibratedAt)}
              </small>
            </>
          ) : (
            <>
              <strong>Not calibrated yet</strong>
              <small>Enter the first known room size or measurement to set scale automatically.</small>
            </>
          )}
        </section>

        <button className="danger-button" type="button" disabled={!scale} onClick={onResetScale}>
          <RotateCcw size={18} />
          Reset scale
        </button>
      </div>
    </BottomSheet>
  );
}

function formatScale(mmPerWorldUnit: number) {
  if (!Number.isFinite(mmPerWorldUnit) || mmPerWorldUnit <= 0) return "Invalid scale";
  return `1 world unit = ${formatNumber(mmPerWorldUnit)} mm`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 3,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}
