import { useRef } from "react";
import type { RoomAnnotation } from "../annotationTypes";
import { getRoomBounds, getRoomCenter, getRoomPath, getRoomWalls, getVisibleWallSegments } from "./rectGeometry";

type RectShapeRendererProps = {
  rect: RoomAnnotation;
  isSelected: boolean;
  isMoveEnabled?: boolean;
  activeWallId?: string;
  onEdit: (annotationId: string) => void;
  onMoveEnd?: (annotationId: string, event: React.PointerEvent<SVGElement>) => void;
  onMoveStart?: (annotationId: string, event: React.PointerEvent<SVGElement>) => void;
  onMoveUpdate?: (annotationId: string, event: React.PointerEvent<SVGElement>) => void;
  onResizeEnd?: (annotationId: string, pointId: string, event: React.PointerEvent<SVGCircleElement>) => void;
  onResizeStart?: (annotationId: string, pointId: string, event: React.PointerEvent<SVGCircleElement>) => void;
  onResizeUpdate?: (annotationId: string, pointId: string, event: React.PointerEvent<SVGCircleElement>) => void;
  onSelect: (annotationId: string) => void;
};

export function RectShapeRenderer({
  rect,
  isSelected,
  isMoveEnabled,
  activeWallId,
  onEdit,
  onMoveEnd,
  onMoveStart,
  onMoveUpdate,
  onResizeEnd,
  onResizeStart,
  onResizeUpdate,
  onSelect,
}: RectShapeRendererProps) {
  const bounds = getRoomBounds(rect);
  const center = getRoomCenter(rect);
  const walls = getRoomWalls(rect);
  const longPressRef = useRef<
    | {
        timeoutId: number;
        pointerId: number;
        startX: number;
        startY: number;
      }
    | undefined
  >(undefined);
  const unlockedPointerRef = useRef<
    | {
        hasStartedMove: boolean;
        pointerId: number;
      }
    | undefined
  >(undefined);

  function cancelLongPress() {
    if (!longPressRef.current) return;
    window.clearTimeout(longPressRef.current.timeoutId);
    longPressRef.current = undefined;
  }

  return (
    <g className={`rect-shape ${isSelected ? "is-selected" : ""} ${isMoveEnabled ? "is-editable" : ""}`}>
      <rect
        className="rect-shape-hit-zone"
        data-annotation-hit="true"
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          onSelect(rect.id);
          if (isMoveEnabled) {
            event.stopPropagation();
            onMoveStart?.(rect.id, event);
            return;
          }
          longPressRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            timeoutId: window.setTimeout(() => {
              onEdit(rect.id);
              unlockedPointerRef.current = {
                hasStartedMove: false,
                pointerId: event.pointerId,
              };
              longPressRef.current = undefined;
            }, 520),
          };
        }}
        onPointerMove={(event) => {
          const longPress = longPressRef.current;
          const unlocked = unlockedPointerRef.current;
          if (unlocked && unlocked.pointerId === event.pointerId) {
            event.stopPropagation();
            if (!unlocked.hasStartedMove) {
              unlockedPointerRef.current = { ...unlocked, hasStartedMove: true };
              onMoveStart?.(rect.id, event);
            }
            onMoveUpdate?.(rect.id, event);
            return;
          }
          if (isMoveEnabled) {
            event.stopPropagation();
            onMoveUpdate?.(rect.id, event);
            return;
          }
          if (!longPress || longPress.pointerId !== event.pointerId) return;
          const moved = Math.hypot(event.clientX - longPress.startX, event.clientY - longPress.startY);
          if (moved > 10) cancelLongPress();
        }}
        onPointerCancel={(event) => {
          cancelLongPress();
          if (unlockedPointerRef.current?.pointerId === event.pointerId) {
            unlockedPointerRef.current = undefined;
          }
        }}
        onPointerUp={(event) => {
          const unlocked = unlockedPointerRef.current;
          if (unlocked && unlocked.pointerId === event.pointerId) {
            event.stopPropagation();
            if (unlocked.hasStartedMove) onMoveEnd?.(rect.id, event);
            unlockedPointerRef.current = undefined;
            return;
          }
          if (isMoveEnabled) {
            event.stopPropagation();
            onMoveEnd?.(rect.id, event);
            return;
          }
          if (longPressRef.current?.pointerId === event.pointerId) cancelLongPress();
        }}
        onClick={(event) => event.stopPropagation()}
      />
      <path className="rect-shape-fill" d={getRoomPath(rect)} style={{ fill: rect.fillColour ?? "#ffffff" }} />
      {walls.flatMap(({ wall, start, end }) =>
        getVisibleWallSegments({ start, end, hiddenSegments: wall.joinedSegments }).map((segment, index) => (
          <line
            className={`rect-shape-edge ${wall.visible ? "" : "rect-shape-edge--joined"} ${wall.id === activeWallId ? "is-active-edge" : ""}`}
            key={`${wall.id}-${index}`}
            x1={segment.start.x}
            y1={segment.start.y}
            x2={segment.end.x}
            y2={segment.end.y}
          />
        )),
      )}
      {rect.label ? (
        <text className="rect-shape-label" x={center.x} y={center.y}>
          {rect.label}
        </text>
      ) : null}
      {isMoveEnabled ? (
        <>
          <circle
            className="rect-shape-center-handle"
            cx={center.x}
            cy={center.y}
            r={7}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              onMoveStart?.(rect.id, event);
            }}
            onPointerMove={(event) => {
              event.stopPropagation();
              onMoveUpdate?.(rect.id, event);
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
              onMoveEnd?.(rect.id, event);
            }}
            onPointerCancel={(event) => {
              event.stopPropagation();
              onMoveEnd?.(rect.id, event);
            }}
          />
          {rect.points.map((point) => (
            <circle
              className="rect-shape-corner"
              cx={point.x}
              cy={point.y}
              key={point.id}
              r={6}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                onResizeStart?.(rect.id, point.id, event);
              }}
              onPointerMove={(event) => {
                event.stopPropagation();
                onResizeUpdate?.(rect.id, point.id, event);
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
                onResizeEnd?.(rect.id, point.id, event);
              }}
              onPointerCancel={(event) => {
                event.stopPropagation();
                onResizeEnd?.(rect.id, point.id, event);
              }}
            />
          ))}
        </>
      ) : null}
    </g>
  );
}
