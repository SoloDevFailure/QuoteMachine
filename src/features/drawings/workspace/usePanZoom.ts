import { useRef, useState } from "react";
import { getDistance, getMidpoint, zoomAtScreenPoint } from "./viewportMath";
import type { Point, ViewTransform } from "./viewportTypes";

type UsePanZoomOptions = {
  transform: ViewTransform;
  onTransformChange: (transform: ViewTransform) => void;
};

type GestureState =
  | {
      type: "pan";
      pointerId: number;
      startPoint: Point;
      startTransform: ViewTransform;
    }
  | {
      type: "pinch";
      startDistance: number;
      startMidpoint: Point;
      startTransform: ViewTransform;
    };

export function usePanZoom({ transform, onTransformChange }: UsePanZoomOptions) {
  const activePointers = useRef(new Map<number, Point>());
  const gesture = useRef<GestureState | undefined>(undefined);
  const transformRef = useRef(transform);
  const [isInteracting, setIsInteracting] = useState(false);

  transformRef.current = transform;

  function handlePointerDown(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    if (!isAnnotationPointerTarget(event)) event.currentTarget.setPointerCapture(event.pointerId);
    activePointers.current.set(event.pointerId, getLocalPoint(event));
    setIsInteracting(true);

    const pointers = [...activePointers.current.entries()];
    if (pointers.length === 1) {
      gesture.current = {
        type: "pan",
        pointerId: event.pointerId,
        startPoint: pointers[0][1],
        startTransform: transformRef.current,
      };
    }

    if (pointers.length >= 2) {
      const first = pointers[0][1];
      const second = pointers[1][1];
      gesture.current = {
        type: "pinch",
        startDistance: getDistance(first, second),
        startMidpoint: getMidpoint(first, second),
        startTransform: transformRef.current,
      };
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    if (!activePointers.current.has(event.pointerId) || !gesture.current) return;

    event.preventDefault();
    activePointers.current.set(event.pointerId, getLocalPoint(event));

    const pointers = [...activePointers.current.entries()];
    if (gesture.current.type === "pan" && pointers.length === 1) {
      const point = pointers[0][1];
      const deltaX = point.x - gesture.current.startPoint.x;
      const deltaY = point.y - gesture.current.startPoint.y;

      onTransformChange({
        ...gesture.current.startTransform,
        translateX: gesture.current.startTransform.translateX + deltaX,
        translateY: gesture.current.startTransform.translateY + deltaY,
      });
      return;
    }

    if (pointers.length >= 2) {
      const first = pointers[0][1];
      const second = pointers[1][1];
      const midpoint = getMidpoint(first, second);
      const distance = getDistance(first, second);

      if (gesture.current.type !== "pinch") {
        gesture.current = {
          type: "pinch",
          startDistance: distance,
          startMidpoint: midpoint,
          startTransform: transformRef.current,
        };
      }

      const pinchGesture = gesture.current;
      if (pinchGesture.type !== "pinch" || pinchGesture.startDistance === 0) return;

      const scale = pinchGesture.startTransform.scale * (distance / pinchGesture.startDistance);
      const zoomed = zoomAtScreenPoint(pinchGesture.startTransform, pinchGesture.startMidpoint, scale);

      onTransformChange({
        ...zoomed,
        translateX: zoomed.translateX + (midpoint.x - pinchGesture.startMidpoint.x),
        translateY: zoomed.translateY + (midpoint.y - pinchGesture.startMidpoint.y),
      });
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLElement>) {
    event.preventDefault();
    activePointers.current.delete(event.pointerId);

    const pointers = [...activePointers.current.entries()];
    if (pointers.length === 0) {
      gesture.current = undefined;
      setIsInteracting(false);
      return;
    }

    if (pointers.length === 1) {
      gesture.current = {
        type: "pan",
        pointerId: pointers[0][0],
        startPoint: pointers[0][1],
        startTransform: transformRef.current,
      };
    }
  }

  function handleWheel(event: React.WheelEvent<HTMLElement>) {
    event.preventDefault();
    const point = getLocalPoint(event);
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    onTransformChange(zoomAtScreenPoint(transformRef.current, point, transformRef.current.scale * factor));
  }

  function cancelGesture() {
    activePointers.current.clear();
    gesture.current = undefined;
    setIsInteracting(false);
  }

  return {
    cancelGesture,
    isInteracting,
    panZoomHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onWheel: handleWheel,
    },
  };
}

function isAnnotationPointerTarget(event: React.PointerEvent<HTMLElement>) {
  const target = event.target;
  return target instanceof Element && Boolean(target.closest("[data-annotation-hit='true']"));
}

function getLocalPoint(event: React.PointerEvent<HTMLElement> | React.WheelEvent<HTMLElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}
