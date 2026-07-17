import type { Annotation, RoomAnnotation } from "../../annotations/annotationTypes";
import { DimensionRenderer, type DimensionEditHandle } from "../../annotations/dimensions/DimensionRenderer";
import { DoorRenderer } from "../../annotations/openings/DoorRenderer";
import type { DoorEditHandle } from "../../annotations/openings/DoorRenderer";
import { NoteRenderer, type NoteEditHandle } from "../../annotations/notes/NoteRenderer";
import { ImageRenderer, type ImageEditHandle } from "../../annotations/images/ImageRenderer";
import { LineDraftRenderer, LineRenderer } from "../../annotations/lines/LineRenderer";
import { BasicShapeRenderer, type BasicShapeHandle } from "../../annotations/shapes/BasicShapeRenderer";
import { RectShapeRenderer } from "../../annotations/shapes/RectShapeRenderer";
import { normalizeRect } from "../../annotations/shapes/rectGeometry";
import type { PlaceableObjectType } from "../../annotations/objectRegistry";
import type { SelectionState } from "../../annotations/selectionModel";
import type { DimensionDraft, LineDraft, RectDraft } from "./toolTypes";
import type { ViewTransform, ViewportSize } from "./viewportTypes";

type AnnotationSvgLayerProps = {
  annotations: Annotation[];
  draft?: DimensionDraft;
  rectDraft?: RectDraft;
  lineDraft?: LineDraft;
  activeRoomEdge?: { roomId: string; wallId: string };
  editableDimensionId?: string;
  editableShapeId?: string;
  editableObjectId?: string;
  editingNoteTextId?: string;
  movableRoomId?: string;
  placingObjectType?: PlaceableObjectType;
  selection: SelectionState;
  mmPerWorldUnit: number;
  transform: ViewTransform;
  viewport: ViewportSize;
  onDebug?: (message: string) => void;
  onEditAnnotation: (annotationId: string) => void;
  onUnlockDimension?: (dimensionId: string) => void;
  onMoveDimensionPointEnd?: (dimensionId: string, handle: DimensionEditHandle, event: React.PointerEvent<SVGCircleElement>) => void;
  onMoveDimensionPointStart?: (dimensionId: string, handle: DimensionEditHandle, event: React.PointerEvent<SVGCircleElement>) => void;
  onMoveDimensionPointUpdate?: (dimensionId: string, handle: DimensionEditHandle, event: React.PointerEvent<SVGCircleElement>) => void;
  onMoveRoomEnd?: (annotationId: string, event: React.PointerEvent<SVGElement>) => void;
  onMoveRoomStart?: (annotationId: string, event: React.PointerEvent<SVGElement>) => void;
  onMoveRoomUpdate?: (annotationId: string, event: React.PointerEvent<SVGElement>) => void;
  onResizeRoomEnd?: (annotationId: string, pointId: string, event: React.PointerEvent<SVGCircleElement>) => void;
  onResizeRoomStart?: (annotationId: string, pointId: string, event: React.PointerEvent<SVGCircleElement>) => void;
  onResizeRoomUpdate?: (annotationId: string, pointId: string, event: React.PointerEvent<SVGCircleElement>) => void;
  onEditShape?: (shapeId: string) => void;
  onMoveShapeEnd?: (shapeId: string, handle: BasicShapeHandle, event: React.PointerEvent<SVGElement>) => void;
  onMoveShapeStart?: (shapeId: string, handle: BasicShapeHandle, event: React.PointerEvent<SVGElement>) => void;
  onMoveShapeUpdate?: (shapeId: string, handle: BasicShapeHandle, event: React.PointerEvent<SVGElement>) => void;
  onSelectAnnotation: (annotationId: string) => void;
  onMoveDoorStart?: (id:string,handle:DoorEditHandle,event:React.PointerEvent<SVGElement>)=>void;
  onMoveDoorUpdate?: (id:string,handle:DoorEditHandle,event:React.PointerEvent<SVGElement>)=>void;
  onMoveDoorEnd?: (id:string,handle:DoorEditHandle,event:React.PointerEvent<SVGElement>)=>void;
  onMoveNoteStart?: (id:string,handle:NoteEditHandle,event:React.PointerEvent<SVGElement>)=>void;
  onMoveNoteUpdate?: (id:string,handle:NoteEditHandle,event:React.PointerEvent<SVGElement>)=>void;
  onMoveNoteEnd?: (id:string,handle:NoteEditHandle,event:React.PointerEvent<SVGElement>)=>void;
  onNoteTextChange?: (id:string,text:string)=>void;
  onNoteTextCommit?: (id:string)=>void;
  imageUrls?: Record<string,string>;
  onMoveImageStart?: (id:string,handle:ImageEditHandle,event:React.PointerEvent<SVGElement>)=>void;
  onMoveImageUpdate?: (id:string,handle:ImageEditHandle,event:React.PointerEvent<SVGElement>)=>void;
  onMoveImageEnd?: (id:string,handle:ImageEditHandle,event:React.PointerEvent<SVGElement>)=>void;
  activeLayerId?: string;
  annotationScaleMultiplier?:number;
  exportPreview?:boolean;
  onExportMoveStart?:(id:string,event:React.PointerEvent<SVGElement>)=>void;
  onExportMoveUpdate?:(id:string,event:React.PointerEvent<SVGElement>)=>void;
  onExportMoveEnd?:(id:string,event:React.PointerEvent<SVGElement>)=>void;
  imageEditMode?:"distort"|"crop";
  onMoveLineNodeStart?:(id:string,nodeId:string,event:React.PointerEvent<SVGCircleElement>)=>void;
  onMoveLineNodeUpdate?:(id:string,nodeId:string,event:React.PointerEvent<SVGCircleElement>)=>void;
  onMoveLineNodeEnd?:(id:string,nodeId:string,event:React.PointerEvent<SVGCircleElement>)=>void;
  onEditLineLength?:(id:string,segmentId:string)=>void;
  onEditLineAngle?:(id:string,nodeId:string)=>void;
  onMoveLineMeasurementStart?:(id:string,segmentId:string,event:React.PointerEvent<SVGTextElement>)=>void;
  onMoveLineMeasurementUpdate?:(id:string,segmentId:string,event:React.PointerEvent<SVGTextElement>)=>void;
  onMoveLineMeasurementEnd?:(id:string,segmentId:string,event:React.PointerEvent<SVGTextElement>)=>void;
  selectedLineSegmentId?:string;
  onSelectLineSegment?:(id:string,segmentId:string)=>void;
};

export function AnnotationSvgLayer({
  annotations,
  draft,
  rectDraft,
  lineDraft,
  activeRoomEdge,
  editableDimensionId,
  editableShapeId,
  editableObjectId,
  editingNoteTextId,
  movableRoomId,
  placingObjectType,
  selection,
  mmPerWorldUnit,
  transform,
  viewport,
  onDebug,
  onEditAnnotation,
  onUnlockDimension,
  onMoveDimensionPointEnd,
  onMoveDimensionPointStart,
  onMoveDimensionPointUpdate,
  onMoveRoomEnd,
  onMoveRoomStart,
  onMoveRoomUpdate,
  onResizeRoomEnd,
  onResizeRoomStart,
  onResizeRoomUpdate,
  onEditShape,
  onMoveShapeEnd,
  onMoveShapeStart,
  onMoveShapeUpdate,
  onSelectAnnotation,
  onMoveDoorStart,onMoveDoorUpdate,onMoveDoorEnd,onMoveNoteStart,onMoveNoteUpdate,onMoveNoteEnd,onNoteTextChange,onNoteTextCommit,imageUrls,onMoveImageStart,onMoveImageUpdate,onMoveImageEnd,activeLayerId,annotationScaleMultiplier=1,exportPreview,onExportMoveStart,onExportMoveUpdate,onExportMoveEnd,imageEditMode,onMoveLineNodeStart,onMoveLineNodeUpdate,onMoveLineNodeEnd,onEditLineLength,onEditLineAngle,onMoveLineMeasurementStart,onMoveLineMeasurementUpdate,onMoveLineMeasurementEnd,selectedLineSegmentId,onSelectLineSegment,
}: AnnotationSvgLayerProps) {
  const rooms = annotations.filter((annotation): annotation is RoomAnnotation => annotation.type === "room");
  const activeEditId = editableDimensionId ?? editableShapeId ?? editableObjectId ?? movableRoomId;
  // Layer order remains authoritative in browse mode. During editing the active
  // object becomes a temporary interaction overlay so its handles cannot sit
  // behind another annotation.
  const sortedAnnotations = activeEditId
    ? [...annotations.filter(annotation => annotation.id !== activeEditId), ...annotations.filter(annotation => annotation.id === activeEditId)]
    : annotations;
  const displayScale=transform.scale/annotationScaleMultiplier;

  return (
    <svg
      className="annotation-svg-layer"
      width={viewport.width}
      height={viewport.height}
      viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      aria-hidden="true"
    >
      <g transform={`translate(${transform.translateX} ${transform.translateY}) scale(${transform.scale})`}>
        {sortedAnnotations.map((annotation) => (
          <g className={`${!activeLayerId || annotation.layerId===activeLayerId ? "annotation-layer-object" : "annotation-layer-object is-inactive-layer"}${activeEditId ? annotation.id===activeEditId ? " is-active-edit-object" : " is-edit-blocked-object" : ""}`} key={annotation.id}>
          {
          annotation.type === "dimension" ? (
            <DimensionRenderer
              dimension={annotation}
              isEditable={editableDimensionId === annotation.id}
              isSelected={selection.selectedAnnotationId === annotation.id}
              key={annotation.id}
              scale={displayScale}
              exportPreview={exportPreview}
              onExportMoveStart={onExportMoveStart}
              onExportMoveUpdate={onExportMoveUpdate}
              onExportMoveEnd={onExportMoveEnd}
              onDebug={onDebug}
              onMovePointEnd={onMoveDimensionPointEnd}
              onMovePointStart={onMoveDimensionPointStart}
              onMovePointUpdate={onMoveDimensionPointUpdate}
              onSelect={onSelectAnnotation}
              onUnlock={onUnlockDimension}
            />
          ) : annotation.type === "room" ? (
            <RectShapeRenderer
              rect={annotation}
              isSelected={selection.selectedAnnotationId === annotation.id}
              isMoveEnabled={movableRoomId === annotation.id}
              activeWallId={activeRoomEdge?.roomId === annotation.id ? activeRoomEdge.wallId : undefined}
              key={annotation.id}
              onEdit={onEditAnnotation}
              onMoveEnd={onMoveRoomEnd}
              onMoveStart={onMoveRoomStart}
              onMoveUpdate={onMoveRoomUpdate}
              onResizeEnd={onResizeRoomEnd}
              onResizeStart={onResizeRoomStart}
              onResizeUpdate={onResizeRoomUpdate}
              onSelect={onSelectAnnotation}
            />
          ) : annotation.type === "rectangle" || annotation.type === "circle" ? (
            <BasicShapeRenderer
              shape={annotation}
              isEditable={editableShapeId === annotation.id}
              isSelected={selection.selectedAnnotationId === annotation.id}
              key={annotation.id}
              scale={transform.scale}
              onEdit={onEditShape ?? (() => undefined)}
              onMoveEnd={onMoveShapeEnd}
              onMoveStart={onMoveShapeStart}
              onMoveUpdate={onMoveShapeUpdate}
              onSelect={onSelectAnnotation}
            />
          ) : annotation.type === "door" ? (
            <DoorRenderer
              door={annotation}
              isSelected={selection.selectedAnnotationId === annotation.id}
              key={annotation.id}
              mmPerWorldUnit={mmPerWorldUnit}
              rooms={rooms}
              scale={transform.scale}
              onSelect={onSelectAnnotation}
              isEditable={editableObjectId===annotation.id}
              onEdit={onEditAnnotation}
              onHandleStart={onMoveDoorStart}
              onHandleUpdate={onMoveDoorUpdate}
              onHandleEnd={onMoveDoorEnd}
            />
          ) : annotation.type === "note" ? (
            <NoteRenderer key={annotation.id} note={annotation} scale={displayScale} exportPreview={exportPreview} isSelected={selection.selectedAnnotationId===annotation.id} isEditable={editableObjectId===annotation.id} isTextEditing={editingNoteTextId===annotation.id} onSelect={onSelectAnnotation} onEdit={onEditAnnotation} onTextChange={onNoteTextChange} onTextCommit={onNoteTextCommit} onHandleStart={exportPreview?((id,_handle,event)=>onExportMoveStart?.(id,event)):onMoveNoteStart} onHandleUpdate={exportPreview?((id,_handle,event)=>onExportMoveUpdate?.(id,event)):onMoveNoteUpdate} onHandleEnd={exportPreview?((id,_handle,event)=>onExportMoveEnd?.(id,event)):onMoveNoteEnd}/>
          ) : annotation.type === "image" ? (
            <ImageRenderer key={annotation.id} image={annotation} url={imageUrls?.[annotation.assetId]} scale={transform.scale} isSelected={selection.selectedAnnotationId===annotation.id} isEditable={editableObjectId===annotation.id} editMode={editableObjectId===annotation.id?imageEditMode:undefined} onSelect={onSelectAnnotation} onEdit={onEditAnnotation} onStart={onMoveImageStart} onUpdate={onMoveImageUpdate} onEnd={onMoveImageEnd}/>
          ) : annotation.type === "line" ? (
            <LineRenderer key={annotation.id} line={annotation} scale={displayScale} mmPerWorldUnit={mmPerWorldUnit} isSelected={selection.selectedAnnotationId===annotation.id} isEditable={editableObjectId===annotation.id} selectedSegmentId={selection.selectedAnnotationId===annotation.id?selectedLineSegmentId:undefined} onSelect={onSelectAnnotation} onEdit={onEditAnnotation} onSelectSegment={onSelectLineSegment} onNodeStart={onMoveLineNodeStart} onNodeUpdate={onMoveLineNodeUpdate} onNodeEnd={onMoveLineNodeEnd} onEditLength={onEditLineLength} onEditAngle={onEditLineAngle} onMeasurementStart={onMoveLineMeasurementStart} onMeasurementUpdate={onMoveLineMeasurementUpdate} onMeasurementEnd={onMoveLineMeasurementEnd}/>
          ) : null}
          </g>
        ))}
        {draft && draft.step !== "idle" ? <DraftDimension draft={draft} scale={transform.scale} /> : null}
        {rectDraft && rectDraft.step === "drawing" ? <DraftObject rectDraft={rectDraft} type={placingObjectType} /> : null}
        {lineDraft?.points.length ? <LineDraftRenderer points={lineDraft.points} preview={lineDraft.preview} scale={transform.scale}/> : null}
      </g>
    </svg>
  );
}

function DraftObject({ rectDraft, type }: { rectDraft: Extract<RectDraft, { step: "drawing" }>; type?: PlaceableObjectType }) {
  const rect = normalizeRect(rectDraft.start, rectDraft.end);

  if (type === "circle") {
    return (
      <g className="basic-shape basic-shape--draft">
        <circle
          className="basic-shape-fill basic-shape-fill--outline"
          cx={rect.x + rect.width / 2}
          cy={rect.y + rect.height / 2}
          r={Math.max(1, Math.min(rect.width, rect.height) / 2)}
        />
      </g>
    );
  }

  return (
    <g className={type === "room" ? "rect-shape rect-shape--draft" : "basic-shape basic-shape--draft"}>
      <rect
        className={type === "room" ? "rect-shape-fill" : "basic-shape-fill basic-shape-fill--outline"}
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
      />
      {type === "room" ? <rect className="rect-shape-edge" x={rect.x} y={rect.y} width={rect.width} height={rect.height} /> : null}
    </g>
  );
}

function DraftDimension({ draft, scale }: { draft: DimensionDraft; scale: number }) {
  if (draft.step === "idle") return null;

  if (draft.step === "startPlaced") {
    return <circle className="dimension-draft-point" cx={draft.start.x} cy={draft.start.y} r={5/scale} />;
  }

  const dimensionLike = {
    start: draft.start,
    end: draft.end,
    offset: draft.step === "offsetPlaced" ? draft.offset : 0,
  };

  if (draft.step === "endPlaced") {
    return (
      <>
      <line
        className="dimension-draft-line"
        x1={dimensionLike.start.x}
        y1={dimensionLike.start.y}
        x2={dimensionLike.end.x}
        y2={dimensionLike.end.y}
      />
      <DraftHandles draft={draft} scale={scale} />
      </>
    );
  }

  return (
    <>
    <DimensionRenderer
      dimension={{
        id: "draft",
        drawingId: "",
        type: "dimension",
        layerId: "general",
        colour: "#f2b84b",
        value: "...",
        unit: "mm",
        start: dimensionLike.start,
        end: dimensionLike.end,
        offset: dimensionLike.offset,
        createdAt: "",
        updatedAt: "",
      }}
      isEditable={false}
      isSelected={false}
      scale={scale}
      onSelect={() => undefined}
    />
    <DraftHandles draft={draft} scale={scale} />
    </>
  );
}

function DraftHandles({ draft,scale }: { draft: Extract<DimensionDraft, { start: unknown; end: unknown }>;scale:number }) {
  return (
    <>
      <circle
        className={`dimension-draft-handle ${draft.activeHandle === "start" ? "is-active" : ""}`}
        cx={draft.start.x}
        cy={draft.start.y}
        r={6/scale}
      />
      <circle
        className={`dimension-draft-handle ${draft.activeHandle === "end" ? "is-active" : ""}`}
        cx={draft.end.x}
        cy={draft.end.y}
        r={6/scale}
      />
    </>
  );
}
