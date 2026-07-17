import { ArrowLeft, Bug, Check, Crop, Download, DraftingCompass, FlipHorizontal2, GitFork, Grid3X3, ImagePlus, Minus, Plus, RotateCcw, RotateCw, RefreshCcw, Ruler, Scissors, Trash2, Type, X } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BottomSheet } from "../../../components/BottomSheet";
import { IconButton } from "../../../components/IconButton";
import type { Annotation, CircleAnnotation, DimensionAnnotation, DoorAnnotation, ImageAnnotation, LineAnnotation, NoteAnnotation, RectangleAnnotation, ReferencePoint, RoomAnnotation } from "../../annotations/annotationTypes";
import {
  createDimensionAnnotation,
  createDoorAnnotation,
  createImageAnnotation,
  createLineAnnotation,
  createRoomAnnotation,
  createReferencePoint,
  deleteAnnotation,
  getDrawingAnnotations,
  getReferencePoints,
  saveAnnotation,
  saveReferencePoint,
} from "../../annotations/annotationStore";
import { drawingObjectDefinitions, type PlaceableObjectType } from "../../annotations/objectRegistry";
import { DimensionEditorSheet } from "../../annotations/dimensions/DimensionEditorSheet";
import { DoorEditorSheet } from "../../annotations/openings/DoorEditorSheet";
import { getNearestWallPlacement } from "../../annotations/openings/doorGeometry";
import type { DoorEditHandle } from "../../annotations/openings/DoorRenderer";
import type { NoteEditHandle } from "../../annotations/notes/NoteRenderer";
import type { ImageEditHandle } from "../../annotations/images/ImageRenderer";
import { getImageCorners } from "../../annotations/images/ImageRenderer";
import { breakLineAtNode, cornerAngle, segmentLength, setCornerAngle, setSegmentLength } from "../../annotations/lines/lineGeometry";
import type { DimensionEditHandle } from "../../annotations/dimensions/DimensionRenderer";
import { getDimensionOffset } from "../../annotations/dimensions/dimensionGeometry";
import { DimensionValueSheet } from "../../annotations/dimensions/DimensionValueSheet";
import type { BasicShapeHandle } from "../../annotations/shapes/BasicShapeRenderer";
import { RectShapeEditorSheet } from "../../annotations/shapes/RectShapeEditorSheet";
import { RectShapeValueSheet } from "../../annotations/shapes/RectShapeValueSheet";
import { RectangleEditorSheet } from "../../annotations/shapes/RectangleEditorSheet";
import {
  getClosestPointOnRectEdge,
  getCalibratedRoomRect,
  getNearestRoomWall,
  getRectCenter,
  getRectCorners,
  getRectMidpoints,
  getRoomBounds,
  getRoomCorners,
  normalizeRect,
  clearRoomJoinsForRoom,
  hasRoomJoinOpportunity,
  refreshRoomJoinsForRoom,
  resizeRoomToDimensions,
  translateRoom,
} from "../../annotations/shapes/rectGeometry";
import type { SelectionState } from "../../annotations/selectionModel";
import { getActiveConstructionGridSize, getMeasurementSnapIncrementMm, snapPoint, type SnapResult } from "../../annotations/snapping";
import type { Asset } from "../../assets/assetTypes";
import { createImageAsset } from "../../assets/imageImport";
import { getAsset, saveAsset } from "../../assets/assetStore";
import type { Project } from "../../projects/projectTypes";
import type { Drawing, DrawingScale } from "../drawingTypes";
import { clearDrawingScale, getDefaultSnapSettings, renameDrawing, updateDrawingLayers, updateDrawingScale, updateDrawingSnapSettings } from "../drawingStore";
import { AnnotationSvgLayer } from "./AnnotationSvgLayer";
import { AddObjectPicker } from "./AddObjectPicker";
import { BackgroundLayer } from "./BackgroundLayer";
import { DrawingSettingsSheet } from "./DrawingSettingsSheet";
import { SnapSettingsSheet } from "./SnapSettingsSheet";
import type { DimensionDraft, LineDraft, RectDraft, ToolMode } from "./toolTypes";
import { usePanZoom } from "./usePanZoom";
import {
  createBlankInitialTransform,
  createPhotoFitTransform,
  screenToWorld,
} from "./viewportMath";
import type { Point, ViewportSize, ViewTransform } from "./viewportTypes";
import { WorkspaceGrid } from "./WorkspaceGrid";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import { LayerMenu } from "./LayerMenu";

type DrawingWorkspaceProps = {
  project: Project;
  drawing: Drawing;
  asset?: Asset;
  assetUrl?: string;
  onBack: () => void;
};

const initialViewport: ViewportSize = { width: 1, height: 1 };
const initialTransform: ViewTransform = { scale: 1, translateX: 0, translateY: 0 };

export function DrawingWorkspace({
  project,
  drawing,
  asset,
  assetUrl,
  onBack,
}: DrawingWorkspaceProps) {
  const [currentDrawing, setCurrentDrawing] = useState(drawing);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<ViewportSize>(initialViewport);
  const [transform, setTransform] = useState<ViewTransform>(initialTransform);
  const [hasInitialTransform, setHasInitialTransform] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolMode>("browse");
  const [isAddPickerOpen, setIsAddPickerOpen] = useState(false);
  const [placingObjectType, setPlacingObjectType] = useState<PlaceableObjectType>();
  const [selection, setSelection] = useState<SelectionState>({});
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [referencePoints, setReferencePoints] = useState<ReferencePoint[]>([]);
  const [draft, setDraft] = useState<DimensionDraft>({ step: "idle" });
  const [rectDraft, setRectDraft] = useState<RectDraft>({ step: "idle" });
  const [lineDraft,setLineDraft]=useState<LineDraft>({points:[]});
  const [snapPreview, setSnapPreview] = useState<SnapResult>();
  const [dimensionSnapIndicator, setDimensionSnapIndicator] = useState<string>();
  const [activeRoomEdge, setActiveRoomEdge] = useState<{
    roomId: string;
    wallId: string;
    start: Point;
    end: Point;
    value: string;
  }>();
  const [pendingDimension, setPendingDimension] = useState<Omit<
    DimensionAnnotation,
    "id" | "layerId" | "colour" | "value" | "unit" | "createdAt" | "updatedAt" | "type"
  >>();
  const [pendingDimensionInitialValue, setPendingDimensionInitialValue] = useState("");
  const [isValueSheetOpen, setIsValueSheetOpen] = useState(false);
  const [isRectValueSheetOpen, setIsRectValueSheetOpen] = useState(false);
  const [pendingRoomInitialValues, setPendingRoomInitialValues] = useState({ width: "", height: "" });
  const [joinProposal, setJoinProposal] = useState<{ roomId: string }>();
  const [isJoinPromptOpen, setIsJoinPromptOpen] = useState(false);
  const [isDrawingSettingsOpen, setIsDrawingSettingsOpen] = useState(false);
  const [isSnapSheetOpen, setIsSnapSheetOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isRectEditorOpen, setIsRectEditorOpen] = useState(false);
  const [isRectangleEditorOpen, setIsRectangleEditorOpen] = useState(false);
  const [isDoorEditorOpen, setIsDoorEditorOpen] = useState(false);
  const [isRoomEditorCollapsed, setIsRoomEditorCollapsed] = useState(false);
  const [editableDimensionId, setEditableDimensionId] = useState<string>();
  const [editableShapeId, setEditableShapeId] = useState<string>();
  const [editableObjectId, setEditableObjectId] = useState<string>();
  const [selectedLineSegmentId, setSelectedLineSegmentId] = useState<string>();
  const [lineJoinProposal,setLineJoinProposal]=useState<{line:LineAnnotation;joined:LineAnnotation}>();
  const [editingNoteTextId, setEditingNoteTextId] = useState<string>();
  const [imageUrls, setImageUrls] = useState<Record<string,string>>({});
  const [isImageAdjusting,setIsImageAdjusting]=useState(false);
  const [imageEditMode,setImageEditMode]=useState<"distort"|"crop">("distort");
  const [isExportSettingsOpen,setIsExportSettingsOpen]=useState(false);
  const [isExportPreview,setIsExportPreview]=useState(false);
  const [exportConfig,setExportConfig]=useState({type:"png" as "png"|"jpeg"|"webp",width:1920,height:1080,ratio:"16:9",lockRatio:true});
  const [exportAnnotationScale,setExportAnnotationScale]=useState(1);
  const [exportMessage,setExportMessage]=useState<string>();
  const [isExporting,setIsExporting]=useState(false);
  const [isRenameDrawingOpen,setIsRenameDrawingOpen]=useState(false);
  const [drawingNameDraft,setDrawingNameDraft]=useState(drawing.name);
  const titleHoldRef=useRef<number|undefined>(undefined);
  const exportFrameRef=useRef<HTMLDivElement>(null);
  const exportAnnotationsSnapshotRef=useRef<Annotation[]|undefined>(undefined);
  const exportMoveRef=useRef<{id:string;pointerId:number;start:Point;original:Annotation}|undefined>(undefined);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const originResetTimerRef=useRef<number|undefined>(undefined);
  const [deletePrompt, setDeletePrompt] = useState<
    | {
        type: "room" | "dimension" | "rectangle" | "circle" | "door" | "note" | "image" | "line";
        id: string;
      }
    | undefined
  >();
  const [debugEvents, setDebugEvents] = useState<string[]>([]);
  const [isDebugVisible, setIsDebugVisible] = useState(false);
  const pendingDimensionRef = useRef<typeof pendingDimension>(undefined);
  const pendingRectRef = useRef<ReturnType<typeof normalizeRect> | undefined>(undefined);
  const draftRef = useRef<DimensionDraft>({ step: "idle" });
  const rectDraftRef = useRef<RectDraft>({ step: "idle" });
  const longPressRef = useRef<
    | {
        timeoutId: number;
        pointerId: number;
        startScreen: Point;
      }
    | undefined
  >(undefined);
  const creationPointer = useRef<
    | {
        action: "placeStart" | "placeEnd" | "moveStart" | "moveEnd" | "offset";
        pointerId: number;
        startScreen: Point;
        startWorld: Point;
    hasMoved: boolean;
      }
    | undefined
  >(undefined);
  const roomMoveRef = useRef<
    | {
        roomId: string;
        pointerId: number;
        startWorld: Point;
        originalRoom: RoomAnnotation;
        originalAnnotations: Annotation[];
        latestRoom: RoomAnnotation;
        latestAnnotations: Annotation[];
      }
    | undefined
  >(undefined);
  const roomResizeRef = useRef<
    | {
        roomId: string;
        pointId: string;
        pointerId: number;
        originalRoom: RoomAnnotation;
        originalAnnotations: Annotation[];
        latestRoom: RoomAnnotation;
        latestAnnotations: Annotation[];
      }
    | undefined
  >(undefined);
  const dimensionMoveRef = useRef<
    | {
        dimensionId: string;
        handle: DimensionEditHandle;
        latestDimension?: DimensionAnnotation;
        pointerId: number;
      }
    | undefined
  >(undefined);
  const shapeMoveRef = useRef<
    | {
        shapeId: string;
        handle: BasicShapeHandle;
        pointerId: number;
        startWorld: Point;
        originalShape: RectangleAnnotation | CircleAnnotation;
        latestShape: RectangleAnnotation | CircleAnnotation;
      }
    | undefined
  >(undefined);
  const objectMoveRef = useRef<{ id:string; handle:DoorEditHandle|NoteEditHandle; pointerId:number; startWorld:Point; original:DoorAnnotation|NoteAnnotation; latest:DoorAnnotation|NoteAnnotation }|undefined>(undefined);
  const imageMoveRef=useRef<{id:string;handle:ImageEditHandle;pointerId:number;startWorld:Point;original:ImageAnnotation;latest:ImageAnnotation;pointers?:Map<number,Point>;baseDistance?:number;baseImage?:ImageAnnotation}|undefined>(undefined);
  const imageEditSnapshotRef=useRef<ImageAnnotation|undefined>(undefined);
  const linePlacementRef=useRef<{pointerId:number;point:Point}|undefined>(undefined);
  const lineNodeMoveRef=useRef<{lineId:string;nodeId:string;pointerId:number;latest:LineAnnotation}|undefined>(undefined);
  const lineMeasurementMoveRef=useRef<{lineId:string;segmentId:string;pointerId:number;midX:number;midY:number;latest:LineAnnotation}|undefined>(undefined);
  const emptyTapRef=useRef<{pointerId:number;x:number;y:number;moved:boolean;multi:boolean}|undefined>(undefined);
  const browseGesturePointersRef=useRef<Set<number>>(new Set());
  const browseGestureHadMultipleRef=useRef(false);
  const suppressNextViewportClickRef = useRef(false);
  const centerWorld = useMemo(
    () => screenToWorld({ x: viewport.width / 2, y: viewport.height / 2 }, transform),
    [transform, viewport.height, viewport.width],
  );
  const mmPerWorldUnit = currentDrawing.scale?.mmPerWorldUnit ?? 1;

  const { cancelGesture: cancelPanZoomGesture, isInteracting, panZoomHandlers } = usePanZoom({
    transform,
    onTransformChange: setTransform,
  });

  function updateDraft(nextDraft: DimensionDraft) {
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }

  function updateRectDraft(nextDraft: RectDraft) {
    rectDraftRef.current = nextDraft;
    setRectDraft(nextDraft);
  }

  function updatePendingDimension(nextPending: typeof pendingDimension) {
    pendingDimensionRef.current = nextPending;
    setPendingDimension(nextPending);
  }

  const snapSettings = currentDrawing.snapSettings ?? getDefaultSnapSettings();
  const selectedDimension = annotations.find(
    (annotation): annotation is DimensionAnnotation =>
      annotation.type === "dimension" && annotation.id === selection.selectedAnnotationId,
  );
  const selectedRect = annotations.find(
    (annotation): annotation is RoomAnnotation =>
      annotation.type === "room" && annotation.id === selection.selectedAnnotationId,
  );
  const selectedShape = annotations.find(
    (annotation): annotation is RectangleAnnotation | CircleAnnotation =>
      (annotation.type === "rectangle" || annotation.type === "circle") && annotation.id === selection.selectedAnnotationId,
  );
  const selectedRectangle = selectedShape?.type === "rectangle" ? selectedShape : undefined;
  const selectedDoor = annotations.find(
    (annotation): annotation is DoorAnnotation =>
      annotation.type === "door" && annotation.id === selection.selectedAnnotationId,
  );
  const selectedNote = annotations.find((annotation): annotation is NoteAnnotation => annotation.type === "note" && annotation.id === selection.selectedAnnotationId);
  const selectedImage=annotations.find((annotation):annotation is ImageAnnotation=>annotation.type==="image"&&annotation.id===selection.selectedAnnotationId);
  const selectedLine=annotations.find((annotation):annotation is LineAnnotation=>annotation.type==="line"&&annotation.id===selection.selectedAnnotationId);
  const layers=currentDrawing.layers?.length?currentDrawing.layers:[{id:"general",name:"Layer 0",visible:true,order:0}];
  const activeLayerId=currentDrawing.activeLayerId??layers[0].id;
  const visibleLayerIds=new Set(layers.filter(layer=>layer.visible).map(layer=>layer.id));
  const layerOrder=new Map(layers.map(layer=>[layer.id,layer.order]));
  const visibleAnnotations=annotations.filter(annotation=>visibleLayerIds.has(annotation.layerId)||!layerOrder.has(annotation.layerId)).sort((a,b)=>((layerOrder.get(a.layerId)??0)-(layerOrder.get(b.layerId)??0))||(Number(a.type!=="image")-Number(b.type!=="image")));

  function pushDebugEvent(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    setDebugEvents((events) => [`${timestamp} ${message}`, ...events].slice(0, 9));
  }

  useEffect(() => {
    pushDebugEvent(`editableDimensionId changed ${editableDimensionId ? editableDimensionId.slice(-5) : "none"}`);
  }, [editableDimensionId]);

  useEffect(() => {
    pushDebugEvent(
      `DimensionEditorSheet rendered: ${Boolean(selectedDimension && isEditorOpen)} open=${isEditorOpen} selected=${
        selectedDimension?.id.slice(-5) ?? "none"
      }`,
    );
  }, [isEditorOpen, selectedDimension?.id]);

  useEffect(() => {
    setCurrentDrawing(drawing);
  }, [drawing]);

  useEffect(()=>{
    let cancelled=false; const urls:string[]=[];
    Promise.all([...new Set(annotations.filter((a):a is ImageAnnotation=>a.type==="image").map(a=>a.assetId))].map(async id=>{
      const stored=await getAsset(id); if(!stored)return; const url=URL.createObjectURL(stored.blob);urls.push(url);return [id,url] as const;
    })).then(entries=>{if(!cancelled)setImageUrls(Object.fromEntries(entries.filter(Boolean) as Array<readonly [string,string]>))});
    return()=>{cancelled=true;urls.forEach(URL.revokeObjectURL)};
  },[annotations.filter(a=>a.type==="image").map(a=>a.assetId).join("|")]);

  useEffect(() => {
    async function loadDrawingData() {
      const loadedAnnotations = await getDrawingAnnotations(drawing.id);
      setAnnotations(loadedAnnotations);
      await migrateDrawingScaleIfNeeded(drawing, loadedAnnotations);
    }

    loadDrawingData();
    getReferencePoints(drawing.id).then(setReferencePoints);
  }, [drawing]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setViewport({
        width: Math.max(1, entry.contentRect.width),
        height: Math.max(1, entry.contentRect.height),
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (hasInitialTransform || viewport.width <= 1 || viewport.height <= 1) return;

    if (drawing.backgroundType === "photo" && drawing.backgroundPlacement) {
      setTransform(createPhotoFitTransform(viewport, drawing.backgroundPlacement));
    } else {
      setTransform(createBlankInitialTransform(viewport));
    }

    setHasInitialTransform(true);
  }, [drawing.backgroundPlacement, drawing.backgroundType, hasInitialTransform, viewport]);

  function getWorldPoint(event: React.PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const screenPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const worldPoint = screenToWorld(screenPoint, transform);
    const snapped = snapPoint({
      point: worldPoint,
      annotations,
      mmPerWorldUnit,
      referencePoints,
      settings: snapSettings,
      transform,
    });

    return {
      screenPoint,
      rawWorldPoint: worldPoint,
      worldPoint: snapped.point,
      snap: snapped,
    };
  }

  function getEndpointAction(screenPoint: Point, currentDraft: DimensionDraft) {
    if (currentDraft.step !== "endPlaced" && currentDraft.step !== "offsetPlaced") return undefined;

    const endpointRadius = 34;
    const startScreen = {
      x: currentDraft.start.x * transform.scale + transform.translateX,
      y: currentDraft.start.y * transform.scale + transform.translateY,
    };
    const endScreen = {
      x: currentDraft.end.x * transform.scale + transform.translateX,
      y: currentDraft.end.y * transform.scale + transform.translateY,
    };
    const startDistance = Math.hypot(screenPoint.x - startScreen.x, screenPoint.y - startScreen.y);
    const endDistance = Math.hypot(screenPoint.x - endScreen.x, screenPoint.y - endScreen.y);

    if (startDistance <= endpointRadius && startDistance <= endDistance) return "moveStart";
    if (endDistance <= endpointRadius) return "moveEnd";
    return undefined;
  }

  function getDistanceFromDraftBaseline(screenPoint: Point, currentDraft: DimensionDraft) {
    if (currentDraft.step !== "endPlaced" && currentDraft.step !== "offsetPlaced") return Number.POSITIVE_INFINITY;

    const start = {
      x: currentDraft.start.x * transform.scale + transform.translateX,
      y: currentDraft.start.y * transform.scale + transform.translateY,
    };
    const end = {
      x: currentDraft.end.x * transform.scale + transform.translateX,
      y: currentDraft.end.y * transform.scale + transform.translateY,
    };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;

    return Math.abs(dy * screenPoint.x - dx * screenPoint.y + end.x * start.y - end.y * start.x) / length;
  }

  function handlePointerDown(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const startedOnAnnotation = isAnnotationPointerTarget(event);

    if(activeTool==="line"){
      event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);const {worldPoint,snap}=getWorldPoint(event);setSnapPreview(snap.type?snap:undefined);
      linePlacementRef.current={pointerId:event.pointerId,point:worldPoint};setLineDraft(current=>({...current,preview:worldPoint}));return;
    }

    if (activeTool === "dimension") {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const { screenPoint, rawWorldPoint, worldPoint, snap } = getWorldPoint(event);
      setSnapPreview(snap.type ? snap : undefined);
      const currentDraft = draftRef.current;
      if (currentDraft.step === "idle") {
        const edgeMatch = getNearestRoomEdge(rawWorldPoint);
        if (edgeMatch) {
          setActiveRoomEdge(edgeMatch);
          updateDraft({ step: "endPlaced", start: edgeMatch.start, end: edgeMatch.end });
          updatePendingDimension({
            drawingId: currentDrawing.id,
            start: edgeMatch.start,
            end: edgeMatch.end,
            offset: 0,
          });
          setPendingDimensionInitialValue(edgeMatch.value);
          creationPointer.current = {
            action: "offset",
            pointerId: event.pointerId,
            startScreen: screenPoint,
            startWorld: worldPoint,
            hasMoved: false,
          };
          return;
        }
      }
      const endpointAction = getEndpointAction(screenPoint, currentDraft);
      creationPointer.current = {
        action: endpointAction
          ? endpointAction
          : currentDraft.step === "idle"
            ? "placeStart"
            : currentDraft.step === "startPlaced"
              ? "placeEnd"
              : "offset",
        pointerId: event.pointerId,
        startScreen: screenPoint,
        startWorld: worldPoint,
        hasMoved: false,
      };

      if (draftRef.current.step === "idle") {
        updateDraft({ step: "startPlaced", start: worldPoint });
      }
      return;
    }

    if (activeTool === "placingObject" && placingObjectType) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const { screenPoint, rawWorldPoint, worldPoint: snappedWorldPoint, snap } = getWorldPoint(event);
      if (placingObjectType === "door") {
        const door = createDoorFromPoint(rawWorldPoint);
        createAndSaveDoor(door);
        creationPointer.current = undefined;
        return;
      }
      const worldPoint = placingObjectType === "room" ? snapRoomCreationPoint(rawWorldPoint).point : snappedWorldPoint;
      setSnapPreview(placingObjectType === "room" ? undefined : snap.type ? snap : undefined);
      updateRectDraft({ step: "drawing", start: worldPoint, end: worldPoint });
      creationPointer.current = {
        action: "placeStart",
        pointerId: event.pointerId,
        startScreen: screenPoint,
        startWorld: worldPoint,
        hasMoved: false,
      };
      return;
    }

    if (activeTool === "browse") {
      if (!startedOnAnnotation) {
        if(emptyTapRef.current) emptyTapRef.current.multi=true;
        else emptyTapRef.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY,moved:false,multi:browseGestureHadMultipleRef.current};
      }
      const { screenPoint, worldPoint } = getWorldPoint(event);
      const nearestPoint = startedOnAnnotation ? undefined : getNearestExistingPoint(worldPoint);
      if (nearestPoint) {
        const timeoutId = window.setTimeout(async () => {
          const referencePoint = createReferencePoint({
            drawingId: currentDrawing.id,
            point: nearestPoint,
          });
          await saveReferencePoint(referencePoint);
          setReferencePoints((items) => [...items, referencePoint]);
        }, 520);
        longPressRef.current = {
          timeoutId,
          pointerId: event.pointerId,
          startScreen: screenPoint,
        };
      }
    }
    panZoomHandlers.onPointerDown(event);
  }

  function isAnnotationPointerTarget(event: React.PointerEvent<HTMLElement>) {
    const target = event.target;
    return target instanceof Element && Boolean(target.closest("[data-annotation-hit='true']"));
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const emptyTap=emptyTapRef.current;
    if(emptyTap?.pointerId===event.pointerId&&Math.hypot(event.clientX-emptyTap.x,event.clientY-emptyTap.y)>10)emptyTap.moved=true;
    if(activeTool==="line"){
      const placement=linePlacementRef.current;if(!placement||placement.pointerId!==event.pointerId)return;const {worldPoint,snap}=getWorldPoint(event);placement.point=worldPoint;setSnapPreview(snap.type?snap:undefined);setLineDraft(current=>({...current,preview:worldPoint}));return;
    }
    if (activeTool === "dimension" && !creationPointer.current) {
      const { rawWorldPoint } = getWorldPoint(event);
      setActiveRoomEdge(getNearestRoomEdge(rawWorldPoint));
      return;
    }

    if (activeTool === "placingObject" && placingObjectType) {
      if (placingObjectType === "door") {
        const { rawWorldPoint } = getWorldPoint(event);
        const edge = getNearestRoomEdge(rawWorldPoint);
        setActiveRoomEdge(edge);
        return;
      }
      const pointer = creationPointer.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;
      event.preventDefault();
      const { rawWorldPoint, worldPoint: snappedWorldPoint, snap: defaultSnap } = getWorldPoint(event);
      const snap = placingObjectType === "room" ? snapRoomCreationPoint(rawWorldPoint) : defaultSnap;
      setSnapPreview(snap.type ? snap : undefined);
      const worldPoint = placingObjectType === "room" ? snap.point : snappedWorldPoint;
      updateRectDraft({ step: "drawing", start: pointer.startWorld, end: worldPoint });
      return;
    }

    if (activeTool !== "dimension") {
      cancelLongPressIfMoved(event);
      panZoomHandlers.onPointerMove(event);
      return;
    }

    const pointer = creationPointer.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    event.preventDefault();

    const { screenPoint, rawWorldPoint, worldPoint, snap } = getWorldPoint(event);
    const moved = Math.hypot(
      screenPoint.x - pointer.startScreen.x,
      screenPoint.y - pointer.startScreen.y,
    );

    if (moved > 10) pointer.hasMoved = true;
    setSnapPreview(snap.type ? snap : undefined);
    if (draftRef.current.step === "idle") setActiveRoomEdge(getNearestRoomEdge(rawWorldPoint));

    const currentDraft = draftRef.current;
    if (pointer.action === "placeStart" && currentDraft.step === "startPlaced" && pointer.hasMoved) {
      updateDraft({ step: "endPlaced", start: currentDraft.start, end: worldPoint });
    } else if (pointer.action === "moveStart" && (currentDraft.step === "endPlaced" || currentDraft.step === "offsetPlaced")) {
      updateDraft({ step: "endPlaced", start: worldPoint, end: currentDraft.end, activeHandle: "start" });
    } else if (pointer.action === "moveEnd" && (currentDraft.step === "endPlaced" || currentDraft.step === "offsetPlaced")) {
      updateDraft({ step: "endPlaced", start: currentDraft.start, end: worldPoint, activeHandle: "end" });
    } else if (pointer.action === "offset" && currentDraft.step === "endPlaced") {
      updateDraft({
        step: "offsetPlaced",
        start: currentDraft.start,
        end: currentDraft.end,
        offset: getDimensionOffset(currentDraft.start, currentDraft.end, worldPoint),
      });
    } else if (pointer.action === "offset" && currentDraft.step === "offsetPlaced") {
      updateDraft({
        ...currentDraft,
        offset: getDimensionOffset(currentDraft.start, currentDraft.end, worldPoint),
      });
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLElement>) {
    if(activeTool==="line"){const placement=linePlacementRef.current;if(!placement||placement.pointerId!==event.pointerId)return;const point=placement.point;linePlacementRef.current=undefined;setLineDraft(current=>{const previous=current.points[current.points.length-1];if(previous&&Math.hypot(previous.x-point.x,previous.y-point.y)<2/transform.scale)return{...current,preview:point};return{points:[...current.points,point],preview:point}});return;}
    if (activeTool === "placingObject" && placingObjectType) {
      if (placingObjectType === "door") {
        creationPointer.current = undefined;
        return;
      }
      const pointer = creationPointer.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;
      event.preventDefault();
      const currentRectDraft = rectDraftRef.current;
      if (currentRectDraft.step === "drawing") {
        const rect = normalizeRect(currentRectDraft.start, currentRectDraft.end);
        if ((placingObjectType === "note" && Math.hypot(rect.width,rect.height)>20/transform.scale) || (rect.width > 20 / transform.scale && rect.height > 20 / transform.scale)) {
          if (placingObjectType === "room") {
            pendingRectRef.current = rect;
            setPendingRoomInitialValues(inferRoomDimensions(rect));
            setJoinProposal(undefined);
            setIsRectValueSheetOpen(true);
          } else {
            createAndSavePlacedObject(placingObjectType, rect);
          }
        } else {
          cancelActiveAction();
        }
      }
      creationPointer.current = undefined;
      return;
    }

    if (activeTool !== "dimension") {
      cancelLongPress();
      panZoomHandlers.onPointerUp(event);
      const emptyTap=emptyTapRef.current;
      if(emptyTap?.pointerId===event.pointerId){emptyTapRef.current=undefined;if(!emptyTap.moved&&!emptyTap.multi)exitBrowseEditLevel();}
      return;
    }

    const pointer = creationPointer.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    event.preventDefault();
    const { worldPoint, snap } = getWorldPoint(event);
    setSnapPreview(snap.type ? snap : undefined);

    const currentDraft = draftRef.current;
    if (!pointer.hasMoved && pointer.action === "placeStart" && currentDraft.step === "idle") {
      updateDraft({ step: "startPlaced", start: worldPoint });
    } else if (!pointer.hasMoved && pointer.action === "placeEnd" && currentDraft.step === "startPlaced") {
      updateDraft({ step: "endPlaced", start: currentDraft.start, end: worldPoint });
    } else if (pointer.hasMoved && pointer.action === "placeStart" && currentDraft.step === "endPlaced") {
      updateDraft({ step: "endPlaced", start: currentDraft.start, end: worldPoint });
    } else if (
      (pointer.action === "moveStart" || pointer.action === "moveEnd") &&
      (currentDraft.step === "endPlaced" || currentDraft.step === "offsetPlaced")
    ) {
      updateDraft({ step: "endPlaced", start: currentDraft.start, end: currentDraft.end });
    } else if (pointer.action === "offset" && currentDraft.step === "offsetPlaced") {
      const pending = {
        drawingId: currentDrawing.id,
        start: currentDraft.start,
        end: currentDraft.end,
        offset: currentDraft.offset,
      };
      const inferredValue = inferMeasurementValue(currentDraft.start, currentDraft.end);
      if (currentDrawing.scale && inferredValue) {
        createAndSaveDimension(pending, inferredValue);
      } else {
        updatePendingDimension(pending);
        setPendingDimensionInitialValue((currentValue) => currentValue || inferredValue);
        setIsValueSheetOpen(true);
      }
    }

    creationPointer.current = undefined;
  }

  function exitBrowseEditLevel(){
    if(selectedLineSegmentId){setSelectedLineSegmentId(undefined);return;}
    if(editingNoteTextId){void handleNoteTextCommit(editingNoteTextId);return;}
    if(editableDimensionId||editableShapeId||editableObjectId||editingNoteTextId||isRoomEditorCollapsed){
      setEditableDimensionId(undefined);setEditableShapeId(undefined);setEditableObjectId(undefined);setEditingNoteTextId(undefined);setIsRoomEditorCollapsed(false);setIsImageAdjusting(false);return;
    }
    setSelection({});setIsRectangleEditorOpen(false);
  }

  function handlePointerCancel(event:React.PointerEvent<HTMLElement>){
    if(emptyTapRef.current?.pointerId===event.pointerId)emptyTapRef.current=undefined;
    cancelLongPress();panZoomHandlers.onPointerCancel(event);
  }
  function handleGesturePointerDownCapture(event:React.PointerEvent<HTMLElement>){if(activeTool!=="browse")return;browseGesturePointersRef.current.add(event.pointerId);if(browseGesturePointersRef.current.size>1){browseGestureHadMultipleRef.current=true;if(emptyTapRef.current)emptyTapRef.current.multi=true}}
  function handleGesturePointerEndCapture(event:React.PointerEvent<HTMLElement>){window.setTimeout(()=>{browseGesturePointersRef.current.delete(event.pointerId);if(!browseGesturePointersRef.current.size)browseGestureHadMultipleRef.current=false},0)}

  function cancelLongPressIfMoved(event: React.PointerEvent<HTMLElement>) {
    const longPress = longPressRef.current;
    if (!longPress || longPress.pointerId !== event.pointerId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const screenPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const moved = Math.hypot(
      screenPoint.x - longPress.startScreen.x,
      screenPoint.y - longPress.startScreen.y,
    );

    if (moved > 10) cancelLongPress();
  }

  function cancelLongPress() {
    if (!longPressRef.current) return;
    window.clearTimeout(longPressRef.current.timeoutId);
    longPressRef.current = undefined;
  }

  function getNearestExistingPoint(point: Point) {
    const snapRadius = 26 / transform.scale;
    let nearest: { point: Point; distance: number } | undefined;

    for (const annotation of annotations) {
      if (annotation.type === "room") {
        const roomPoints = [...getRectCorners(annotation), ...getRectMidpoints(annotation), getRectCenter(annotation)];
        const edgePoint = getClosestPointOnRectEdge(annotation, point);

        if (edgePoint && edgePoint.distance <= snapRadius && (!nearest || edgePoint.distance < nearest.distance)) {
          nearest = edgePoint;
        }

        for (const roomPoint of roomPoints) {
          const distance = Math.hypot(roomPoint.x - point.x, roomPoint.y - point.y);
          if (distance <= snapRadius && (!nearest || distance < nearest.distance)) {
            nearest = { point: roomPoint, distance };
          }
        }
      }

      if (annotation.type === "dimension") {
        for (const endpoint of [annotation.start, annotation.end]) {
          const distance = Math.hypot(endpoint.x - point.x, endpoint.y - point.y);
          if (distance <= snapRadius && (!nearest || distance < nearest.distance)) {
            nearest = { point: endpoint, distance };
          }
        }
      }
    }

    return nearest?.point;
  }

  function snapRoomCreationPoint(point: Point): SnapResult {
    const worldRadius = 28 / transform.scale;
    const candidates: Array<{ point: Point; type: SnapResult["type"]; priority: number; distance: number }> = [];

    for (const annotation of annotations) {
      if (annotation.type !== "room") continue;
      for (const corner of getRoomCorners(annotation)) {
        candidates.push({
          point: corner,
          type: "shapeCorner",
          priority: 1,
          distance: Math.hypot(corner.x - point.x, corner.y - point.y),
        });
      }
    }

    for (const referencePoint of referencePoints) {
      candidates.push({
        point: referencePoint.point,
        type: "reference",
        priority: 2,
        distance: Math.hypot(referencePoint.point.x - point.x, referencePoint.point.y - point.y),
      });
    }

    const gridSize = getActiveConstructionGridSize({
      mmPerWorldUnit,
      viewportScale: transform.scale,
    });
    const gridPoint = {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize,
    };
    candidates.push({
      point: gridPoint,
      type: "grid",
      priority: 3,
      distance: Math.hypot(gridPoint.x - point.x, gridPoint.y - point.y),
    });

    const match = candidates
      .filter((candidate) => candidate.distance <= worldRadius)
      .sort((first, second) => first.priority - second.priority || first.distance - second.distance)[0];

    return match ? { point: match.point, type: match.type } : { point };
  }

  function snapMovedRoom(room: RoomAnnotation) {
    const worldRadius = 30 / transform.scale;
    const corners = getRoomCorners(room);
    const otherCorners = annotations
      .filter((annotation): annotation is RoomAnnotation => annotation.type === "room" && annotation.id !== room.id)
      .flatMap(getRoomCorners);

    const cornerMatch = corners
      .flatMap((corner) =>
        otherCorners.map((target) => ({
          type: "shapeCorner" as const,
          point: target,
          delta: { x: target.x - corner.x, y: target.y - corner.y },
          distance: Math.hypot(target.x - corner.x, target.y - corner.y),
        })),
      )
      .filter((match) => match.distance <= worldRadius)
      .sort((first, second) => first.distance - second.distance)[0];

    if (cornerMatch) return cornerMatch;

    const gridSize = getActiveConstructionGridSize({
      mmPerWorldUnit,
      viewportScale: transform.scale,
    });
    const gridMatch = corners
      .map((corner) => {
        const target = {
          x: Math.round(corner.x / gridSize) * gridSize,
          y: Math.round(corner.y / gridSize) * gridSize,
        };
        return {
          type: "grid" as const,
          point: target,
          delta: { x: target.x - corner.x, y: target.y - corner.y },
          distance: Math.hypot(target.x - corner.x, target.y - corner.y),
        };
      })
      .filter((match) => match.distance <= worldRadius)
      .sort((first, second) => first.distance - second.distance)[0];

    return gridMatch;
  }

  function snapRoomEditPoint(point: Point, roomId: string): SnapResult {
    const worldRadius = 28 / transform.scale;
    const candidates: Array<{ point: Point; type: SnapResult["type"]; priority: number; distance: number }> = [];

    for (const annotation of annotations) {
      if (annotation.type !== "room" || annotation.id === roomId) continue;
      for (const corner of getRoomCorners(annotation)) {
        candidates.push({
          point: corner,
          type: "shapeCorner",
          priority: 1,
          distance: Math.hypot(corner.x - point.x, corner.y - point.y),
        });
      }
    }

    for (const referencePoint of referencePoints) {
      candidates.push({
        point: referencePoint.point,
        type: "reference",
        priority: 2,
        distance: Math.hypot(referencePoint.point.x - point.x, referencePoint.point.y - point.y),
      });
    }

    const gridSize = getActiveConstructionGridSize({
      mmPerWorldUnit,
      viewportScale: transform.scale,
    });
    const gridPoint = {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize,
    };
    candidates.push({
      point: gridPoint,
      type: "grid",
      priority: 3,
      distance: Math.hypot(gridPoint.x - point.x, gridPoint.y - point.y),
    });

    const match = candidates
      .filter((candidate) => candidate.distance <= worldRadius)
      .sort((first, second) => first.priority - second.priority || first.distance - second.distance)[0];

    return match ? { point: match.point, type: match.type } : { point };
  }

  function resizeRoomFromPoint(room: RoomAnnotation, pointId: string, target: Point) {
    const point = room.points.find((item) => item.id === pointId);
    if (!point) return room;

    const bounds = getRoomBounds(room);
    const maxX = bounds.x + bounds.width;
    const maxY = bounds.y + bounds.height;
    const fixedX = Math.abs(point.x - bounds.x) <= Math.abs(point.x - maxX) ? maxX : bounds.x;
    const fixedY = Math.abs(point.y - bounds.y) <= Math.abs(point.y - maxY) ? maxY : bounds.y;
    const minSize = 28 / transform.scale;
    const nextWidth = Math.max(minSize, Math.abs(target.x - fixedX));
    const nextHeight = Math.max(minSize, Math.abs(target.y - fixedY));
    const nextX = target.x < fixedX ? fixedX - nextWidth : fixedX;
    const nextY = target.y < fixedY ? fixedY - nextHeight : fixedY;

    const widthRatio = bounds.width > 0 ? nextWidth / bounds.width : 1;
    const heightRatio = bounds.height > 0 ? nextHeight / bounds.height : 1;
    const mmScale = currentDrawing.scale?.mmPerWorldUnit;

    return {
      ...room,
      internalWidth: mmScale ? String(Math.round(nextWidth * mmScale)) : room.internalWidth,
      internalHeight: mmScale ? String(Math.round(nextHeight * mmScale)) : room.internalHeight,
      points: room.points.map((roomPoint) => ({
        ...roomPoint,
        x: nextX + (roomPoint.x - bounds.x) * widthRatio,
        y: nextY + (roomPoint.y - bounds.y) * heightRatio,
      })),
      updatedAt: new Date().toISOString(),
    };
  }

  function getWorldPointFromClient(event: React.PointerEvent) {
    const bounds = viewportRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return screenToWorld({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, transform);
  }

  function snapBasicShapeEditPoint(point: Point, shapeId: string): SnapResult {
    return snapPoint({
      point,
      annotations,
      excludeAnnotationId: shapeId,
      mmPerWorldUnit,
      referencePoints,
      settings: snapSettings,
      transform,
    });
  }

  function snapDimensionEndpointLength(input: {
    fixedPoint: Point;
    originalMovingPoint: Point;
    pointerPoint: Point;
  }) {
    const incrementMm = getMeasurementSnapIncrementMm(transform.scale);
    const scale = currentDrawing.scale?.mmPerWorldUnit;
    if (!scale || scale <= 0) {
      return {
        point: input.pointerPoint,
        incrementMm,
        rawLengthMm: 0,
        quantisedLengthMm: 0,
      };
    }

    const incrementWorld = incrementMm / scale;
    const originalDx = input.originalMovingPoint.x - input.fixedPoint.x;
    const originalDy = input.originalMovingPoint.y - input.fixedPoint.y;
    const pointerDx = input.pointerPoint.x - input.fixedPoint.x;
    const pointerDy = input.pointerPoint.y - input.fixedPoint.y;
    const originalLength = Math.hypot(originalDx, originalDy);
    const pointerLength = Math.hypot(pointerDx, pointerDy);
    const rawLengthMm = pointerLength * scale;
    const quantisedLengthMm = Math.round(rawLengthMm / incrementMm) * incrementMm;
    if (pointerLength <= 0 || incrementWorld <= 0) {
      return {
        point: input.pointerPoint,
        incrementMm,
        rawLengthMm,
        quantisedLengthMm,
      };
    }

    const isHorizontal = originalLength > 0 && Math.abs(originalDy) <= Math.abs(originalDx) * 0.08;
    const isVertical = originalLength > 0 && Math.abs(originalDx) <= Math.abs(originalDy) * 0.08;

    if (isHorizontal) {
      const snappedDistance = quantisedLengthMm / scale;
      const direction = pointerDx < 0 ? -1 : 1;
      return {
        point: { x: input.fixedPoint.x + snappedDistance * direction, y: input.fixedPoint.y },
        incrementMm,
        rawLengthMm,
        quantisedLengthMm,
      };
    }

    if (isVertical) {
      const snappedDistance = quantisedLengthMm / scale;
      const direction = pointerDy < 0 ? -1 : 1;
      return {
        point: { x: input.fixedPoint.x, y: input.fixedPoint.y + snappedDistance * direction },
        incrementMm,
        rawLengthMm,
        quantisedLengthMm,
      };
    }

    const snappedLength = quantisedLengthMm / scale;
    return {
      point: {
        x: input.fixedPoint.x + (pointerDx / pointerLength) * snappedLength,
        y: input.fixedPoint.y + (pointerDy / pointerLength) * snappedLength,
      },
      incrementMm,
      rawLengthMm,
      quantisedLengthMm,
    };
  }

  function handleMoveRoomStart(roomId: string, event: React.PointerEvent<SVGElement>) {
    const room = annotations.find((annotation): annotation is RoomAnnotation => annotation.type === "room" && annotation.id === roomId);
    if (!room) return;
    roomMoveRef.current = {
      roomId,
      pointerId: event.pointerId,
      startWorld: getWorldPointFromClient(event),
      originalRoom: room,
      originalAnnotations: annotations,
      latestRoom: room,
      latestAnnotations: annotations,
    };
    setSelection({ selectedAnnotationId: roomId });
  }

  function handleMoveRoomUpdate(roomId: string, event: React.PointerEvent<SVGElement>) {
    const move = roomMoveRef.current;
    if (!move || move.roomId !== roomId || move.pointerId !== event.pointerId) return;
    const worldPoint = getWorldPointFromClient(event);
    const baseDelta = {
      x: worldPoint.x - move.startWorld.x,
      y: worldPoint.y - move.startWorld.y,
    };
    const movedRoom = translateRoom(move.originalRoom, baseDelta);
    const snap = snapMovedRoom(movedRoom);
    const finalRoom = snap ? translateRoom(movedRoom, snap.delta) : movedRoom;
    const movedAnnotations = clearJoinsForRoomInAnnotations(
      remapDimensionsForRoomChange(move.originalRoom, finalRoom, move.originalAnnotations).map((item) =>
        item.id === finalRoom.id ? finalRoom : item,
      ),
      roomId,
    );
    const joinedRoom = movedAnnotations.find(
      (annotation): annotation is RoomAnnotation => annotation.type === "room" && annotation.id === roomId,
    ) ?? finalRoom;

    roomMoveRef.current = { ...move, latestRoom: joinedRoom, latestAnnotations: movedAnnotations };
    setSnapPreview(snap ? { point: snap.point, type: snap.type } : undefined);
    setAnnotations(movedAnnotations);
  }

  async function handleMoveRoomEnd(roomId: string, event: React.PointerEvent<SVGElement>) {
    const move = roomMoveRef.current;
    if (!move || move.roomId !== roomId || move.pointerId !== event.pointerId) return;
    roomMoveRef.current = undefined;
    const room = move.latestRoom;
    setSnapPreview(undefined);
    if (!room) return;

    try {
      const changedDimensions = move.latestAnnotations.filter(
        (annotation): annotation is DimensionAnnotation => annotation.type === "dimension",
      );
      await Promise.all(changedDimensions.map((dimension) => saveAnnotation(dimension)));
      await persistRoomsFromAnnotations(move.latestAnnotations);
      maybeOfferRoomJoin(move.latestAnnotations, roomId);
    } catch (error) {
      console.error("[ForteStack] room move autosave failed", error);
    }
  }

  function handleResizeRoomStart(roomId: string, pointId: string, event: React.PointerEvent<SVGCircleElement>) {
    const room = annotations.find((annotation): annotation is RoomAnnotation => annotation.type === "room" && annotation.id === roomId);
    if (!room) return;

    roomResizeRef.current = {
      roomId,
      pointId,
      pointerId: event.pointerId,
      originalRoom: room,
      originalAnnotations: annotations,
      latestRoom: room,
      latestAnnotations: annotations,
    };
    setSelection({ selectedAnnotationId: roomId });
    setIsRoomEditorCollapsed(true);
  }

  function handleResizeRoomUpdate(roomId: string, pointId: string, event: React.PointerEvent<SVGCircleElement>) {
    const resize = roomResizeRef.current;
    if (!resize || resize.roomId !== roomId || resize.pointId !== pointId || resize.pointerId !== event.pointerId) return;

    const rawPoint = getWorldPointFromClient(event);
    const snap = snapRoomEditPoint(rawPoint, roomId);
    const resizedRoom = resizeRoomFromPoint(resize.originalRoom, pointId, snap.point);
    const resizedAnnotations = clearJoinsForRoomInAnnotations(
      remapDimensionsForRoomChange(
        resize.originalRoom,
        resizedRoom,
        resize.originalAnnotations,
      ).map((item) => (item.id === resizedRoom.id ? resizedRoom : item)),
      roomId,
    );
    const joinedRoom = resizedAnnotations.find(
      (annotation): annotation is RoomAnnotation => annotation.type === "room" && annotation.id === roomId,
    ) ?? resizedRoom;

    roomResizeRef.current = {
      ...resize,
      latestRoom: joinedRoom,
      latestAnnotations: resizedAnnotations,
    };
    setSnapPreview(snap.type ? { point: snap.point, type: snap.type } : undefined);
    setAnnotations(resizedAnnotations);
  }

  async function handleResizeRoomEnd(roomId: string, pointId: string, event: React.PointerEvent<SVGCircleElement>) {
    const resize = roomResizeRef.current;
    if (!resize || resize.roomId !== roomId || resize.pointId !== pointId || resize.pointerId !== event.pointerId) return;
    roomResizeRef.current = undefined;
    setSnapPreview(undefined);

    try {
      const changedDimensions = resize.latestAnnotations.filter(
        (annotation): annotation is DimensionAnnotation => annotation.type === "dimension",
      );
      await Promise.all(changedDimensions.map((dimension) => saveAnnotation(dimension)));
      await persistRoomsFromAnnotations(resize.latestAnnotations);
      maybeOfferRoomJoin(resize.latestAnnotations, roomId);
    } catch (error) {
      console.error("[ForteStack] room resize autosave failed", error);
    }
  }

  function handleMoveDimensionPointStart(
    dimensionId: string,
    handle: DimensionEditHandle,
    event: React.PointerEvent<SVGCircleElement>,
  ) {
    pushDebugEvent(`dimension handle drag started ${dimensionId.slice(-5)} ${handle}`);
    setDimensionSnapIndicator(handle === "offset" ? undefined : `Snap: ${getMeasurementSnapIncrementMm(transform.scale)} mm`);
    dimensionMoveRef.current = {
      dimensionId,
      handle,
      latestDimension: annotations.find(
        (annotation): annotation is DimensionAnnotation => annotation.type === "dimension" && annotation.id === dimensionId,
      ),
      pointerId: event.pointerId,
    };
    setSelection({ selectedAnnotationId: dimensionId });
    setEditableDimensionId(dimensionId);
  }

  function handleMoveDimensionPointUpdate(
    dimensionId: string,
    handle: DimensionEditHandle,
    event: React.PointerEvent<SVGCircleElement>,
  ) {
    const move = dimensionMoveRef.current;
    if (!move || move.dimensionId !== dimensionId || move.handle !== handle || move.pointerId !== event.pointerId) return;
    const incrementMm = getMeasurementSnapIncrementMm(transform.scale);
    setDimensionSnapIndicator(handle === "offset" ? undefined : `Snap: ${incrementMm} mm`);
    setAnnotations((items) =>
      items.map((annotation) => {
        if (annotation.type !== "dimension" || annotation.id !== dimensionId) return annotation;
        const worldPoint = getWorldPointFromClient(event);
        const snapResult = snapPoint({
          point: worldPoint,
          annotations,
          mmPerWorldUnit,
          referencePoints,
          settings: snapSettings,
          transform,
        });
        setSnapPreview(snapResult.type ? snapResult : undefined);
        const updated =
          handle === "offset"
            ? {
                ...annotation,
                offset: getDimensionOffset(annotation.start, annotation.end, snapResult.point),
              }
            : (() => {
                const fixedPoint = handle === "start" ? annotation.end : annotation.start;
                const originalMovingPoint = handle === "start" ? annotation.start : annotation.end;
                const hardGeometrySnap =
                  snapResult.type === "reference" || snapResult.type === "shapeCorner" || snapResult.type === "endpoint"
                    ? snapResult
                    : undefined;
                const constrainedSnap =
                  snapResult.type === "shapeEdge" || snapResult.type === "alignment" ? snapResult : undefined;
                const snapInputPoint = hardGeometrySnap
                  ? hardGeometrySnap.point
                  : constrainedSnap
                    ? constrainedSnap.point
                    : worldPoint;
                const adjusted = hardGeometrySnap
                  ? {
                      point: hardGeometrySnap.point,
                      incrementMm,
                      rawLengthMm: Math.hypot(hardGeometrySnap.point.x - fixedPoint.x, hardGeometrySnap.point.y - fixedPoint.y) * mmPerWorldUnit,
                      quantisedLengthMm:
                        Math.hypot(hardGeometrySnap.point.x - fixedPoint.x, hardGeometrySnap.point.y - fixedPoint.y) * mmPerWorldUnit,
                    }
                  : snapDimensionEndpointLength({
                      fixedPoint,
                      originalMovingPoint,
                      pointerPoint: snapInputPoint,
                    });
                const finalStoredValue = hardGeometrySnap
                  ? Math.round(adjusted.quantisedLengthMm)
                  : Math.round(adjusted.quantisedLengthMm);
                pushDebugEvent(
                  `dim snap raw=${Math.round(adjusted.rawLengthMm)} inc=${adjusted.incrementMm} q=${Math.round(
                    adjusted.quantisedLengthMm,
                  )} value=${finalStoredValue} target=${snapResult.type ?? "raw"}`,
                );
                return {
                  ...annotation,
                  [handle]: adjusted.point,
                  value: String(finalStoredValue),
                };
              })();
        const nextDimension = {
          ...updated,
          value: updated.value ?? (inferMeasurementValue(updated.start, updated.end) || annotation.value),
          updatedAt: new Date().toISOString(),
        };
        dimensionMoveRef.current = { ...move, latestDimension: nextDimension };
        return nextDimension;
      }),
    );
  }

  async function handleMoveDimensionPointEnd(
    dimensionId: string,
    handle: DimensionEditHandle,
    event: React.PointerEvent<SVGCircleElement>,
  ) {
    const move = dimensionMoveRef.current;
    if (!move || move.dimensionId !== dimensionId || move.handle !== handle || move.pointerId !== event.pointerId) return;
    dimensionMoveRef.current = undefined;
    setSnapPreview(undefined);
    setDimensionSnapIndicator(undefined);
    const dimension = move.latestDimension;
    if (!dimension) return;

    try {
      await saveAnnotation(dimension);
      pushDebugEvent(`persistence completed ${dimension.id.slice(-5)}`);
    } catch (error) {
      console.error("[ForteStack] dimension point autosave failed", error);
    }
  }

  function handleMoveShapeStart(shapeId: string, handle: BasicShapeHandle, event: React.PointerEvent<SVGElement>) {
    const shape = annotations.find(
      (annotation): annotation is RectangleAnnotation | CircleAnnotation =>
        (annotation.type === "rectangle" || annotation.type === "circle") && annotation.id === shapeId,
    );
    if (!shape) return;

    shapeMoveRef.current = {
      shapeId,
      handle,
      pointerId: event.pointerId,
      startWorld: getWorldPointFromClient(event),
      originalShape: shape,
      latestShape: shape,
    };
    setSelection({ selectedAnnotationId: shapeId });
    setEditableShapeId(shapeId);
    setEditableDimensionId(undefined);
  }

  function handleMoveShapeUpdate(shapeId: string, handle: BasicShapeHandle, event: React.PointerEvent<SVGElement>) {
    const move = shapeMoveRef.current;
    if (!move || move.shapeId !== shapeId || move.handle !== handle || move.pointerId !== event.pointerId) return;

    const rawWorldPoint = getWorldPointFromClient(event);
    const snap = snapBasicShapeEditPoint(rawWorldPoint, shapeId);
    const worldPoint = snap.point;
    const updatedShape = updateBasicShapeGeometry(move.originalShape, handle, move.startWorld, worldPoint);
    shapeMoveRef.current = { ...move, latestShape: updatedShape };
    setSnapPreview(snap.type ? snap : undefined);
    setAnnotations((items) => items.map((item) => (item.id === shapeId ? updatedShape : item)));
  }

  async function handleMoveShapeEnd(shapeId: string, handle: BasicShapeHandle, event: React.PointerEvent<SVGElement>) {
    const move = shapeMoveRef.current;
    if (!move || move.shapeId !== shapeId || move.handle !== handle || move.pointerId !== event.pointerId) return;
    shapeMoveRef.current = undefined;
    setSnapPreview(undefined);

    try {
      await saveAnnotation(move.latestShape);
    } catch (error) {
      console.error("[ForteStack] object move autosave failed", error);
    }
  }

  function updateBasicShapeGeometry(
    shape: RectangleAnnotation | CircleAnnotation,
    handle: BasicShapeHandle,
    startWorld: Point,
    worldPoint: Point,
  ) {
    const delta = {
      x: worldPoint.x - startWorld.x,
      y: worldPoint.y - startWorld.y,
    };

    if (shape.type === "circle") {
      if (handle === "radius") {
        return {
          ...shape,
          radius: Math.max(4 / transform.scale, Math.hypot(worldPoint.x - shape.cx, worldPoint.y - shape.cy)),
          updatedAt: new Date().toISOString(),
        };
      }

      return {
        ...shape,
        cx: shape.cx + delta.x,
        cy: shape.cy + delta.y,
        updatedAt: new Date().toISOString(),
      };
    }

    if (handle === "move") {
      return {
        ...shape,
        x: shape.x + delta.x,
        y: shape.y + delta.y,
        updatedAt: new Date().toISOString(),
      };
    }

    const left = shape.x;
    const right = shape.x + shape.width;
    const top = shape.y;
    const bottom = shape.y + shape.height;
    const nextLeft = handle === "topLeft" || handle === "bottomLeft" ? worldPoint.x : left;
    const nextRight = handle === "topRight" || handle === "bottomRight" ? worldPoint.x : right;
    const nextTop = handle === "topLeft" || handle === "topRight" ? worldPoint.y : top;
    const nextBottom = handle === "bottomLeft" || handle === "bottomRight" ? worldPoint.y : bottom;
    const minSize = 8 / transform.scale;
    const x = Math.min(nextLeft, nextRight);
    const y = Math.min(nextTop, nextBottom);

    return {
      ...shape,
      x,
      y,
      width: Math.max(minSize, Math.abs(nextRight - nextLeft)),
      height: Math.max(minSize, Math.abs(nextBottom - nextTop)),
      updatedAt: new Date().toISOString(),
    };
  }

  function handleSelectAnnotation(annotationId: string) {
    if (activeTool !== "browse") {
      pushDebugEvent(`measurement select ignored; activeTool=${activeTool}`);
      return;
    }
    console.log("[ForteStack] measurement selected", { annotationId });
    pushDebugEvent(`measurement selected ${annotationId.slice(-5)}`);
    setSelection({ selectedAnnotationId: annotationId });
    if (editableObjectId && editableObjectId !== annotationId) setEditableObjectId(undefined);
    if (editingNoteTextId && editingNoteTextId !== annotationId) setEditingNoteTextId(undefined);
    if (editableShapeId && editableShapeId !== annotationId) setEditableShapeId(undefined);
    if (editableDimensionId && editableDimensionId !== annotationId) setEditableDimensionId(undefined);
  }

  function handleEditAnnotation(annotationId: string) {
    if (activeTool !== "browse") return;
    cancelPanZoomGesture();
    setSelection({ selectedAnnotationId: annotationId });
    const annotation = annotations.find((item) => item.id === annotationId);
    if (annotation?.type === "room") {
      setIsRectEditorOpen(false);
      setIsRoomEditorCollapsed(true);
    } else if (annotation?.type === "dimension") {
      setEditableDimensionId(annotation.id);
      setEditableShapeId(undefined);
    } else if (annotation?.type === "rectangle" || annotation?.type === "circle") {
      setEditableShapeId(annotation.id);
      setEditableDimensionId(undefined);
      setIsRectangleEditorOpen(false);
    } else if (annotation?.type === "door") {
      setEditableShapeId(undefined);
      setEditableDimensionId(undefined);
      setEditableObjectId(annotation.id);
    } else if (annotation?.type === "note") {
      if (editableObjectId === annotation.id) {
        setEditingNoteTextId(annotation.id);
      } else {
        setEditableObjectId(annotation.id);
      }
    } else if(annotation?.type==="image"){
      imageEditSnapshotRef.current=structuredClone(annotation);
      setEditableObjectId(annotation.id);
      setImageEditMode("distort");
    } else if(annotation?.type==="line"){
      setEditableObjectId(annotation.id);
    } else {
      setIsEditorOpen(true);
    }
  }

  function handleUnlockDimension(dimensionId: string) {
    console.log("[ForteStack] measurement edit UI opened", { dimensionId, activeTool });
    cancelPanZoomGesture();
    const exists = annotations.some((annotation) => annotation.type === "dimension" && annotation.id === dimensionId);
    pushDebugEvent(`handleUnlockDimension called ${dimensionId.slice(-5)} exists=${exists}`);
    suppressNextViewportClickRef.current = true;
    creationPointer.current = undefined;
    updateDraft({ step: "idle" });
    updateRectDraft({ step: "idle" });
    setActiveTool("browse");
    setSelection({ selectedAnnotationId: dimensionId });
    pushDebugEvent(`measurement selected ${dimensionId.slice(-5)}`);
    setEditableDimensionId(dimensionId);
    setEditableShapeId(undefined);
    setIsEditorOpen(false);
    setActiveRoomEdge(undefined);
    setSnapPreview(undefined);
    setDimensionSnapIndicator(undefined);
    setIsRoomEditorCollapsed(false);
    setIsRectEditorOpen(false);
  }

  function openDimensionEditor(dimensionId: string) {
    setSelection({ selectedAnnotationId: dimensionId });
    setEditableDimensionId(undefined);
    setIsEditorOpen(true);
  }

  function openRoomEditor(roomId: string) {
    setSelection({ selectedAnnotationId: roomId });
    setIsRoomEditorCollapsed(false);
    setIsRectEditorOpen(true);
  }

  function requestDeleteSelected() {
    if (selectedDimension && editableDimensionId === selectedDimension.id) {
      setDeletePrompt({ type: "dimension", id: selectedDimension.id });
      return;
    }

    if (selectedRect) {
      setDeletePrompt({ type: "room", id: selectedRect.id });
      return;
    }

    if (selectedShape) {
      setDeletePrompt({ type: selectedShape.type, id: selectedShape.id });
      return;
    }

    if (selectedDoor) {
      setDeletePrompt({ type: "door", id: selectedDoor.id });
      return;
    }
    if (selectedNote) {
      setDeletePrompt({ type: "note", id: selectedNote.id });
      return;
    }
    if(selectedImage){
      setDeletePrompt({type:"image",id:selectedImage.id});
      return;
    }
    if(selectedLine){
      setDeletePrompt({type:"line",id:selectedLine.id});
    }
  }

  async function confirmDeletePrompt() {
    const prompt = deletePrompt;
    if (!prompt) return;
    setDeletePrompt(undefined);

    if (prompt.type === "dimension") {
      await handleDeleteDimension(prompt.id);
    } else if (prompt.type === "rectangle" || prompt.type === "circle" || prompt.type === "door") {
      await handleDeleteBasicShape(prompt.id);
    } else {
      await handleDeleteRect(prompt.id);
    }
  }

  async function handleConfirmDimension(value: string) {
    const pending = pendingDimensionRef.current ?? pendingDimension;
    if (!pending) return;

    await createAndSaveDimension(pending, value);
  }

  async function createAndSaveDimension(
    pending: NonNullable<typeof pendingDimension>,
    value: string,
  ) {
    const dimension = createDimensionAnnotation({
      ...pending,
      value,
    });
    dimension.layerId=activeLayerId;
    const scale = currentDrawing.scale ?? createScaleFromDimension(dimension);

    setAnnotations((items) => [...items, dimension]);
    updatePendingDimension(undefined);
    setPendingDimensionInitialValue("");
    updateDraft({ step: "idle" });
    setActiveRoomEdge(undefined);
    setSnapPreview(undefined);
    setDimensionSnapIndicator(undefined);
    setIsValueSheetOpen(false);
    setActiveTool("browse");

    try {
      if (!currentDrawing.scale && scale) {
        const updatedDrawing = await updateDrawingScale(currentDrawing, {
          ...scale,
          calibratedFrom: { type: "dimension", id: dimension.id },
        });
        setCurrentDrawing(updatedDrawing);
      }
      await saveAnnotation(dimension);
    } catch (error) {
      console.error("[ForteStack] dimension autosave failed", error);
    }
  }

  async function createAndSavePlacedObject(type: PlaceableObjectType, rect: ReturnType<typeof normalizeRect>) {
    const definition = drawingObjectDefinitions.find((item) => item.type === type && item.enabled);
    const created = definition?.createDefault({
      drawingId: currentDrawing.id,
      ...rect,
    });
    if (!created) return;
    const annotation={...created,layerId:activeLayerId} as Annotation;
    if(annotation.type==="note"){annotation.boxWidth=Math.max(70,rect.width*transform.scale);annotation.boxHeight=Math.max(36,rect.height*transform.scale);annotation.hasLeader=false;annotation.textPosition={x:rect.x+rect.width/2,y:rect.y+rect.height/2};annotation.anchor=annotation.textPosition}

    setAnnotations((items) => [...items, annotation]);
    setSelection({selectedAnnotationId:annotation.id});
    if(annotation.type==="note"){setEditableObjectId(annotation.id);setEditingNoteTextId(annotation.id)}else if(annotation.type==="door")setEditableObjectId(annotation.id);
    updateRectDraft({ step: "idle" });
    setPlacingObjectType(undefined);
    setActiveTool("browse");
    setSnapPreview(undefined);
    setIsAddPickerOpen(false);

    try {
      await saveAnnotation(annotation);
    } catch (error) {
      console.error("[ForteStack] object autosave failed", error);
    }
  }

  function applyJoinsForRoomInAnnotations(items: Annotation[], roomId: string) {
    const rooms = items.filter((annotation): annotation is RoomAnnotation => annotation.type === "room");
    const refreshedRooms = refreshRoomJoinsForRoom(rooms, roomId, getJoinToleranceWorld());
    const roomLookup = new Map(refreshedRooms.map((room) => [room.id, room]));

    return items.map((item) => (item.type === "room" ? roomLookup.get(item.id) ?? item : item));
  }

  function clearJoinsForRoomInAnnotations(items: Annotation[], roomId: string) {
    const rooms = items.filter((annotation): annotation is RoomAnnotation => annotation.type === "room");
    const refreshedRooms = clearRoomJoinsForRoom(rooms, roomId);
    const roomLookup = new Map(refreshedRooms.map((room) => [room.id, room]));

    return items.map((item) => (item.type === "room" ? roomLookup.get(item.id) ?? item : item));
  }

  function hasJoinOpportunityInAnnotations(items: Annotation[], roomId: string) {
    const rooms = items.filter((annotation): annotation is RoomAnnotation => annotation.type === "room");
    return hasRoomJoinOpportunity(rooms, roomId, getJoinToleranceWorld());
  }

  function getJoinToleranceWorld() {
    return 8 / transform.scale;
  }

  function maybeOfferRoomJoin(items: Annotation[], roomId: string) {
    if (hasJoinOpportunityInAnnotations(items, roomId)) {
      setJoinProposal({ roomId });
      setIsJoinPromptOpen(true);
    } else {
      setJoinProposal(undefined);
      setIsJoinPromptOpen(false);
    }
  }

  async function acceptRoomJoin() {
    const proposal = joinProposal;
    if (!proposal) return;
    const joined = applyJoinsForRoomInAnnotations(annotations, proposal.roomId);
    const source = joined.find((item): item is RoomAnnotation => item.type === "room" && item.id === proposal.roomId);
    const joinedIds = getJoinedRoomIds(joined, proposal.roomId);
    const joinedAnnotations = source ? joined.map((item) => item.type === "room" && joinedIds.has(item.id) ? { ...item, fillColour: source.fillColour ?? "#ffffff", updatedAt: new Date().toISOString() } : item) : joined;
    setAnnotations(joinedAnnotations);
    setJoinProposal(undefined);
    setIsJoinPromptOpen(false);
    await persistRoomsFromAnnotations(joinedAnnotations);
  }

  function declineRoomJoin() {
    setJoinProposal(undefined);
    setIsJoinPromptOpen(false);
  }

  async function persistRoomsFromAnnotations(items: Annotation[]) {
    const rooms = items.filter((annotation): annotation is RoomAnnotation => annotation.type === "room");
    await Promise.all(rooms.map((room) => saveAnnotation(room)));
  }

  async function handleUpdateDimension(dimension: DimensionAnnotation) {
    console.log("[ForteStack] measurement value submitted", {
      dimensionId: dimension.id,
      value: dimension.value,
    });
    await saveAnnotation(dimension);
    setAnnotations((items) => items.map((item) => (item.id === dimension.id ? dimension : item)));
    pushDebugEvent(`state updated ${dimension.id.slice(-5)}`);
    pushDebugEvent(`persistence completed ${dimension.id.slice(-5)}`);
    console.log("[ForteStack] measurement state updated and persistence completed", {
      dimensionId: dimension.id,
    });
  }

  async function handleConfirmRect(values: { internalWidth: string; internalHeight: string; label?: string }) {
    const rect = pendingRectRef.current;
    if (!rect) return;
    const existingScale = currentDrawing.scale;
    const pendingScale = existingScale ?? createScaleFromRoomRect(rect, values.internalWidth, values.internalHeight);
    const mmPerWorldUnit = pendingScale?.mmPerWorldUnit;
    const calibratedRect = getCalibratedRoomRect({
      roughRect: rect,
      internalWidth: values.internalWidth,
      internalHeight: values.internalHeight,
      mmPerWorldUnit,
    });
    const annotation = createRoomAnnotation({
      drawingId: currentDrawing.id,
      ...calibratedRect,
      internalWidth: values.internalWidth,
      internalHeight: values.internalHeight,
      label: values.label,
    });
    annotation.layerId=activeLayerId;
    const nextAnnotations = [...annotations, annotation];

    setAnnotations(nextAnnotations);
    pendingRectRef.current = undefined;
    setJoinProposal(undefined);
    setPendingRoomInitialValues({ width: "", height: "" });
    updateRectDraft({ step: "idle" });
    setIsRectValueSheetOpen(false);
    setPlacingObjectType(undefined);
    setActiveTool("browse");

    try {
      if (!existingScale && pendingScale) {
        const updatedDrawing = await updateDrawingScale(currentDrawing, {
          ...pendingScale,
          calibratedFrom: { type: "room", id: annotation.id },
        });
        setCurrentDrawing(updatedDrawing);
      }
      await persistRoomsFromAnnotations(nextAnnotations);
      maybeOfferRoomJoin(nextAnnotations, annotation.id);
    } catch (error) {
      console.error("[ForteStack] room box autosave failed", error);
    }
  }

  async function handleUpdateRect(rect: RoomAnnotation) {
    const original = annotations.find(
      (annotation): annotation is RoomAnnotation => annotation.type === "room" && annotation.id === rect.id,
    );
    const updated = currentDrawing.scale
      ? resizeRoomToDimensions(rect, {
          internalWidth: rect.internalWidth,
          internalHeight: rect.internalHeight,
          mmPerWorldUnit: currentDrawing.scale.mmPerWorldUnit,
        })
      : rect;
    const joinedIds = getJoinedRoomIds(annotations, rect.id);
    const fillChanged = (original?.fillColour ?? "#ffffff") !== (updated.fillColour ?? "#ffffff");
    const dimensionsChanged = Boolean(original && (original.internalWidth !== updated.internalWidth || original.internalHeight !== updated.internalHeight));
    if (original && !dimensionsChanged) {
      const now = new Date().toISOString();
      const nextAnnotations = annotations.map((item) => {
        if (item.id === updated.id) return { ...updated, updatedAt: now };
        if (fillChanged && item.type === "room" && joinedIds.has(item.id)) return { ...item, fillColour: updated.fillColour ?? "#ffffff", updatedAt: now };
        return item;
      });
      await persistRoomsFromAnnotations(nextAnnotations);
      setAnnotations(nextAnnotations);
      return;
    }
    const fillSynchronized = annotations.map((item) => fillChanged && item.type === "room" && joinedIds.has(item.id) ? { ...item, fillColour: updated.fillColour ?? "#ffffff", updatedAt: new Date().toISOString() } : item);
    const remappedAnnotations = original ? remapDimensionsForRoomChange(original, updated, fillSynchronized) : fillSynchronized;
    const updatedAnnotations = clearJoinsForRoomInAnnotations(
      remappedAnnotations.map((item) => (item.id === updated.id ? updated : item)),
      updated.id,
    );
    const changedDimensions = updatedAnnotations.filter(
      (annotation): annotation is DimensionAnnotation => annotation.type === "dimension",
    );

    await Promise.all(changedDimensions.map((dimension) => saveAnnotation(dimension)));
    await persistRoomsFromAnnotations(updatedAnnotations);
    setAnnotations(updatedAnnotations);
    maybeOfferRoomJoin(updatedAnnotations, updated.id);
  }

  function getJoinedRoomIds(items: Annotation[], roomId: string) {
    const rooms = new Map(items.filter((item): item is RoomAnnotation => item.type === "room").map((room) => [room.id, room]));
    const found = new Set<string>([roomId]);
    const pending = [roomId];
    while (pending.length) {
      const current = rooms.get(pending.pop()!);
      if (!current) continue;
      const neighbours = current.walls.flatMap((wall) => [wall.joinedToRoomId, ...(wall.joinedSegments?.map((segment) => segment.joinedToRoomId) ?? [])]).filter((id): id is string => Boolean(id));
      for (const id of neighbours) if (!found.has(id)) { found.add(id); pending.push(id); }
    }
    return found;
  }

  async function handleDeleteRect(rectId: string) {
    await deleteAnnotation(rectId);
    const nextAnnotations = clearJoinsForRoomInAnnotations(annotations.filter((item) => item.id !== rectId), rectId);
    await persistRoomsFromAnnotations(nextAnnotations);
    setAnnotations(nextAnnotations);
    setSelection({});
    setDeletePrompt(undefined);
    setIsRectEditorOpen(false);
    setIsRoomEditorCollapsed(false);
  }

  async function handleDeleteDimension(dimensionId: string) {
    await deleteAnnotation(dimensionId);
    setAnnotations((items) => items.filter((item) => item.id !== dimensionId));
    setSelection({});
    setDeletePrompt(undefined);
    setEditableDimensionId(undefined);
    setIsEditorOpen(false);
  }

  async function handleDeleteBasicShape(shapeId: string) {
    await deleteAnnotation(shapeId);
    setAnnotations((items) => items.filter((item) => item.id !== shapeId));
    setSelection({});
    setDeletePrompt(undefined);
    setEditableShapeId(undefined);
    setIsRectangleEditorOpen(false);
    setIsDoorEditorOpen(false);
  }

  async function handleUpdateRectangle(rectangle: RectangleAnnotation) {
    setAnnotations((items) => items.map((item) => (item.id === rectangle.id ? rectangle : item)));

    try {
      await saveAnnotation(rectangle);
    } catch (error) {
      console.error("[ForteStack] rectangle autosave failed", error);
    }
  }

  async function handleUpdateDoor(door: DoorAnnotation) {
    setAnnotations((items) => items.map((item) => (item.id === door.id ? door : item)));

    try {
      await saveAnnotation(door);
    } catch (error) {
      console.error("[ForteStack] door autosave failed", error);
    }
  }

  async function handleUpdateNote(note: NoteAnnotation) {
    setAnnotations(items=>items.map(item=>item.id===note.id?note:item));
    try { await saveAnnotation(note); } catch(error) { console.error("[ForteStack] note autosave failed",error); }
  }

  async function handleLayersChange(nextLayers:typeof layers,nextActive:string){
    if(nextActive!==activeLayerId){setSelection({});setEditableObjectId(undefined);setEditableShapeId(undefined);setEditableDimensionId(undefined);setIsImageAdjusting(false);}
    const removed=new Set(layers.filter(layer=>!nextLayers.some(next=>next.id===layer.id)).map(layer=>layer.id));
    if(removed.size){const reassigned=annotations.map(item=>removed.has(item.layerId)?{...item,layerId:nextActive,updatedAt:new Date().toISOString()} as Annotation:item);setAnnotations(reassigned);await Promise.all(reassigned.filter(item=>removed.has(annotations.find(old=>old.id===item.id)?.layerId??"")).map(saveAnnotation));}
    setCurrentDrawing({...currentDrawing,layers:nextLayers,activeLayerId:nextActive,updatedAt:new Date().toISOString()});
    const updated=await updateDrawingLayers(currentDrawing,nextLayers,nextActive);setCurrentDrawing(updated);
  }

  function handleLineNodeStart(lineId:string,nodeId:string,event:React.PointerEvent<SVGCircleElement>){const line=annotations.find((item):item is LineAnnotation=>item.type==="line"&&item.id===lineId),node=line?.nodes.find(item=>item.id===nodeId);if(!line||!node||node.locked)return;lineNodeMoveRef.current={lineId,nodeId,pointerId:event.pointerId,latest:line}}
  function handleLineNodeUpdate(lineId:string,nodeId:string,event:React.PointerEvent<SVGCircleElement>){const move=lineNodeMoveRef.current;if(!move||move.lineId!==lineId||move.nodeId!==nodeId||move.pointerId!==event.pointerId)return;const raw=getWorldPointFromClient(event);const snapped=snapPoint({point:raw,annotations,excludeAnnotationId:lineId,mmPerWorldUnit,referencePoints,settings:snapSettings,transform});const latest={...move.latest,nodes:move.latest.nodes.map(node=>node.id===nodeId?{...node,...snapped.point}:node),updatedAt:new Date().toISOString()};move.latest=latest;setSnapPreview(snapped.type?snapped:undefined);setAnnotations(items=>items.map(item=>item.id===lineId?latest:item))}
  async function handleLineNodeEnd(lineId:string,nodeId:string,event:React.PointerEvent<SVGCircleElement>){const move=lineNodeMoveRef.current;if(!move||move.lineId!==lineId||move.nodeId!==nodeId||move.pointerId!==event.pointerId)return;lineNodeMoveRef.current=undefined;setSnapPreview(undefined);await saveAnnotation(move.latest)}
  function handleLineMeasurementStart(lineId:string,segmentId:string,event:React.PointerEvent<SVGTextElement>){const line=annotations.find((item):item is LineAnnotation=>item.type==="line"&&item.id===lineId),segment=line?.segments.find(item=>item.id===segmentId),a=segment&&line?.nodes.find(node=>node.id===segment.startNodeId),b=segment&&line?.nodes.find(node=>node.id===segment.endNodeId),rect=viewportRef.current?.getBoundingClientRect();if(!line||!a||!b||!rect)return;cancelPanZoomGesture();lineMeasurementMoveRef.current={lineId,segmentId,pointerId:event.pointerId,midX:(a.x+b.x)/2*transform.scale+transform.translateX+rect.left,midY:(a.y+b.y)/2*transform.scale+transform.translateY+rect.top,latest:line}}
  function handleLineMeasurementUpdate(lineId:string,segmentId:string,event:React.PointerEvent<SVGTextElement>){const move=lineMeasurementMoveRef.current;if(!move||move.lineId!==lineId||move.segmentId!==segmentId||move.pointerId!==event.pointerId)return;const dx=event.clientX-move.midX,dy=event.clientY-move.midY,raw=Math.hypot(dx,dy),distance=Math.min(120,20+Math.sqrt(Math.max(0,raw-20))*4.5),angle=Math.atan2(dy,dx),latest={...move.latest,segments:move.latest.segments.map(segment=>segment.id===segmentId?{...segment,measurementAngle:angle,measurementDistancePx:distance}:segment),updatedAt:new Date().toISOString()};move.latest=latest;setAnnotations(items=>items.map(item=>item.id===lineId?latest:item))}
  async function handleLineMeasurementEnd(lineId:string,segmentId:string,event:React.PointerEvent<SVGTextElement>){const move=lineMeasurementMoveRef.current;if(!move||move.lineId!==lineId||move.segmentId!==segmentId||move.pointerId!==event.pointerId)return;lineMeasurementMoveRef.current=undefined;await saveAnnotation(move.latest)}
  async function handleEditLineLength(lineId:string,segmentId:string){const line=annotations.find((item):item is LineAnnotation=>item.type==="line"&&item.id===lineId);if(!line)return;const current=Math.round(segmentLength(line,segmentId)*mmPerWorldUnit);const value=window.prompt("Segment length (mm)",String(current));if(value===null)return;const mm=Number.parseFloat(value);if(!Number.isFinite(mm)||mm<=0){window.alert("Enter a valid length greater than zero.");return}const result=setSegmentLength(line,segmentId,mm/mmPerWorldUnit);if(!result.ok){window.alert(result.reason);return}setAnnotations(items=>items.map(item=>item.id===lineId?result.line:item));await saveAnnotation(result.line)}
  async function handleEditLineAngle(lineId:string,nodeId:string){const line=annotations.find((item):item is LineAnnotation=>item.type==="line"&&item.id===lineId);if(!line)return;const current=cornerAngle(line,nodeId);if(current===undefined)return;const value=window.prompt("Joint angle (degrees)",String(Math.round(current)));if(value===null)return;const degrees=Number.parseFloat(value);const result=setCornerAngle(line,nodeId,degrees);if(!result.ok){window.alert(result.reason);return}setAnnotations(items=>items.map(item=>item.id===lineId?result.line:item));await saveAnnotation(result.line)}
  async function updateLineDisplay(patch:Partial<Pick<LineAnnotation,"showAngles"|"showMeasurements">>){if(!selectedLine)return;const next={...selectedLine,...patch,updatedAt:new Date().toISOString()};setAnnotations(items=>items.map(item=>item.id===next.id?next:item));await saveAnnotation(next)}

  function insertJunction(line:LineAnnotation,segmentId:string){const index=line.segments.findIndex(segment=>segment.id===segmentId),segment=line.segments[index];if(index<0||!segment)return;const a=line.nodes.find(node=>node.id===segment.startNodeId),b=line.nodes.find(node=>node.id===segment.endNodeId);if(!a||!b)return;const node={id:crypto.randomUUID(),x:(a.x+b.x)/2,y:(a.y+b.y)/2,locked:false};return{...line,nodeOrder:[...line.nodeOrder.slice(0,index+1),node.id,...line.nodeOrder.slice(index+1)],nodes:[...line.nodes,node],segments:[...line.segments.slice(0,index),{id:crypto.randomUUID(),startNodeId:a.id,endNodeId:node.id},{id:crypto.randomUUID(),startNodeId:node.id,endNodeId:b.id},...line.segments.slice(index+1)],updatedAt:new Date().toISOString()};}
  async function addSelectedLineJunction(){if(!selectedLine||!selectedLineSegmentId)return;const next=insertJunction(selectedLine,selectedLineSegmentId);if(!next)return;setAnnotations(items=>items.map(item=>item.id===next.id?next:item));setSelectedLineSegmentId(undefined);await saveAnnotation(next);}
  async function breakSelectedLine(){if(!selectedLine||!selectedLineSegmentId)return;const withJunction=insertJunction(selectedLine,selectedLineSegmentId);if(!withJunction)return;const index=selectedLine.segments.findIndex(segment=>segment.id===selectedLineSegmentId),nodeId=withJunction.nodeOrder[index+1],parts=breakLineAtNode(withJunction,nodeId,()=>crypto.randomUUID());if(!parts)return;await deleteAnnotation(selectedLine.id);await Promise.all(parts.map(saveAnnotation));setAnnotations(items=>[...items.filter(item=>item.id!==selectedLine.id),...parts]);setSelection({selectedAnnotationId:parts[0].id});setEditableObjectId(parts[0].id);setSelectedLineSegmentId(undefined);}
  async function deleteSelectedLineSegment(){if(!selectedLine||!selectedLineSegmentId)return;const index=selectedLine.segments.findIndex(segment=>segment.id===selectedLineSegmentId);if(index<0)return;const orders=[selectedLine.nodeOrder.slice(0,index+1),selectedLine.nodeOrder.slice(index+1)].filter(order=>order.length>=2);const make=(order:string[]):LineAnnotation=>{const ids=new Set(order);return{...selectedLine,id:crypto.randomUUID(),nodeOrder:order,nodes:selectedLine.nodes.filter(node=>ids.has(node.id)),segments:selectedLine.segments.filter(segment=>ids.has(segment.startNodeId)&&ids.has(segment.endNodeId)),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}};const parts=orders.map(make);await deleteAnnotation(selectedLine.id);await Promise.all(parts.map(saveAnnotation));setAnnotations(items=>[...items.filter(item=>item.id!==selectedLine.id),...parts]);setSelectedLineSegmentId(undefined);setEditableObjectId(parts[0]?.id);setSelection(parts[0]?{selectedAnnotationId:parts[0].id}:{});}

  async function handleImageSelected(event:React.ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];if(!file)return;const asset=await createImageAsset(project.id,file);await saveAsset(asset);
    const maxWorld=600/transform.scale,ratio=Math.min(1,maxWorld/Math.max(asset.width,asset.height));
    const width=asset.width*ratio,height=asset.height*ratio;
    const image=createImageAnnotation({drawingId:currentDrawing.id,assetId:asset.id,layerId:activeLayerId,position:{x:centerWorld.x-width/2,y:centerWorld.y-height/2},width,height});
    await saveAnnotation(image);setAnnotations(items=>[...items,image]);setSelection({selectedAnnotationId:image.id});setEditableObjectId(undefined);event.target.value="";
  }

  function handleImageStart(id:string,handle:ImageEditHandle,event:React.PointerEvent<SVGElement>){const image=annotations.find((a):a is ImageAnnotation=>a.type==="image"&&a.id===id);if(!image)return;setIsImageAdjusting(true);const point=getWorldPointFromClient(event),current=imageMoveRef.current;if(handle==="move"&&current?.id===id&&current.handle==="move"&&current.pointers){current.pointers.set(event.pointerId,point);const points=[...current.pointers.values()];if(points.length===2){current.baseDistance=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y);current.baseImage=current.latest}return}imageMoveRef.current={id,handle,pointerId:event.pointerId,startWorld:point,original:image,latest:image,pointers:handle==="move"?new Map([[event.pointerId,point]]):undefined}}
  function handleImageUpdate(id:string,handle:ImageEditHandle,event:React.PointerEvent<SVGElement>){const move=imageMoveRef.current;if(!move||move.id!==id||move.handle!==handle)return;const p=getWorldPointFromClient(event);if(handle==="move"&&move.pointers){if(!move.pointers.has(event.pointerId))return;move.pointers.set(event.pointerId,p);const points=[...move.pointers.values()];if(points.length>=2&&move.baseDistance&&move.baseImage){const factor=Math.max(.08,Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)/move.baseDistance),base=move.baseImage,corners=getImageCorners(base),center=corners.reduce((sum,point)=>({x:sum.x+point.x/4,y:sum.y+point.y/4}),{x:0,y:0}),latest={...base,corners:corners.map(point=>({x:center.x+(point.x-center.x)*factor,y:center.y+(point.y-center.y)*factor})) as [Point,Point,Point,Point],updatedAt:new Date().toISOString()};move.latest=latest;setAnnotations(items=>items.map(item=>item.id===id?latest:item));return}}if(move.pointerId!==event.pointerId)return;const dx=p.x-move.startWorld.x,dy=p.y-move.startWorld.y,corners=getImageCorners(move.original);let latest:ImageAnnotation;
    if(handle==="move")latest={...move.original,corners:corners.map(point=>({x:point.x+dx,y:point.y+dy})) as [Point,Point,Point,Point],cropRect:move.original.cropRect?{...move.original.cropRect,x:move.original.cropRect.x+dx,y:move.original.cropRect.y+dy}:undefined,position:{x:move.original.position.x+dx,y:move.original.position.y+dy},updatedAt:new Date().toISOString()};
    else if(handle.startsWith("corner")){const index=Number(handle.slice(-1));latest={...move.original,corners:corners.map((point,i)=>i===index?p:point) as [Point,Point,Point,Point],updatedAt:new Date().toISOString()};}
    else if(handle.startsWith("crop")){const index=Number(handle.slice(-1)),rect=move.original.cropRect??largestCenteredSquare(corners),right=rect.x+rect.width,bottom=rect.y+rect.height,min=12/transform.scale;let left=rect.x,top=rect.y,nextRight=right,nextBottom=bottom;if(index===0){left=Math.min(p.x,right-min);top=Math.min(p.y,bottom-min)}else if(index===1){nextRight=Math.max(p.x,left+min);top=Math.min(p.y,bottom-min)}else if(index===2){nextRight=Math.max(p.x,left+min);nextBottom=Math.max(p.y,top+min)}else{left=Math.min(p.x,right-min);nextBottom=Math.max(p.y,top+min)}latest={...move.original,cropRect:{x:left,y:top,width:nextRight-left,height:nextBottom-top},updatedAt:new Date().toISOString()};}
    else {const center=corners.reduce((sum,point)=>({x:sum.x+point.x/4,y:sum.y+point.y/4}),{x:0,y:0}),startAngle=Math.atan2(move.startWorld.y-center.y,move.startWorld.x-center.x),angle=Math.atan2(p.y-center.y,p.x-center.x)-startAngle,cos=Math.cos(angle),sin=Math.sin(angle);latest={...move.original,corners:corners.map(point=>({x:center.x+(point.x-center.x)*cos-(point.y-center.y)*sin,y:center.y+(point.x-center.x)*sin+(point.y-center.y)*cos})) as [Point,Point,Point,Point],updatedAt:new Date().toISOString()}}
    move.latest=latest;setAnnotations(items=>items.map(item=>item.id===id?latest:item));}
  async function handleImageEnd(id:string,handle:ImageEditHandle,event:React.PointerEvent<SVGElement>){const move=imageMoveRef.current;if(!move||move.id!==id||move.handle!==handle)return;if(handle==="move"&&move.pointers){move.pointers.delete(event.pointerId);if(move.pointers.size){const [pointerId,point]=[...move.pointers.entries()][0];move.pointerId=pointerId;move.startWorld=point;move.original=move.latest;move.baseDistance=undefined;move.baseImage=undefined;return}}else if(move.pointerId!==event.pointerId)return;imageMoveRef.current=undefined;setIsImageAdjusting(false);await saveAnnotation(move.latest)}
  async function rotateSelectedImage(delta:number){if(!selectedImage)return;const corners=getImageCorners(selectedImage),center=corners.reduce((sum,point)=>({x:sum.x+point.x/4,y:sum.y+point.y/4}),{x:0,y:0}),angle=delta*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),next={...selectedImage,corners:corners.map(point=>({x:center.x+(point.x-center.x)*cos-(point.y-center.y)*sin,y:center.y+(point.x-center.x)*sin+(point.y-center.y)*cos})) as [Point,Point,Point,Point],updatedAt:new Date().toISOString()};setAnnotations(items=>items.map(i=>i.id===next.id?next:i));await saveAnnotation(next)}
  async function startImageCrop(){if(!selectedImage)return;let next=selectedImage;if(!selectedImage.cropRect){next={...selectedImage,cropRect:largestCenteredSquare(getImageCorners(selectedImage)),updatedAt:new Date().toISOString()};setAnnotations(items=>items.map(item=>item.id===next.id?next:item));await saveAnnotation(next)}setImageEditMode("crop")}
  async function cancelImageEditing(){const snapshot=imageEditSnapshotRef.current;if(snapshot){const restored={...snapshot,updatedAt:new Date().toISOString()};setAnnotations(items=>items.map(item=>item.id===restored.id?restored:item));await saveAnnotation(restored)}imageEditSnapshotRef.current=undefined;imageMoveRef.current=undefined;setEditableObjectId(undefined);setIsImageAdjusting(false)}
  function finishImageEditing(){imageEditSnapshotRef.current=undefined;imageMoveRef.current=undefined;setEditableObjectId(undefined);setIsImageAdjusting(false)}

  function handleNoteTextChange(id: string, text: string) {
    setAnnotations((items) => items.map((item) => item.id === id && item.type === "note" ? { ...item, text, updatedAt: new Date().toISOString() } : item));
  }

  async function handleNoteTextCommit(id: string) {
    setEditingNoteTextId(undefined);
    const note = annotations.find((item): item is NoteAnnotation => item.type === "note" && item.id === id);
    if (note) await saveAnnotation(note);
  }

  function handleObjectMoveStart(id:string, handle:DoorEditHandle|NoteEditHandle, event:React.PointerEvent<SVGElement>) {
    const original=annotations.find((a):a is DoorAnnotation|NoteAnnotation=>(a.type==="door"||a.type==="note")&&a.id===id);
    if(!original)return;
    objectMoveRef.current={id,handle,pointerId:event.pointerId,startWorld:getWorldPointFromClient(event),original,latest:original};
    setSelection({selectedAnnotationId:id}); setEditableObjectId(id); cancelPanZoomGesture();
  }

  function handleObjectMoveUpdate(id:string, handle:DoorEditHandle|NoteEditHandle, event:React.PointerEvent<SVGElement>) {
    const move=objectMoveRef.current; if(!move||move.id!==id||move.handle!==handle||move.pointerId!==event.pointerId)return;
    const point=getWorldPointFromClient(event); let latest:DoorAnnotation|NoteAnnotation;
    if(move.original.type==="note") {
      if(handle==="resize"){const dx=(point.x-move.startWorld.x)*transform.scale,dy=(point.y-move.startWorld.y)*transform.scale;latest={...move.original,boxWidth:Math.max(70,(move.original.boxWidth??120)+dx*2),boxHeight:Math.max(36,(move.original.boxHeight??60)+dy*2),updatedAt:new Date().toISOString()}}
      else {const movesAnchor=handle==="anchor"||handle==="leader",originalPoint=movesAnchor?move.original.anchor:move.original.textPosition,leaderOffset=handle==="leader"?30/transform.scale:0;
      latest={...move.original,hasLeader:movesAnchor?true:move.original.hasLeader,[movesAnchor?"anchor":"textPosition"]:{x:originalPoint.x+point.x-move.startWorld.x,y:originalPoint.y+point.y-move.startWorld.y-leaderOffset},updatedAt:new Date().toISOString()};}
    }
    else if(handle==="rotate") latest={...move.original,rotation:Math.atan2(point.y-move.original.position.y,point.x-move.original.position.x)*180/Math.PI,attachedWallId:undefined,wallId:undefined,roomId:undefined,updatedAt:new Date().toISOString()};
    else {
      const rooms=annotations.filter((a):a is RoomAnnotation=>a.type==="room"); const wall=getNearestWallPlacement(point,rooms,32/transform.scale);
      latest={...move.original,position:wall?.point??point,rotation:wall?.rotation??move.original.rotation,attachedWallId:wall?.wallId,wallId:wall?.wallId,roomId:wall?.roomId,updatedAt:new Date().toISOString()};
    }
    objectMoveRef.current={...move,latest}; setAnnotations(items=>items.map(item=>item.id===id?latest:item));
  }

  async function handleObjectMoveEnd(id:string, handle:DoorEditHandle|NoteEditHandle, event:React.PointerEvent<SVGElement>) {
    if(handle==="flipHinge"||handle==="flipSwing") { const door=annotations.find((a):a is DoorAnnotation=>a.type==="door"&&a.id===id); if(!door)return; await handleUpdateDoor({...door,...(handle==="flipHinge"?{hingeSide:door.hingeSide==="start"?"end" as const:"start" as const}:{swingDirection:door.swingDirection===1?-1 as const:1 as const}),updatedAt:new Date().toISOString()}); return; }
    const move=objectMoveRef.current;if(!move||move.id!==id||move.handle!==handle||move.pointerId!==event.pointerId)return; objectMoveRef.current=undefined; await saveAnnotation(move.latest);
  }

  function createDoorFromPoint(point: Point) {
    const rooms=annotations.filter((a):a is RoomAnnotation=>a.type==="room");
    const wall=getNearestWallPlacement(point,rooms,48/transform.scale);
    return createDoorAnnotation({
      drawingId: currentDrawing.id,
      position: wall?.point ?? point,
      rotation: wall?.rotation ?? 0,
      roomId: wall?.roomId,
      wallId: wall?.wallId,
      widthMm: 820,
    });
  }

  async function createAndSaveDoor(door: DoorAnnotation) {
    door={...door,layerId:activeLayerId};
    setAnnotations((items) => [...items, door]);
    setSelection({ selectedAnnotationId: door.id });
    setPlacingObjectType(undefined);
    setActiveTool("browse");
    setActiveRoomEdge(undefined);
    setSnapPreview(undefined);
    setIsAddPickerOpen(false);
    setIsDoorEditorOpen(false);

    try {
      await saveAnnotation(door);
    } catch (error) {
      console.error("[ForteStack] door autosave failed", error);
    }
  }

  function getDefaultDoorWidth(start: Point, end: Point) {
    const wallLengthMm = Math.hypot(end.x - start.x, end.y - start.y) * mmPerWorldUnit;
    if (wallLengthMm < 950) return Math.max(600, Math.round(wallLengthMm * 0.72));
    return 820;
  }

  async function handleSnapSettingsChange(nextSettings: typeof snapSettings) {
    const updated = await updateDrawingSnapSettings(currentDrawing, nextSettings);
    setCurrentDrawing(updated);
  }

  async function handleResetDrawingScale() {
    const updated = await clearDrawingScale(currentDrawing);
    setCurrentDrawing(updated);
    setIsDrawingSettingsOpen(false);
  }

  function cancelActiveAction() {
    creationPointer.current = undefined;
    updatePendingDimension(undefined);
    setPendingDimensionInitialValue("");
    pendingRectRef.current = undefined;
    setJoinProposal(undefined);
    setPendingRoomInitialValues({ width: "", height: "" });
    updateDraft({ step: "idle" });
    updateRectDraft({ step: "idle" });
    setLineDraft({points:[]});
    setActiveRoomEdge(undefined);
    setEditableDimensionId(undefined);
    setEditableShapeId(undefined);
    setSnapPreview(undefined);
    setDimensionSnapIndicator(undefined);
    setIsValueSheetOpen(false);
    setIsRectValueSheetOpen(false);
    setIsJoinPromptOpen(false);
    setIsRoomEditorCollapsed(false);
    setIsAddPickerOpen(false);
    setIsRectangleEditorOpen(false);
    setIsDoorEditorOpen(false);
    setPlacingObjectType(undefined);
    setActiveTool("browse");
  }

  async function finishCreatedLine(line:LineAnnotation,joined?:LineAnnotation){if(joined)await deleteAnnotation(joined.id);await saveAnnotation(line);setAnnotations(items=>[...items.filter(item=>item.id!==joined?.id),line]);setSelection({selectedAnnotationId:line.id});setEditableObjectId(line.id);setLineDraft({points:[]});setSnapPreview(undefined);setPlacingObjectType(undefined);setActiveTool("browse");setLineJoinProposal(undefined)}
  async function confirmLineDraft(){if(lineDraft.points.length<2)return;const radius=20/transform.scale;for(const candidate of annotations){if(candidate.type!=="line"||candidate.layerId!==activeLayerId)continue;const existing=candidate.nodeOrder.map(id=>candidate.nodes.find(node=>node.id===id)!).filter(Boolean),ends=[existing[0],existing[existing.length-1]],draftEnds=[lineDraft.points[0],lineDraft.points[lineDraft.points.length-1]];for(let di=0;di<2;di++)for(let ei=0;ei<2;ei++)if(Math.hypot(draftEnds[di].x-ends[ei].x,draftEnds[di].y-ends[ei].y)<=radius){const a=ei===1?existing:[...existing].reverse(),b=di===0?lineDraft.points:[...lineDraft.points].reverse(),points=[...a.map(node=>({x:node.x,y:node.y})),...b.slice(1)],line=createLineAnnotation({drawingId:currentDrawing.id,layerId:activeLayerId,points});line.showAngles=candidate.showAngles;line.showMeasurements=candidate.showMeasurements;setLineJoinProposal({line,joined:candidate});return}}await finishCreatedLine(createLineAnnotation({drawingId:currentDrawing.id,layerId:activeLayerId,points:lineDraft.points}))}

  function getNearestRoomEdge(point: Point) {
    const radiusWorld = 48 / transform.scale;
    const matches: Array<NonNullable<typeof activeRoomEdge> & { distance: number }> = [];
    for (const annotation of annotations) {
      if (annotation.type !== "room") continue;
      const edge = getNearestRoomWall({ room: annotation, point, radiusWorld });
      if (!edge) continue;
      matches.push({
        start: edge.start,
        end: edge.end,
        value: edge.value,
        roomId: edge.room.id,
        wallId: edge.wall.id,
        distance: edge.distance,
      });
    }
    for(const annotation of annotations){if(annotation.type!=="line")continue;for(const segment of annotation.segments){const start=annotation.nodes.find(node=>node.id===segment.startNodeId),end=annotation.nodes.find(node=>node.id===segment.endNodeId);if(!start||!end)continue;const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy)||1,t=Math.max(0,Math.min(1,((point.x-start.x)*dx+(point.y-start.y)*dy)/(length*length))),distance=Math.hypot(point.x-(start.x+t*dx),point.y-(start.y+t*dy));if(distance<=radiusWorld)matches.push({start,end,value:`${Math.round(length*mmPerWorldUnit)} mm`,roomId:annotation.id,wallId:segment.id,distance})}}
    const match = matches.sort((first, second) => first.distance - second.distance)[0];
    return match
      ? {
          start: match.start,
          end: match.end,
          value: match.value,
          roomId: match.roomId,
          wallId: match.wallId,
        }
      : undefined;
  }

  function inferMeasurementValue(start: Point, end: Point) {
    const scale = currentDrawing.scale;
    if (!scale) return "";

    const worldLength = Math.hypot(end.x - start.x, end.y - start.y);
    const inferred = worldLength * scale.mmPerWorldUnit;
    if (!Number.isFinite(inferred) || inferred <= 0) return "";

    return String(Math.round(inferred));
  }

  function remapDimensionsForRoomChange(
    previousRoom: RoomAnnotation,
    nextRoom: RoomAnnotation,
    items: Annotation[],
  ) {
    const previousCorners = getRoomCorners(previousRoom);
    const nextCorners = getRoomCorners(nextRoom);
    const tolerance = 2 / transform.scale;

    return items.map((annotation) => {
      if (annotation.type !== "dimension") return annotation;
      const nextStart = remapPoint(annotation.start, previousCorners, nextCorners, tolerance);
      const nextEnd = remapPoint(annotation.end, previousCorners, nextCorners, tolerance);
      if (!nextStart && !nextEnd) return annotation;
      const updated = {
        ...annotation,
        start: nextStart ?? annotation.start,
        end: nextEnd ?? annotation.end,
      };
      return {
        ...updated,
        value: inferMeasurementValue(updated.start, updated.end) || annotation.value,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function remapPoint(
    point: Point,
    previousPoints: Point[],
    nextPoints: Point[],
    tolerance: number,
  ) {
    const matchIndex = previousPoints.findIndex(
      (candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= tolerance,
    );
    return matchIndex >= 0 ? nextPoints[matchIndex] : undefined;
  }

  function inferRoomDimensions(rect: ReturnType<typeof normalizeRect>) {
    const scale = currentDrawing.scale;
    if (!scale) return { width: "", height: "" };

    return {
      width: String(Math.round(rect.width * scale.mmPerWorldUnit)),
      height: String(Math.round(rect.height * scale.mmPerWorldUnit)),
    };
  }

  async function migrateDrawingScaleIfNeeded(drawingToMigrate: Drawing, loadedAnnotations: Annotation[]) {
    if (drawingToMigrate.scale) return;
    const scale = inferScaleFromExistingRooms(loadedAnnotations);
    if (!scale) return;

    try {
      const updatedDrawing = await updateDrawingScale(drawingToMigrate, scale);
      setCurrentDrawing(updatedDrawing);
    } catch (error) {
      console.error("[ForteStack] drawing scale migration failed", error);
    }
  }

  function inferScaleFromExistingRooms(items: Annotation[]): DrawingScale | undefined {
    const rooms = items.filter(
      (annotation): annotation is RoomAnnotation => annotation.type === "room",
    );

    for (const room of rooms) {
      const bounds = getRoomBounds(room);
      const scale = createScaleFromRoomRect(bounds, room.internalWidth, room.internalHeight);
      if (scale) return { ...scale, calibratedFrom: { type: "room", id: room.id } };
    }

    return undefined;
  }

  function createScaleFromRoomRect(
    rect: ReturnType<typeof normalizeRect>,
    internalWidth: string,
    internalHeight: string,
  ): DrawingScale | undefined {
    const width = Number.parseFloat(internalWidth);
    const height = Number.parseFloat(internalHeight);
    const xScale = rect.width > 0 && Number.isFinite(width) && width > 0 ? width / rect.width : undefined;
    const yScale = rect.height > 0 && Number.isFinite(height) && height > 0 ? height / rect.height : undefined;
    const candidates = [xScale, yScale].filter((value): value is number => typeof value === "number");

    if (candidates.length === 0) return undefined;

    return {
      mmPerWorldUnit: candidates.reduce((total, value) => total + value, 0) / candidates.length,
      calibratedAt: new Date().toISOString(),
    };
  }

  function createScaleFromDimension(dimension: DimensionAnnotation): DrawingScale | undefined {
    const value = Number.parseFloat(dimension.value);
    const worldLength = Math.hypot(dimension.end.x - dimension.start.x, dimension.end.y - dimension.start.y);
    if (!Number.isFinite(value) || value <= 0 || worldLength <= 0) return undefined;

    return {
      mmPerWorldUnit: value / worldLength,
      calibratedAt: new Date().toISOString(),
    };
  }

  const isActionInProgress =
    activeTool === "dimension" ||
    activeTool === "placingObject" ||
    activeTool === "line" ||
    draft.step !== "idle" ||
    rectDraft.step !== "idle" ||
    isValueSheetOpen ||
    isRectValueSheetOpen;
  const showDimensionActions =
    activeTool === "browse" && Boolean(selectedDimension && editableDimensionId === selectedDimension.id && !isEditorOpen);
  const showRoomActions = activeTool === "browse" && Boolean(selectedRect && !isRectEditorOpen);
  const showShapeActions = activeTool === "browse" && Boolean(selectedShape);
  const showDoorActions = activeTool === "browse" && Boolean(selectedDoor && editableObjectId === selectedDoor.id && !isDoorEditorOpen);
  const showNoteActions = activeTool === "browse" && Boolean(selectedNote);
  const showImageActions=activeTool==="browse"&&Boolean(selectedImage&&editableObjectId===selectedImage.id);
  const showLineActions=activeTool==="browse"&&Boolean(selectedLine&&editableObjectId===selectedLine.id);
  const deletePromptLabel = deletePrompt?.type ?? "object";

  function centreViewportOnOrigin(){setTransform(current=>({...current,translateX:viewport.width/2,translateY:viewport.height/2}))}
  function cancelOriginReset(){if(originResetTimerRef.current)window.clearTimeout(originResetTimerRef.current);originResetTimerRef.current=undefined}
  function beginExportPreview(){exportAnnotationsSnapshotRef.current=annotations;setIsExportSettingsOpen(false);setIsExportPreview(true);setExportAnnotationScale(1);setSelection({});setEditableObjectId(undefined);setEditableShapeId(undefined);setEditableDimensionId(undefined);setActiveTool("browse")}
  function restoreExportLayout(){const snapshot=exportAnnotationsSnapshotRef.current;if(snapshot)setAnnotations(snapshot);exportAnnotationsSnapshotRef.current=undefined;exportMoveRef.current=undefined;setSelection({});setIsExportPreview(false)}
  useEffect(()=>{if(!isExportPreview&&exportAnnotationsSnapshotRef.current)restoreExportLayout()},[isExportPreview]);
  function handleExportMoveStart(id:string,event:React.PointerEvent<SVGElement>){const original=annotations.find(item=>item.id===id);if(!original||(original.type!=="dimension"&&original.type!=="note"))return;event.preventDefault();event.stopPropagation();exportMoveRef.current={id,pointerId:event.pointerId,start:getWorldPointFromClient(event),original};setSelection({selectedAnnotationId:id});cancelPanZoomGesture()}
  function handleExportMoveUpdate(id:string,event:React.PointerEvent<SVGElement>){const move=exportMoveRef.current;if(!move||move.id!==id||move.pointerId!==event.pointerId)return;const point=getWorldPointFromClient(event),dx=point.x-move.start.x,dy=point.y-move.start.y;let next:Annotation;if(move.original.type==="note")next={...move.original,textPosition:{x:move.original.textPosition.x+dx,y:move.original.textPosition.y+dy}};else if(move.original.type==="dimension"){const vx=move.original.end.x-move.original.start.x,vy=move.original.end.y-move.original.start.y,length=Math.hypot(vx,vy)||1,nx=-vy/length,ny=vx/length;next={...move.original,offset:move.original.offset+dx*nx+dy*ny}}else return;setAnnotations(items=>items.map(item=>item.id===id?next:item))}
  function handleExportMoveEnd(id:string,event:React.PointerEvent<SVGElement>){const move=exportMoveRef.current;if(!move||move.id!==id||move.pointerId!==event.pointerId)return;event.stopPropagation();exportMoveRef.current=undefined}
  function setExportRatio(ratio:string){const values:Record<string,number>={"16:9":16/9,"9:16":9/16,"4:3":4/3,"1:1":1};setExportConfig(current=>({...current,ratio,height:ratio==="custom"?current.height:Math.round(current.width/values[ratio])}))}
  async function exportPreviewImage(){const viewportElement=viewportRef.current,frame=exportFrameRef.current;if(!viewportElement||!frame)return;setIsExporting(true);try{const viewportRect=viewportElement.getBoundingClientRect(),frameRect=frame.getBoundingClientRect(),clone=viewportElement.cloneNode(true) as HTMLElement;clone.querySelectorAll(".export-crop-overlay,.export-preview-controls,.workspace-coordinate-readout,.workspace-debug-panel,.snap-preview,.reference-point-marker").forEach(node=>node.remove());clone.classList.add("is-export-capture");const originals=[viewportElement,...viewportElement.querySelectorAll("*")],copies=[clone,...clone.querySelectorAll("*")];originals.forEach((node,index)=>{const copy=copies[index] as HTMLElement|SVGElement|undefined;if(copy)copy.setAttribute("style",`${copy.getAttribute("style")??""};${getComputedStyle(node).cssText}`)});const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${viewportRect.width}" height="${viewportRect.height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${viewportRect.width}px;height:${viewportRect.height}px">${clone.outerHTML}</div></foreignObject></svg>`,url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"})),image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("Unable to render export"));image.src=url});const canvas=document.createElement("canvas");canvas.width=exportConfig.width;canvas.height=exportConfig.height;const context=canvas.getContext("2d");if(!context)throw new Error("Canvas unavailable");context.fillStyle="#ffffff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,frameRect.left-viewportRect.left,frameRect.top-viewportRect.top,frameRect.width,frameRect.height,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);const mime=`image/${exportConfig.type}`,blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Unable to encode image")),mime,.94)),filename=`ForteStack-${currentDrawing.name.replace(/[^a-z0-9]+/gi,"-")}-${Date.now()}.${exportConfig.type==="jpeg"?"jpg":exportConfig.type}`,downloadUrl=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=downloadUrl;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(downloadUrl),1000);setExportMessage(`Image saved as ${filename}`);setIsExportPreview(false);setTimeout(()=>setExportMessage(undefined),5000)}catch(error){setExportMessage(error instanceof Error?error.message:"Export failed")}finally{setIsExporting(false)}}

  async function exportNativePreviewImage(){const viewportElement=viewportRef.current,frame=exportFrameRef.current;if(!viewportElement||!frame)return;setIsExporting(true);try{const frameRect=frame.getBoundingClientRect(),canvas=document.createElement("canvas");canvas.width=exportConfig.width;canvas.height=exportConfig.height;const context=canvas.getContext("2d");if(!context)throw new Error("Canvas unavailable");context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);const scaleX=canvas.width/frameRect.width,scaleY=canvas.height/frameRect.height,background=viewportElement.querySelector<HTMLImageElement>(".workspace-photo-background");if(background){const rect=background.getBoundingClientRect(),image=await loadSafeImage(background.src);context.drawImage(image,(rect.left-frameRect.left)*scaleX,(rect.top-frameRect.top)*scaleY,rect.width*scaleX,rect.height*scaleY)}for(const selector of [".workspace-grid",".annotation-svg-layer"]){const source=viewportElement.querySelector<SVGSVGElement>(selector);if(!source)continue;const clone=source.cloneNode(true) as SVGSVGElement,sourceNodes=[source,...source.querySelectorAll("*")],cloneNodes=[clone,...clone.querySelectorAll("*")];sourceNodes.forEach((node,index)=>{const copy=cloneNodes[index];if(!copy)return;const computed=getComputedStyle(node),css=Array.from(computed).map(property=>`${property}:${computed.getPropertyValue(property)};`).join("");copy.setAttribute("style",`${copy.getAttribute("style")??""};${css}`)});for(const imageNode of clone.querySelectorAll("image")){const href=imageNode.getAttribute("href")||imageNode.getAttribute("xlink:href");if(href)imageNode.setAttribute("href",await urlToDataUrl(href))}clone.setAttribute("xmlns","http://www.w3.org/2000/svg");const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:"image/svg+xml"})),image=await loadSafeImage(url),viewportRect=viewportElement.getBoundingClientRect();context.drawImage(image,frameRect.left-viewportRect.left,frameRect.top-viewportRect.top,frameRect.width,frameRect.height,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url)}const mime=`image/${exportConfig.type}`,blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Unable to encode image")),mime,.94)),filename=`ForteStack-${currentDrawing.name.replace(/[^a-z0-9]+/gi,"-")}-${Date.now()}.${exportConfig.type==="jpeg"?"jpg":exportConfig.type}`,url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);setExportMessage(`Image saved to Downloads as ${filename}`);setIsExportPreview(false);setTimeout(()=>setExportMessage(undefined),5000)}catch(error){setExportMessage(error instanceof Error?error.message:"Export failed")}finally{setIsExporting(false)}}

  const exportRatio=exportConfig.width/exportConfig.height,maxExportWidth=Math.max(1,viewport.width-36),maxExportHeight=Math.max(1,viewport.height-220),exportFrameSize=maxExportWidth/maxExportHeight>exportRatio?{width:maxExportHeight*exportRatio,height:maxExportHeight}:{width:maxExportWidth,height:maxExportWidth/exportRatio};

  return (
    <main className="drawing-workspace-screen">
      <header className="workspace-topbar workspace-topbar--floating">
        <IconButton icon={<ArrowLeft size={22} />} label="Back to drawings" onClick={onBack} />
        <button className="workspace-title-button" type="button" aria-label="Hold to rename drawing" onPointerDown={()=>{if(titleHoldRef.current)window.clearTimeout(titleHoldRef.current);titleHoldRef.current=window.setTimeout(()=>{setDrawingNameDraft(currentDrawing.name);setIsRenameDrawingOpen(true)},500)}} onPointerUp={()=>{if(titleHoldRef.current)window.clearTimeout(titleHoldRef.current)}} onPointerCancel={()=>{if(titleHoldRef.current)window.clearTimeout(titleHoldRef.current)}}>
          <strong>{currentDrawing.name}</strong>
          <span>{project.name}</span>
        </button>
        <div className="workspace-top-actions"><LayerMenu layers={layers} activeLayerId={activeLayerId} onChange={handleLayersChange}/><button className="workspace-export-action" type="button" aria-label="Export drawing" onClick={()=>setIsExportSettingsOpen(true)}><Download size={20}/></button></div>
      </header>

      <section
        ref={viewportRef}
        className={`drawing-viewport ${isInteracting ? "is-interacting" : ""} ${activeTool !== "browse" ? "is-placement-tool" : ""}`}
        style={{
          "--workspace-scale": transform.scale,
          "--workspace-translate-x": `${transform.translateX}px`,
          "--workspace-translate-y": `${transform.translateY}px`,
        } as CSSProperties}
        onPointerDown={handlePointerDown}
        onPointerDownCapture={handleGesturePointerDownCapture}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerUpCapture={handleGesturePointerEndCapture}
        onPointerCancel={handlePointerCancel}
        onPointerCancelCapture={handleGesturePointerEndCapture}
        onWheel={panZoomHandlers.onWheel}
      >
        <WorkspaceGrid mmPerWorldUnit={mmPerWorldUnit} transform={transform} viewport={viewport} />
        {showImageActions&&imageEditMode==="distort"?<div className="image-alignment-guides image-alignment-guides--screen" aria-hidden="true"><i/><i/><b/><b/><span/><span/></div>:null}
        <button className={`workspace-floating-debug ${isDebugVisible?"is-active":""}`} type="button" aria-label="Toggle debug" onClick={()=>setIsDebugVisible(value=>!value)}><Bug size={18}/></button>
        <div
          className="workspace-origin-lines"
          style={{
            transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
          }}
        >
          <div className="workspace-origin-line workspace-origin-line--vertical" />
          <div className="workspace-origin-line workspace-origin-line--horizontal" />
        </div>
        <div
          className="workspace-world"
          style={{
            transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
          }}
        >
          <BackgroundLayer drawing={drawing} asset={asset} assetUrl={assetUrl} />
        </div>
        <AnnotationSvgLayer
          annotations={visibleAnnotations}
          draft={draft}
          rectDraft={rectDraft}
          lineDraft={lineDraft}
          activeRoomEdge={activeRoomEdge}
          editableDimensionId={editableDimensionId}
          editableShapeId={editableShapeId}
          editableObjectId={editableObjectId}
          editingNoteTextId={editingNoteTextId}
          movableRoomId={isRoomEditorCollapsed ? selectedRect?.id : undefined}
          placingObjectType={placingObjectType}
          selection={selection}
          mmPerWorldUnit={mmPerWorldUnit}
          transform={transform}
          viewport={viewport}
          onDebug={pushDebugEvent}
          onEditAnnotation={handleEditAnnotation}
          onMoveDimensionPointEnd={handleMoveDimensionPointEnd}
          onMoveDimensionPointStart={handleMoveDimensionPointStart}
          onMoveDimensionPointUpdate={handleMoveDimensionPointUpdate}
          onEditShape={handleEditAnnotation}
          onMoveShapeEnd={handleMoveShapeEnd}
          onMoveShapeStart={handleMoveShapeStart}
          onMoveShapeUpdate={handleMoveShapeUpdate}
          onMoveRoomEnd={handleMoveRoomEnd}
          onMoveRoomStart={handleMoveRoomStart}
          onMoveRoomUpdate={handleMoveRoomUpdate}
          onResizeRoomEnd={handleResizeRoomEnd}
          onResizeRoomStart={handleResizeRoomStart}
          onResizeRoomUpdate={handleResizeRoomUpdate}
          onSelectAnnotation={handleSelectAnnotation}
          onMoveDoorStart={handleObjectMoveStart}
          onMoveDoorUpdate={handleObjectMoveUpdate}
          onMoveDoorEnd={handleObjectMoveEnd}
          onMoveNoteStart={handleObjectMoveStart}
          onMoveNoteUpdate={handleObjectMoveUpdate}
          onMoveNoteEnd={handleObjectMoveEnd}
          onNoteTextChange={handleNoteTextChange}
          onNoteTextCommit={handleNoteTextCommit}
          imageUrls={imageUrls}
          onMoveImageStart={handleImageStart}
          onMoveImageUpdate={handleImageUpdate}
          onMoveImageEnd={handleImageEnd}
          activeLayerId={activeLayerId}
          annotationScaleMultiplier={isExportPreview?exportAnnotationScale:1}
          exportPreview={isExportPreview}
          onExportMoveStart={handleExportMoveStart}
          onExportMoveUpdate={handleExportMoveUpdate}
          onExportMoveEnd={handleExportMoveEnd}
          imageEditMode={imageEditMode}
          onMoveLineNodeStart={handleLineNodeStart}
          onMoveLineNodeUpdate={handleLineNodeUpdate}
          onMoveLineNodeEnd={handleLineNodeEnd}
          onEditLineLength={handleEditLineLength}
          onEditLineAngle={handleEditLineAngle}
          onMoveLineMeasurementStart={handleLineMeasurementStart}
          onMoveLineMeasurementUpdate={handleLineMeasurementUpdate}
          onMoveLineMeasurementEnd={handleLineMeasurementEnd}
          selectedLineSegmentId={selectedLineSegmentId}
          onSelectLineSegment={(lineId,segmentId)=>{cancelPanZoomGesture();setSelection({selectedAnnotationId:lineId});setSelectedLineSegmentId(segmentId)}}
          onUnlockDimension={handleUnlockDimension}
        />
        {referencePoints.map((referencePoint) => (
          <div
            className="reference-point-marker"
            key={referencePoint.id}
            style={{
              left: referencePoint.point.x * transform.scale + transform.translateX,
              top: referencePoint.point.y * transform.scale + transform.translateY,
            }}
          />
        ))}
        {snapPreview?.type ? (
          <div
            className={`snap-preview snap-preview--${snapPreview.type}`}
            style={{
              left: snapPreview.point.x * transform.scale + transform.translateX,
              top: snapPreview.point.y * transform.scale + transform.translateY,
            }}
          />
        ) : null}
        {dimensionSnapIndicator ? <div className="dimension-snap-indicator">{dimensionSnapIndicator}</div> : null}

        <button className="workspace-coordinate-readout" type="button" aria-label="Workspace coordinates. Hold or double tap to centre on zero" onPointerDown={event=>{event.stopPropagation();cancelOriginReset();originResetTimerRef.current=window.setTimeout(centreViewportOnOrigin,500)}} onPointerUp={event=>{event.stopPropagation();cancelOriginReset()}} onPointerCancel={cancelOriginReset} onDoubleClick={centreViewportOnOrigin}>
          {Math.round(centerWorld.x)}, {Math.round(centerWorld.y)} · {Math.round(transform.scale * 100)}%
        </button>
        {isDebugVisible ? (
          <div className="workspace-debug-panel" aria-live="polite">
            <strong>Dimension debug</strong>
            {debugEvents.map((event) => (
              <span key={event}>{event}</span>
            ))}
          </div>
        ) : null}
        {isExportPreview?<><div ref={exportFrameRef} className="export-crop-overlay" style={{width:exportFrameSize.width,height:exportFrameSize.height}}/><div className="export-preview-controls"><button type="button" aria-label="Smaller labels" onClick={()=>setExportAnnotationScale(value=>Math.max(.5,value-.1))}><Minus size={19}/></button><span><Type size={17}/>{Math.round(exportAnnotationScale*100)}%</span><button type="button" aria-label="Larger labels" onClick={()=>setExportAnnotationScale(value=>Math.min(3,value+.1))}><Plus size={19}/></button><button className="is-export-confirm" type="button" aria-label="Save export" disabled={isExporting} onClick={exportNativePreviewImage}><Check size={22}/></button><button type="button" aria-label="Cancel export" onClick={restoreExportLayout}><X size={20}/></button></div></>:null}
      </section>

      <WorkspaceToolbar
        activeTool={activeTool}
        isAddPickerOpen={isAddPickerOpen}
        onAddClick={() => {
          setIsAddPickerOpen((open) => !open);
          setActiveTool("browse");
          setPlacingObjectType(undefined);
          updateDraft({ step: "idle" });
          updateRectDraft({ step: "idle" });
          setLineDraft({points:[]});
        }}
        onToolChange={(tool) => {
          setActiveTool(tool);
          setIsAddPickerOpen(false);
          setPlacingObjectType(undefined);
          updateDraft({ step: "idle" });
          updateRectDraft({ step: "idle" });
          setLineDraft({points:[]});
          setSnapPreview(undefined);
          setDimensionSnapIndicator(undefined);
          setActiveRoomEdge(undefined);
          setEditableDimensionId(undefined);
          setEditableShapeId(undefined);
          updatePendingDimension(undefined);
          setPendingDimensionInitialValue("");
          pendingRectRef.current = undefined;
          setJoinProposal(undefined);
          setPendingRoomInitialValues({ width: "", height: "" });
          setIsJoinPromptOpen(false);
          setIsRoomEditorCollapsed(false);
          setIsRectangleEditorOpen(false);
          setIsDoorEditorOpen(false);
        }}
        onOpenDrawingSettings={() => setIsDrawingSettingsOpen(true)}
        onOpenSnapSettings={() => setIsSnapSheetOpen(true)}
      />
      {isRenameDrawingOpen?<div className="export-settings-backdrop" role="dialog" aria-modal="true" aria-label="Rename drawing"><form className="export-settings-card" onSubmit={async event=>{event.preventDefault();const name=drawingNameDraft.trim();if(!name)return;const updated=await renameDrawing(currentDrawing,name);setCurrentDrawing(updated);setIsRenameDrawingOpen(false)}}><div className="export-settings-card__header"><div><strong>Rename drawing</strong><span>Change the workspace title</span></div><button type="button" aria-label="Close rename" onClick={()=>setIsRenameDrawingOpen(false)}><X size={20}/></button></div><label>Drawing name<input autoFocus value={drawingNameDraft} onChange={event=>setDrawingNameDraft(event.target.value)} /></label><button className="primary-button export-continue" type="submit" disabled={!drawingNameDraft.trim()}>Save name</button></form></div>:null}
      {isExportSettingsOpen?<div className="export-settings-backdrop" role="dialog" aria-modal="true" aria-label="Export drawing"><div className="export-settings-card"><div className="export-settings-card__header"><div><strong>Export image</strong><span>Choose the output size and shape</span></div><button type="button" aria-label="Close export" onClick={()=>setIsExportSettingsOpen(false)}><X size={20}/></button></div><label>File type<select value={exportConfig.type} onChange={event=>setExportConfig(current=>({...current,type:event.target.value as typeof current.type}))}><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option></select></label><div className="export-size-fields"><label>Width<input inputMode="numeric" type="number" min="320" max="8192" value={exportConfig.width} onChange={event=>{const width=Number(event.target.value)||1;setExportConfig(current=>({...current,width,height:current.lockRatio&&current.ratio!=="custom"?Math.round(width/({"16:9":16/9,"9:16":9/16,"4:3":4/3,"1:1":1}[current.ratio]??1)):current.height}))}}/></label><label>Height<input inputMode="numeric" type="number" min="320" max="8192" value={exportConfig.height} onChange={event=>setExportConfig(current=>({...current,height:Number(event.target.value)||1}))}/></label></div><label className="export-lock-row"><input type="checkbox" checked={exportConfig.lockRatio} onChange={event=>setExportConfig(current=>({...current,lockRatio:event.target.checked}))}/> Lock aspect ratio</label><div className="export-ratios">{["16:9","9:16","4:3","1:1","custom"].map(ratio=><button className={exportConfig.ratio===ratio?"is-active":""} type="button" key={ratio} onClick={()=>setExportRatio(ratio)}>{ratio}</button>)}</div><button className="primary-button export-continue" type="button" onClick={beginExportPreview}>Continue</button></div></div>:null}
      {exportMessage?<div className="export-toast" role="status">{exportMessage}</div>:null}
      <AddObjectPicker
        isOpen={isAddPickerOpen}
        onPick={(type) => {
          if(type==="image"){setIsAddPickerOpen(false);imageInputRef.current?.click();return}
          if(type==="line"){setIsAddPickerOpen(false);setPlacingObjectType("line");setActiveTool("line");setLineDraft({points:[]});setSelection({});return}
          setIsAddPickerOpen(false);
          setPlacingObjectType(type);
          setActiveTool("placingObject");
          updateDraft({ step: "idle" });
          updateRectDraft({ step: "idle" });
          setSelection({});
          setEditableDimensionId(undefined);
          setEditableShapeId(undefined);
          setIsRoomEditorCollapsed(false);
          setIsRectangleEditorOpen(false);
          setIsDoorEditorOpen(false);
        }}
      />
      <input ref={imageInputRef} className="visually-hidden" type="file" accept="image/*" onChange={handleImageSelected}/>
      {activeTool==="line"?<div className="workspace-line-actions"><button type="button" disabled={!lineDraft.points.length} onClick={()=>setLineDraft(current=>({points:current.points.slice(0,-1),preview:current.preview}))}>Undo</button><button type="button" aria-label="Cancel line" onClick={cancelActiveAction}><X size={19}/></button><button className="is-confirm" type="button" aria-label="Finish line" disabled={lineDraft.points.length<2} onClick={confirmLineDraft}><Check size={20}/></button></div>:null}
      {isActionInProgress && activeTool!=="line" ? (
        <button className="workspace-cancel-button" type="button" onClick={cancelActiveAction}>
          <X size={18} />
          Cancel
        </button>
      ) : null}
      {showRoomActions || showDimensionActions || showShapeActions || showDoorActions || showNoteActions || showImageActions || showLineActions ? (
        <div className="workspace-context-actions">
          {showLineActions&&selectedLineSegmentId?<><button className="workspace-door-action" type="button" aria-label="Break line" title="Break line" onClick={breakSelectedLine}><Scissors size={19}/></button><button className="workspace-door-action" type="button" aria-label="Add junction" title="Add junction" onClick={addSelectedLineJunction}><GitFork size={19}/></button><button className="workspace-delete-button" type="button" aria-label="Delete segment" title="Delete segment" onClick={deleteSelectedLineSegment}><Trash2 size={19}/></button></>:null}
          {showLineActions&&!selectedLineSegmentId?<button className="workspace-note-done-action" type="button" aria-label="Finish editing line" onClick={()=>setEditableObjectId(undefined)}><Check size={20}/></button>:null}
          {showLineActions&&!selectedLineSegmentId&&selectedLine?<><button className={`workspace-door-action ${selectedLine.showAngles?"is-active":""}`} type="button" aria-label="Toggle angle labels" title="Show angles" onClick={()=>updateLineDisplay({showAngles:!selectedLine.showAngles})}><DraftingCompass size={19}/></button><button className={`workspace-door-action ${selectedLine.showMeasurements?"is-active":""}`} type="button" aria-label="Toggle measurements" title="Show measurements" onClick={()=>updateLineDisplay({showMeasurements:!selectedLine.showMeasurements})}><Ruler size={19}/></button></>:null}
          {showImageActions?<><button className={`workspace-door-action ${imageEditMode==="distort"?"is-active":""}`} type="button" aria-label="Distort image" title="Distort" onClick={()=>setImageEditMode("distort")}><Grid3X3 size={19}/></button><button className={`workspace-door-action ${imageEditMode==="crop"?"is-active":""}`} type="button" aria-label="Crop image" title="Crop" onClick={startImageCrop}><Crop size={19}/></button><button className="workspace-door-action" type="button" aria-label="Rotate image left" onClick={()=>rotateSelectedImage(-15)}><RotateCcw size={19}/></button><button className="workspace-door-action" type="button" aria-label="Rotate image right" onClick={()=>rotateSelectedImage(15)}><RotateCw size={19}/></button><button className="workspace-note-done-action" type="button" aria-label="Keep image changes" onClick={finishImageEditing}><Check size={20}/></button><button className="workspace-delete-button" type="button" aria-label="Cancel image changes" onClick={cancelImageEditing}><X size={20}/></button></>:null}
          {selectedNote && editingNoteTextId === selectedNote.id ? (
            <button
              className="workspace-note-done-action"
              type="button"
              aria-label="Finish editing note"
              title="Done"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => handleNoteTextCommit(selectedNote.id)}
            >
              <Check size={20} />
            </button>
          ) : null}
          {showDoorActions && selectedDoor ? (
            <>
              <button
                className="workspace-door-action"
                type="button"
                aria-label="Flip door hinge side"
                title="Flip hinge"
                onClick={() => handleUpdateDoor({ ...selectedDoor, hingeSide: selectedDoor.hingeSide === "start" ? "end" : "start", updatedAt: new Date().toISOString() })}
              >
                <FlipHorizontal2 size={19} />
              </button>
              <button
                className="workspace-door-action"
                type="button"
                aria-label="Flip door swing direction"
                title="Flip swing"
                onClick={() => handleUpdateDoor({ ...selectedDoor, swingDirection: selectedDoor.swingDirection === 1 ? -1 : 1, updatedAt: new Date().toISOString() })}
              >
                <RefreshCcw size={19} />
              </button>
            </>
          ) : null}
          {(!selectedNote || editingNoteTextId !== selectedNote.id) && !showImageActions && !showLineActions ? <button
            className="workspace-edit-button"
            type="button"
            onClick={() => {
              if (showDimensionActions && selectedDimension) {
                openDimensionEditor(selectedDimension.id);
              } else if (selectedRect) {
                openRoomEditor(selectedRect.id);
              } else if (selectedShape) {
                if (selectedShape.type === "rectangle") {
                  setIsRectangleEditorOpen(true);
                } else {
                  setEditableShapeId(selectedShape.id);
                }
              } else if (selectedDoor) {
                setEditableObjectId(selectedDoor.id);
              } else if (selectedNote) {
                handleEditAnnotation(selectedNote.id);
              }
            }}
          >
            Edit
          </button> : null}
          {!showImageActions?<button
            className="workspace-delete-button"
            type="button"
            aria-label={`Delete ${selectedRect?.type ?? selectedDimension?.type ?? selectedShape?.type ?? selectedDoor?.type ?? selectedNote?.type ?? selectedImage?.type ?? selectedLine?.type ?? "object"}`}
            onClick={requestDeleteSelected}
          >
            <X size={20} />
          </button>:null}
        </div>
      ) : null}
      <DimensionValueSheet
        isOpen={isValueSheetOpen}
        initialValue={pendingDimensionInitialValue}
        onConfirm={handleConfirmDimension}
        onDismiss={cancelActiveAction}
      />
      <RectShapeValueSheet
        isOpen={isRectValueSheetOpen}
        initialWidth={pendingRoomInitialValues.width}
        initialHeight={pendingRoomInitialValues.height}
        onConfirm={handleConfirmRect}
        onDismiss={cancelActiveAction}
      />
      {isJoinPromptOpen ? (
        <div className="join-room-context" role="dialog" aria-label="Join rooms">
          <span>Join rooms?</span>
          <button className="join-room-context__decline" type="button" aria-label="Do not join rooms" onClick={declineRoomJoin}>
            <X size={18} />
          </button>
          <button className="join-room-context__accept" type="button" aria-label="Join rooms" onClick={acceptRoomJoin}>
            <Check size={18} />
          </button>
        </div>
      ) : null}
      {lineJoinProposal?<div className="join-room-context" role="dialog" aria-label="Connect lines"><span>Connect lines?</span><button className="join-room-context__decline" type="button" aria-label="Keep lines separate" onClick={()=>{const proposal=lineJoinProposal;setLineJoinProposal(undefined);void finishCreatedLine(createLineAnnotation({drawingId:currentDrawing.id,layerId:activeLayerId,points:lineDraft.points}),undefined)}}><X size={18}/></button><button className="join-room-context__accept" type="button" aria-label="Connect lines" onClick={()=>finishCreatedLine(lineJoinProposal.line,lineJoinProposal.joined)}><Check size={18}/></button></div>:null}
      <BottomSheet
        title={`Delete ${deletePromptLabel}?`}
        isOpen={Boolean(deletePrompt)}
        placement="center"
        onDismiss={() => setDeletePrompt(undefined)}
        footer={
          <div className="sheet-actions">
            <button className="secondary-button" type="button" onClick={() => setDeletePrompt(undefined)}>
              Cancel
            </button>
            <button className="danger-button" type="button" onClick={confirmDeletePrompt}>
              Delete
            </button>
          </div>
        }
      >
        <p className="confirm-copy">
          Are you sure you want to delete this {deletePromptLabel}? This cannot be undone.
        </p>
      </BottomSheet>
      <DimensionEditorSheet
        dimension={selectedDimension}
        isOpen={isEditorOpen}
        onDismiss={() => {
          setIsEditorOpen(false);
          setEditableDimensionId(undefined);
        }}
        onUpdate={handleUpdateDimension}
      />
      <RectShapeEditorSheet
        rect={selectedRect}
        isOpen={isRectEditorOpen}
        onDismiss={() => {
          setIsRectEditorOpen(false);
          setIsRoomEditorCollapsed(false);
        }}
        onUpdate={handleUpdateRect}
      />
      <RectangleEditorSheet
        rectangle={selectedRectangle}
        isOpen={isRectangleEditorOpen}
        onDismiss={() => setIsRectangleEditorOpen(false)}
        onUpdate={handleUpdateRectangle}
      />
      <DoorEditorSheet
        door={selectedDoor}
        isOpen={isDoorEditorOpen}
        onDismiss={() => setIsDoorEditorOpen(false)}
        onUpdate={handleUpdateDoor}
      />
      <SnapSettingsSheet
        isOpen={isSnapSheetOpen}
        settings={snapSettings}
        onDismiss={() => setIsSnapSheetOpen(false)}
        onChange={handleSnapSettingsChange}
      />
      <DrawingSettingsSheet
        drawing={currentDrawing}
        isOpen={isDrawingSettingsOpen}
        onDismiss={() => setIsDrawingSettingsOpen(false)}
        onResetScale={handleResetDrawingScale}
      />
    </main>
  );
}

function loadSafeImage(src:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("Unable to load an image used by this drawing"));image.src=src})}
function largestCenteredSquare(corners:[Point,Point,Point,Point]){const center=corners.reduce((sum,point)=>({x:sum.x+point.x/4,y:sum.y+point.y/4}),{x:0,y:0}),bounds={minX:Math.min(...corners.map(p=>p.x)),maxX:Math.max(...corners.map(p=>p.x)),minY:Math.min(...corners.map(p=>p.y)),maxY:Math.max(...corners.map(p=>p.y))};let low=0,high=Math.min(bounds.maxX-bounds.minX,bounds.maxY-bounds.minY)/2;for(let i=0;i<28;i++){const half=(low+high)/2,points=[{x:center.x-half,y:center.y-half},{x:center.x+half,y:center.y-half},{x:center.x+half,y:center.y+half},{x:center.x-half,y:center.y+half}];if(points.every(point=>insideConvex(corners,point)))low=half;else high=half}return{x:center.x-low,y:center.y-low,width:low*2,height:low*2}}
function insideConvex(corners:[Point,Point,Point,Point],point:Point){let sign=0;for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4],cross=(b.x-a.x)*(point.y-a.y)-(b.y-a.y)*(point.x-a.x);if(Math.abs(cross)<1e-7)continue;const next=Math.sign(cross);if(sign&&next!==sign)return false;sign=next}return true}
async function urlToDataUrl(url:string){if(url.startsWith("data:"))return url;const blob=await fetch(url).then(response=>response.blob());return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})}
