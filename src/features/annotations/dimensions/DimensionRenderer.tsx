import { useEffect, useRef } from "react";
import type { DimensionAnnotation } from "../annotationTypes";
import { getDimensionGeometry } from "./dimensionGeometry";

export type DimensionEditHandle = "start" | "end" | "offset";

type DimensionRendererProps = {
  dimension: DimensionAnnotation;
  isEditable: boolean;
  isSelected: boolean;
  scale: number;
  onDebug?: (message: string) => void;
  onMovePointEnd?: (dimensionId: string, handle: DimensionEditHandle, event: React.PointerEvent<SVGCircleElement>) => void;
  onMovePointStart?: (dimensionId: string, handle: DimensionEditHandle, event: React.PointerEvent<SVGCircleElement>) => void;
  onMovePointUpdate?: (dimensionId: string, handle: DimensionEditHandle, event: React.PointerEvent<SVGCircleElement>) => void;
  onSelect: (dimensionId: string) => void;
  onUnlock?: (dimensionId: string) => void;
  exportPreview?: boolean;
  onExportMoveStart?: (dimensionId:string,event:React.PointerEvent<SVGElement>)=>void;
  onExportMoveUpdate?: (dimensionId:string,event:React.PointerEvent<SVGElement>)=>void;
  onExportMoveEnd?: (dimensionId:string,event:React.PointerEvent<SVGElement>)=>void;
};

export function DimensionRenderer({
  dimension,
  isEditable,
  isSelected,
  scale,
  onDebug,
  onMovePointEnd,
  onMovePointStart,
  onMovePointUpdate,
  onSelect,
  onUnlock,
  exportPreview,onExportMoveStart,onExportMoveUpdate,onExportMoveEnd,
}: DimensionRendererProps) {
  const geometry = getDimensionGeometry(dimension);
  const debugRef = useRef(onDebug);
  const longPressRef = useRef<
    | {
        startedAt: number;
        startX: number;
        startY: number;
        timeoutId: number;
      }
    | undefined
  >(undefined);
  const label = `${dimension.value}${dimension.unit}`;
  const safeScale = scale || 1;
  const tickSize = 12 / safeScale;
  const fontSize = 15 / safeScale;
  const labelWidth = Math.max(42, label.length * 8.2 + 16) / safeScale;
  const labelHeight = 24 / safeScale;
  const endpointHandleRadius = (isEditable ? 7 : 5) / safeScale;
  const endpointHitRadius = 24 / safeScale;
  const labelHandleRadius = 5 / safeScale;
  const offsetHandleClearance = 30 / safeScale;
  const strokeWidth=2/safeScale,opacity=dimension.opacity??1,lineStyle=dimension.lineStyle??"solid",dasharray=lineStyle==="dashed"?`${8/safeScale} ${6/safeScale}`:lineStyle==="dotted"?`${1.5/safeScale} ${5/safeScale}`:undefined;
  const lineLength = Math.hypot(
    geometry.dimensionEnd.x - geometry.dimensionStart.x,
    geometry.dimensionEnd.y - geometry.dimensionStart.y,
  );
  const shortLine = lineLength * safeScale < labelWidth * safeScale + 14;
  const labelPoint = shortLine
    ? {
        x: geometry.label.x + geometry.normal.x * (18 / safeScale),
        y: geometry.label.y + geometry.normal.y * (18 / safeScale),
      }
    : geometry.label;
  const offsetHandleSign = dimension.offset < 0 ? -1 : 1;
  const offsetHandlePoint = {
    x: labelPoint.x + geometry.normal.x * offsetHandleSign * offsetHandleClearance,
    y: labelPoint.y + geometry.normal.y * offsetHandleSign * offsetHandleClearance,
  };

  useEffect(() => {
    debugRef.current = onDebug;
  }, [onDebug]);

  useEffect(() => {
    return () => {
      const longPress = longPressRef.current;
      if (!longPress) return;
      const elapsed = Math.round(performance.now() - longPress.startedAt);
      debugRef.current?.(
        `timer cleared on renderer cleanup id=${longPress.timeoutId} dim=${dimension.id.slice(
          -5,
        )} elapsed=${elapsed}ms dimension changed or component unmounted`,
      );
      window.clearTimeout(longPress.timeoutId);
      longPressRef.current = undefined;
    };
  }, [dimension.id]);

  const startLongPress = (event: React.PointerEvent<SVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const startedAt = performance.now();
    debugRef.current?.(`dimension pointer down ${dimension.id.slice(-5)} event=${event.type} elapsed=0ms`);
    debugRef.current?.(`dimension hit-zone reached ${dimension.id.slice(-5)} event=${event.type} elapsed=0ms`);
    console.log("[ForteStack] measurement hit detected", { dimensionId: dimension.id });
    const timeoutId = window.setTimeout(() => {
      const elapsed = Math.round(performance.now() - startedAt);
      window.navigator.vibrate?.(18);
      debugRef.current?.(`long-press timer completed id=${timeoutId} dim=${dimension.id.slice(-5)} elapsed=${elapsed}ms`);
      console.log("[ForteStack] measurement long press unlock requested", { dimensionId: dimension.id });
      debugRef.current?.(`onUnlock called ${dimension.id.slice(-5)} id=${timeoutId} elapsed=${elapsed}ms`);
      if(exportPreview)onExportMoveStart?.(dimension.id,event);else onUnlock?.(dimension.id);
      longPressRef.current = undefined;
    }, 500);
    debugRef.current?.(`long-press timer started id=${timeoutId} dim=${dimension.id.slice(-5)} event=${event.type} elapsed=0ms`);
    longPressRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startedAt,
      timeoutId,
    };
  };
  const updateLongPress = (event: React.PointerEvent<SVGElement>) => {
    if(exportPreview&&!longPressRef.current){event.preventDefault();event.stopPropagation();onExportMoveUpdate?.(dimension.id,event);return}
    const longPress = longPressRef.current;
    if (!longPress) return;
    const moved = Math.hypot(event.clientX - longPress.startX, event.clientY - longPress.startY);
    if (moved <= 12) return;
    const elapsed = Math.round(performance.now() - longPress.startedAt);
    debugRef.current?.(
      `timer cancelled id=${longPress.timeoutId} dim=${dimension.id.slice(-5)} event=${event.type} moved=${Math.round(
        moved,
      )}px elapsed=${elapsed}ms`,
    );
    window.clearTimeout(longPress.timeoutId);
    longPressRef.current = undefined;
  };
  const cancelLongPress = (event: React.PointerEvent<SVGElement>) => {
    if(exportPreview&&!longPressRef.current){event.stopPropagation();onExportMoveEnd?.(dimension.id,event);return}
    if (!longPressRef.current) return;
    const elapsed = Math.round(performance.now() - longPressRef.current.startedAt);
    debugRef.current?.(
      `timer cancelled id=${longPressRef.current.timeoutId} dim=${dimension.id.slice(-5)} event=${event.type} elapsed=${elapsed}ms`,
    );
    window.clearTimeout(longPressRef.current.timeoutId);
    longPressRef.current = undefined;
  };

  return (
    <g className={`dimension-annotation ${isSelected ? "is-selected" : ""} ${isEditable ? "is-editable" : ""}`}>
      <line
        className="dimension-hit-zone"
        data-annotation-hit="true"
        x1={geometry.dimensionStart.x}
        y1={geometry.dimensionStart.y}
        x2={geometry.dimensionEnd.x}
        y2={geometry.dimensionEnd.y}
        onPointerDown={startLongPress}
        onPointerMove={updateLongPress}
        onPointerCancel={cancelLongPress}
        onPointerUp={cancelLongPress}
        onClick={(event) => event.stopPropagation()}
      />
      <line
        className="dimension-extension-line"
        x1={dimension.start.x}
        y1={dimension.start.y}
        x2={geometry.dimensionStart.x}
        y2={geometry.dimensionStart.y}
        style={{stroke:dimension.colour,strokeWidth,strokeDasharray:dasharray,opacity,vectorEffect:"none"}}
      />
      <line
        className="dimension-extension-line"
        x1={dimension.end.x}
        y1={dimension.end.y}
        x2={geometry.dimensionEnd.x}
        y2={geometry.dimensionEnd.y}
        style={{stroke:dimension.colour,strokeWidth,strokeDasharray:dasharray,opacity,vectorEffect:"none"}}
      />
      <line
        className="dimension-line"
        x1={geometry.dimensionStart.x}
        y1={geometry.dimensionStart.y}
        x2={geometry.dimensionEnd.x}
        y2={geometry.dimensionEnd.y}
        style={{stroke:dimension.colour,strokeWidth,strokeDasharray:dasharray,opacity,vectorEffect:"none"}}
      />
      <DimensionTick x={geometry.dimensionStart.x} y={geometry.dimensionStart.y} size={tickSize} colour={dimension.colour} opacity={opacity} strokeWidth={2.2/safeScale}/>
      <DimensionTick x={geometry.dimensionEnd.x} y={geometry.dimensionEnd.y} size={tickSize} colour={dimension.colour} opacity={opacity} strokeWidth={2.2/safeScale}/>
      <rect
        className="dimension-label-background"
        x={labelPoint.x - labelWidth / 2}
        y={labelPoint.y - labelHeight / 2}
        width={labelWidth}
        height={labelHeight}
        rx={6 / safeScale}
      />
      <text className="dimension-label" x={labelPoint.x} y={labelPoint.y} style={{fontSize,fill:dimension.colour,opacity,paintOrder:dimension.textOutline===false?undefined:"stroke",stroke:dimension.textOutline===false?"none":dimension.textOutlineColour??"#ffffff",strokeWidth:dimension.textOutline===false?0:3/safeScale,strokeLinejoin:"round",vectorEffect:"none"}}>
        {label}
      </text>
      <rect
        className="dimension-label-hit-zone"
        data-annotation-hit="true"
        x={labelPoint.x - labelWidth / 2}
        y={labelPoint.y - labelHeight / 2}
        width={labelWidth}
        height={labelHeight}
        rx={8 / safeScale}
        onPointerDown={startLongPress}
        onPointerMove={updateLongPress}
        onPointerCancel={cancelLongPress}
        onPointerUp={cancelLongPress}
        onClick={(event) => event.stopPropagation()}
      />
      {isEditable ? (
        <>
          <DimensionHandle
            dimensionId={dimension.id}
            handle="start"
            isEditable={isEditable}
            radius={endpointHandleRadius}
            touchRadius={endpointHitRadius}
            x={dimension.start.x}
            y={dimension.start.y}
            onMoveEnd={onMovePointEnd}
            onMoveStart={onMovePointStart}
            onMoveUpdate={onMovePointUpdate}
          />
          <DimensionHandle
            dimensionId={dimension.id}
            handle="end"
            isEditable={isEditable}
            radius={endpointHandleRadius}
            touchRadius={endpointHitRadius}
            x={dimension.end.x}
            y={dimension.end.y}
            onMoveEnd={onMovePointEnd}
            onMoveStart={onMovePointStart}
            onMoveUpdate={onMovePointUpdate}
          />
          <DimensionHandle
            dimensionId={dimension.id}
            handle="offset"
            isEditable={isEditable}
            radius={labelHandleRadius}
            touchRadius={endpointHitRadius}
            x={offsetHandlePoint.x}
            y={offsetHandlePoint.y}
            onMoveEnd={onMovePointEnd}
            onMoveStart={onMovePointStart}
            onMoveUpdate={onMovePointUpdate}
          />
        </>
      ) : null}
    </g>
  );
}

function DimensionHandle({
  dimensionId,
  handle,
  isEditable,
  onMoveEnd,
  onMoveStart,
  onMoveUpdate,
  radius,
  touchRadius,
  x,
  y,
}: {
  dimensionId: string;
  handle: DimensionEditHandle;
  isEditable: boolean;
  onMoveEnd?: (dimensionId: string, handle: DimensionEditHandle, event: React.PointerEvent<SVGCircleElement>) => void;
  onMoveStart?: (dimensionId: string, handle: DimensionEditHandle, event: React.PointerEvent<SVGCircleElement>) => void;
  onMoveUpdate?: (dimensionId: string, handle: DimensionEditHandle, event: React.PointerEvent<SVGCircleElement>) => void;
  radius: number;
  touchRadius: number;
  x: number;
  y: number;
}) {
  return (
    <g className="dimension-handle-group">
      <circle className="dimension-handle" cx={x} cy={y} r={radius} />
      {isEditable ? (
        <circle
          className="dimension-handle-hit"
          cx={x}
          cy={y}
          r={touchRadius}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            onMoveStart?.(dimensionId, handle, event);
          }}
          onPointerMove={(event) => {
            event.stopPropagation();
            onMoveUpdate?.(dimensionId, handle, event);
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            onMoveEnd?.(dimensionId, handle, event);
          }}
          onPointerCancel={(event) => {
            event.stopPropagation();
            onMoveEnd?.(dimensionId, handle, event);
          }}
        />
      ) : null}
    </g>
  );
}

function DimensionTick({ x, y, size,colour,opacity,strokeWidth }: { x: number; y: number; size: number;colour:string;opacity:number;strokeWidth:number }) {
  return (
    <line
      className="dimension-tick"
      x1={x - size / 2}
      y1={y + size / 2}
      x2={x + size / 2}
      y2={y - size / 2}
      style={{stroke:colour,opacity,strokeWidth,vectorEffect:"none"}}
    />
  );
}
