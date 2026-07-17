import { useRef } from "react";
import type { CircleAnnotation, RectangleAnnotation } from "../annotationTypes";

export type BasicShapeAnnotation = RectangleAnnotation | CircleAnnotation;
export type BasicShapeHandle = "move" | "topLeft" | "topRight" | "bottomRight" | "bottomLeft" | "radius";

type BasicShapeRendererProps = {
  shape: BasicShapeAnnotation;
  isEditable: boolean;
  isSelected: boolean;
  scale: number;
  onEdit: (shapeId: string) => void;
  onMoveEnd?: (shapeId: string, handle: BasicShapeHandle, event: React.PointerEvent<SVGElement>) => void;
  onMoveStart?: (shapeId: string, handle: BasicShapeHandle, event: React.PointerEvent<SVGElement>) => void;
  onMoveUpdate?: (shapeId: string, handle: BasicShapeHandle, event: React.PointerEvent<SVGElement>) => void;
  onSelect: (shapeId: string) => void;
};

export function BasicShapeRenderer({
  shape,
  isEditable,
  isSelected,
  onEdit,
  onMoveEnd,
  onMoveStart,
  onMoveUpdate,
  onSelect,
  scale,
}: BasicShapeRendererProps) {
  const safeScale = scale || 1;
  const handleRadius = 6 / safeScale;
  const hitRadius = 24 / safeScale;
  const longPressRef = useRef<
    | {
        startX: number;
        startY: number;
        timeoutId: number;
      }
    | undefined
  >(undefined);

  function startLongPress(event: React.PointerEvent<SVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(shape.id);

    if (isEditable) {
      event.stopPropagation();
      onMoveStart?.(shape.id, "move", event);
      return;
    }

    longPressRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      timeoutId: window.setTimeout(() => {
        window.navigator.vibrate?.(18);
        onEdit(shape.id);
        longPressRef.current = undefined;
      }, 520),
    };
  }

  function updateLongPress(event: React.PointerEvent<SVGElement>) {
    if (isEditable) {
      event.stopPropagation();
      onMoveUpdate?.(shape.id, "move", event);
      return;
    }

    const longPress = longPressRef.current;
    if (!longPress) return;
    const moved = Math.hypot(event.clientX - longPress.startX, event.clientY - longPress.startY);
    if (moved <= 10) return;
    window.clearTimeout(longPress.timeoutId);
    longPressRef.current = undefined;
  }

  function finishPointer(event: React.PointerEvent<SVGElement>) {
    if (isEditable) {
      event.stopPropagation();
      onMoveEnd?.(shape.id, "move", event);
    }
    if (!longPressRef.current) return;
    window.clearTimeout(longPressRef.current.timeoutId);
    longPressRef.current = undefined;
  }

  return shape.type === "rectangle" ? (
    <g className={`basic-shape basic-shape--rectangle ${isSelected ? "is-selected" : ""} ${isEditable ? "is-editable" : ""}`}>
      <rect
        className={`basic-shape-fill basic-shape-fill--${shape.fillStyle} ${getRectangleBorderClass(shape)}`}
        data-annotation-hit="true"
        style={shape.fillStyle === "solid" ? { fill: shape.fillColour ?? "#dbeafe" } : undefined}
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
      />
      {renderRectanglePattern(shape)}
      <rect
        className="basic-shape-hit-zone"
        data-annotation-hit="true"
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        onPointerDown={startLongPress}
        onPointerMove={updateLongPress}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onClick={(event) => event.stopPropagation()}
      />
      {isEditable ? (
        <>
          <ShapeHandle handle="topLeft" shapeId={shape.id} x={shape.x} y={shape.y} radius={handleRadius} touchRadius={hitRadius} onMoveEnd={onMoveEnd} onMoveStart={onMoveStart} onMoveUpdate={onMoveUpdate} />
          <ShapeHandle handle="topRight" shapeId={shape.id} x={shape.x + shape.width} y={shape.y} radius={handleRadius} touchRadius={hitRadius} onMoveEnd={onMoveEnd} onMoveStart={onMoveStart} onMoveUpdate={onMoveUpdate} />
          <ShapeHandle handle="bottomRight" shapeId={shape.id} x={shape.x + shape.width} y={shape.y + shape.height} radius={handleRadius} touchRadius={hitRadius} onMoveEnd={onMoveEnd} onMoveStart={onMoveStart} onMoveUpdate={onMoveUpdate} />
          <ShapeHandle handle="bottomLeft" shapeId={shape.id} x={shape.x} y={shape.y + shape.height} radius={handleRadius} touchRadius={hitRadius} onMoveEnd={onMoveEnd} onMoveStart={onMoveStart} onMoveUpdate={onMoveUpdate} />
        </>
      ) : null}
    </g>
  ) : (
    <g className={`basic-shape basic-shape--circle ${isSelected ? "is-selected" : ""} ${isEditable ? "is-editable" : ""}`}>
      <circle className="basic-shape-fill basic-shape-fill--outline" data-annotation-hit="true" cx={shape.cx} cy={shape.cy} r={shape.radius} />
      <circle
        className="basic-shape-hit-zone"
        data-annotation-hit="true"
        cx={shape.cx}
        cy={shape.cy}
        r={shape.radius}
        onPointerDown={startLongPress}
        onPointerMove={updateLongPress}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onClick={(event) => event.stopPropagation()}
      />
      {isEditable ? (
        <ShapeHandle
          handle="radius"
          shapeId={shape.id}
          x={shape.cx + shape.radius}
          y={shape.cy}
          radius={handleRadius}
          touchRadius={hitRadius}
          onMoveEnd={onMoveEnd}
          onMoveStart={onMoveStart}
          onMoveUpdate={onMoveUpdate}
        />
      ) : null}
    </g>
  );
}

function renderRectanglePattern(shape: RectangleAnnotation) {
  if (shape.fillStyle !== "diagonalCross" && shape.fillStyle !== "crossHatch") return null;
  return (
    <g className="basic-shape-pattern">
      <line x1={shape.x} y1={shape.y + shape.height} x2={shape.x + shape.width} y2={shape.y} />
      <line x1={shape.x} y1={shape.y} x2={shape.x + shape.width} y2={shape.y + shape.height} />
    </g>
  );
}

function getRectangleBorderClass(shape: RectangleAnnotation) {
  const borderStyle = shape.borderStyle ?? (shape.fillStyle === "hidden" ? "broken" : "solid");
  return borderStyle === "broken" ? "basic-shape-fill--broken-border" : "";
}

function ShapeHandle({
  handle,
  onMoveEnd,
  onMoveStart,
  onMoveUpdate,
  radius,
  shapeId,
  touchRadius,
  x,
  y,
}: {
  handle: BasicShapeHandle;
  onMoveEnd?: (shapeId: string, handle: BasicShapeHandle, event: React.PointerEvent<SVGElement>) => void;
  onMoveStart?: (shapeId: string, handle: BasicShapeHandle, event: React.PointerEvent<SVGElement>) => void;
  onMoveUpdate?: (shapeId: string, handle: BasicShapeHandle, event: React.PointerEvent<SVGElement>) => void;
  radius: number;
  shapeId: string;
  touchRadius: number;
  x: number;
  y: number;
}) {
  return (
    <g className="basic-shape-handle-group">
      <circle className="basic-shape-handle" cx={x} cy={y} r={radius} />
      <circle
        className="basic-shape-handle-hit"
        cx={x}
        cy={y}
        r={touchRadius}
        onPointerDown={(event) => {
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          onMoveStart?.(shapeId, handle, event);
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          onMoveUpdate?.(shapeId, handle, event);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          onMoveEnd?.(shapeId, handle, event);
        }}
        onPointerCancel={(event) => {
          event.stopPropagation();
          onMoveEnd?.(shapeId, handle, event);
        }}
      />
    </g>
  );
}
