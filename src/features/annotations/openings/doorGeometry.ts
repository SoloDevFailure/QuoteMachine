import type { DoorAnnotation, RoomAnnotation } from "../annotationTypes";
import type { Point } from "../../drawings/workspace/viewportTypes";
import { getRoomWalls } from "../shapes/rectGeometry";

export type DoorGeometry = { start: Point; end: Point; center: Point; hinge: Point; leafEnd: Point; pocketStart:Point; pocketEnd:Point; tangent: Point; normal: Point; widthWorld: number };

export function getDoorGeometry(input: { door: DoorAnnotation; mmPerWorldUnit: number }): DoorGeometry {
  const widthWorld = Math.max(8, input.door.widthMm / Math.max(input.mmPerWorldUnit, 1));
  const angle = input.door.rotation * Math.PI / 180;
  const tangent = { x: Math.cos(angle), y: Math.sin(angle) };
  const normalSign = input.door.swingDirection;
  const normal = { x: -tangent.y * normalSign, y: tangent.x * normalSign };
  const half = widthWorld / 2;
  const center = input.door.position;
  const start = { x: center.x - tangent.x * half, y: center.y - tangent.y * half };
  const end = { x: center.x + tangent.x * half, y: center.y + tangent.y * half };
  const hinge = input.door.hingeSide === "start" ? start : end;
  const leafAngle = input.door.openingAngle * Math.PI / 180 * normalSign * (input.door.hingeSide === "start" ? 1 : -1);
  const baseAngle = input.door.hingeSide === "start" ? angle : angle + Math.PI;
  const leafEnd = { x: hinge.x + Math.cos(baseAngle + leafAngle) * widthWorld, y: hinge.y + Math.sin(baseAngle + leafAngle) * widthWorld };
  const pocketStart=hinge, pocketEnd={x:hinge.x+tangent.x*widthWorld*(input.door.hingeSide==="start"?-1:1),y:hinge.y+tangent.y*widthWorld*(input.door.hingeSide==="start"?-1:1)};
  return { start, end, center, hinge, leafEnd, pocketStart, pocketEnd, tangent, normal, widthWorld };
}

export function getNearestWallPlacement(point: Point, rooms: RoomAnnotation[], radiusWorld: number) {
  let best: { point: Point; rotation: number; roomId: string; wallId: string; distance: number } | undefined;
  for (const room of rooms) for (const wall of getRoomWalls(room)) {
    const dx = wall.end.x - wall.start.x, dy = wall.end.y - wall.start.y;
    const length2 = dx * dx + dy * dy;
    if (!length2) continue;
    const t = Math.max(0, Math.min(1, ((point.x-wall.start.x)*dx+(point.y-wall.start.y)*dy)/length2));
    const projected = { x: wall.start.x + dx*t, y: wall.start.y + dy*t };
    const distance = Math.hypot(point.x-projected.x, point.y-projected.y);
    if (distance <= radiusWorld && (!best || distance < best.distance)) best = { point: projected, rotation: Math.atan2(dy,dx)*180/Math.PI, roomId: room.id, wallId: wall.wall.id, distance };
  }
  return best;
}
