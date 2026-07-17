import { useRef } from "react";
import type { DoorAnnotation, RoomAnnotation } from "../annotationTypes";
import { getDoorGeometry } from "./doorGeometry";

type DoorRendererProps = {
  door: DoorAnnotation;
  isSelected: boolean;
  mmPerWorldUnit: number;
  rooms: RoomAnnotation[];
  scale: number;
  onSelect: (annotationId: string) => void;
  isEditable?: boolean;
  onEdit?: (annotationId: string) => void;
  onHandleStart?: (annotationId: string, handle: DoorEditHandle, event: React.PointerEvent<SVGElement>) => void;
  onHandleUpdate?: (annotationId: string, handle: DoorEditHandle, event: React.PointerEvent<SVGElement>) => void;
  onHandleEnd?: (annotationId: string, handle: DoorEditHandle, event: React.PointerEvent<SVGElement>) => void;
};

export type DoorEditHandle = "move" | "rotate" | "flipHinge" | "flipSwing";

export function DoorRenderer({ door, isSelected, isEditable, mmPerWorldUnit, scale, onSelect, onEdit, onHandleStart, onHandleUpdate, onHandleEnd }: DoorRendererProps) {
  const holdTimer = useRef<number | undefined>(undefined);
  const holdStart = useRef<{ x: number; y: number } | undefined>(undefined);
  const geometry = getDoorGeometry({ door, mmPerWorldUnit });

  const safeScale = scale || 1;
  const jambSize = 8 / safeScale;
  const arcRadius = geometry.widthWorld;
  const closedLeafEnd = door.hingeSide === "start" ? geometry.end : geometry.start;
  const sweepFlag = door.swingDirection * (door.hingeSide === "start" ? 1 : -1) > 0 ? 1 : 0;
  const largeArcFlag = door.openingAngle > 180 ? 1 : 0;
  const arcPath = `M ${closedLeafEnd.x} ${closedLeafEnd.y} A ${arcRadius} ${arcRadius} 0 ${largeArcFlag} ${sweepFlag} ${geometry.leafEnd.x} ${geometry.leafEnd.y}`;

  function stopDoorGesture(event: React.PointerEvent<SVGElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function cancelHold() {
    if (holdTimer.current !== undefined) window.clearTimeout(holdTimer.current);
    holdTimer.current = undefined;
    holdStart.current = undefined;
  }

  return (
    <g className={`door-object ${isSelected ? "is-selected" : ""}`}>
      <line className="door-wall-cutout" x1={geometry.start.x} y1={geometry.start.y} x2={geometry.end.x} y2={geometry.end.y} />
      <line className="door-jamb" x1={geometry.start.x} y1={geometry.start.y} x2={geometry.start.x - geometry.normal.x * jambSize} y2={geometry.start.y - geometry.normal.y * jambSize} />
      <line className="door-jamb" x1={geometry.end.x} y1={geometry.end.y} x2={geometry.end.x - geometry.normal.x * jambSize} y2={geometry.end.y - geometry.normal.y * jambSize} />
      {door.kind === "cavity" ? (
        <>
          <line className="door-cavity-line" x1={geometry.pocketStart.x} y1={geometry.pocketStart.y} x2={geometry.pocketEnd.x} y2={geometry.pocketEnd.y} />
          <line className="door-cavity-panel" x1={geometry.start.x} y1={geometry.start.y} x2={geometry.end.x} y2={geometry.end.y} />
        </>
      ) : (
        <>
          <line className="door-leaf" x1={geometry.hinge.x} y1={geometry.hinge.y} x2={geometry.leafEnd.x} y2={geometry.leafEnd.y} />
          <path className="door-swing-arc" d={arcPath} />
        </>
      )}
      <line
        className="door-hit-zone"
        data-annotation-hit="true"
        x1={geometry.start.x}
        y1={geometry.start.y}
        x2={geometry.end.x}
        y2={geometry.end.y}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          onSelect(door.id);
          if (!isEditable) {
            cancelHold();
            holdStart.current = { x: event.clientX, y: event.clientY };
            holdTimer.current = window.setTimeout(() => onEdit?.(door.id), 500);
          }
        }}
        onPointerMove={(event) => {
          const start = holdStart.current;
          if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) cancelHold();
        }}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onClick={(event) => event.stopPropagation()}
      />
      {isSelected && isEditable ? <>
        <g className="edit-handle-group"><circle className="object-edit-handle object-edit-handle--door-move" cx={geometry.center.x} cy={geometry.center.y} r={8/safeScale}/><circle
          className="edit-handle-hit" data-annotation-hit="true" cx={geometry.center.x} cy={geometry.center.y} r={24/safeScale}
          onPointerDown={(event) => {
            stopDoorGesture(event);
            event.currentTarget.setPointerCapture(event.pointerId);
            onHandleStart?.(door.id, "move", event);
          }}
          onPointerMove={(event) => {
            stopDoorGesture(event);
            onHandleUpdate?.(door.id, "move", event);
          }}
          onPointerUp={(event) => {
            stopDoorGesture(event);
            onHandleEnd?.(door.id, "move", event);
          }}
          onPointerCancel={(event)=>onHandleEnd?.(door.id,"move",event)}
        /></g>
      </> : null}
    </g>
  );
}
