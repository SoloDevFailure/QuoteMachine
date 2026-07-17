import type { LegacyRectShapeAnnotation, RoomAnnotation, RoomWall } from "../annotationTypes";
import type { Point } from "../../drawings/workspace/viewportTypes";

export type RectEdge = "top" | "right" | "bottom" | "left";

export type RoomEdgeHit = {
  room: RoomAnnotation;
  wall: RoomWall;
  start: Point;
  end: Point;
  value: string;
  distance: number;
};

export function normalizeRect(start: Point, end: Point) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);

  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function getRoomBounds(room: RoomAnnotation) {
  const xs = room.points.map((point) => point.x);
  const ys = room.points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);

  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
}

export function getRoomPath(room: RoomAnnotation) {
  const [firstPoint, ...remainingPoints] = room.points;
  if (!firstPoint) return "";

  return [
    `M ${firstPoint.x} ${firstPoint.y}`,
    ...remainingPoints.map((point) => `L ${point.x} ${point.y}`),
    "Z",
  ].join(" ");
}

export function getRoomCorners(room: RoomAnnotation) {
  return room.points.map(toPoint);
}

export function getRoomWalls(room: RoomAnnotation) {
  return room.walls
    .map((wall) => {
      const start = getWallStart(room, wall);
      const end = getWallEnd(room, wall);
      if (!start || !end) return undefined;

      return {
        wall,
        start,
        end,
        midpoint: {
          x: (start.x + end.x) / 2,
          y: (start.y + end.y) / 2,
        },
      };
    })
    .filter((wall): wall is NonNullable<typeof wall> => Boolean(wall));
}

export function getRoomMidpoints(room: RoomAnnotation) {
  return getRoomWalls(room).map((wall) => wall.midpoint);
}

export function getRoomCenter(room: RoomAnnotation) {
  const bounds = getRoomBounds(room);
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

export function getRoomWallValue(room: RoomAnnotation, wall: RoomWall) {
  if (wall.label === "top" || wall.label === "bottom") return room.internalWidth;
  if (wall.label === "left" || wall.label === "right") return room.internalHeight;
  return "";
}

export function getNearestRoomWall(input: {
  room: RoomAnnotation;
  point: Point;
  radiusWorld: number;
  includeHidden?: boolean;
}): RoomEdgeHit | undefined {
  const ranked = getRoomWalls(input.room)
    .flatMap(({ wall, start, end }) => {
      const segments = input.includeHidden
        ? [{ start, end }]
        : getVisibleWallSegments({ start, end, hiddenSegments: wall.joinedSegments });

      return segments.map((segment) => ({
        room: input.room,
        wall,
        start: segment.start,
        end: segment.end,
        value: getRoomWallValue(input.room, wall),
        distance: distanceToSegment(input.point, segment.start, segment.end),
      }));
    })
    .filter((match) => match.distance <= input.radiusWorld)
    .sort((first, second) => first.distance - second.distance);

  return ranked[0];
}

export function getClosestPointOnRoomWall(room: RoomAnnotation, point: Point) {
  const ranked = getRoomWalls(room)
    .flatMap(({ wall, start, end }) => getVisibleWallSegments({ start, end, hiddenSegments: wall.joinedSegments }))
    .map(({ start, end }) => {
      const edgePoint = getClosestPointOnSegment(point, start, end);
      return {
        point: edgePoint,
        distance: Math.hypot(point.x - edgePoint.x, point.y - edgePoint.y),
      };
    })
    .sort((first, second) => first.distance - second.distance);

  return ranked[0];
}

export function findRoomJoinCandidate(input: {
  room: RoomAnnotation;
  rooms: RoomAnnotation[];
  toleranceWorld: number;
}) {
  const draftWalls = getRoomWalls(input.room);
  const ranked = input.rooms
    .flatMap((existingRoom) =>
      getRoomWalls(existingRoom)
        .filter(({ wall }) => wall.visible)
        .flatMap((existingWall) =>
          draftWalls
            .filter(({ wall }) => wall.visible)
            .map((draftWall) => ({
              room: existingRoom,
              wall: existingWall.wall,
              draftWall: draftWall.wall,
              distance: getAlignedWallDistance(draftWall, existingWall),
            })),
        ),
    )
    .filter((match) => match.distance <= input.toleranceWorld)
    .sort((first, second) => first.distance - second.distance);

  return ranked[0];
}

export function refreshRoomJoins(rooms: RoomAnnotation[], toleranceWorld: number) {
  const nextRooms = rooms.map(clearRoomJoins);
  const updates = new Map<string, RoomAnnotation>(nextRooms.map((room) => [room.id, room]));

  for (let firstIndex = 0; firstIndex < nextRooms.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < nextRooms.length; secondIndex += 1) {
      const firstRoom = updates.get(nextRooms[firstIndex].id);
      const secondRoom = updates.get(nextRooms[secondIndex].id);
      if (!firstRoom || !secondRoom) continue;

      for (const firstWall of getRoomWalls(firstRoom)) {
        for (const secondWall of getRoomWalls(secondRoom)) {
          const overlap = getSharedWallOverlap(firstWall, secondWall, toleranceWorld);
          if (!overlap) continue;

          updates.set(
            firstRoom.id,
            addRoomWallJoin(updates.get(firstRoom.id) ?? firstRoom, firstWall.wall.id, {
              from: overlap.first.from,
              to: overlap.first.to,
              joinedToRoomId: secondRoom.id,
              joinedToWallId: secondWall.wall.id,
            }),
          );
          updates.set(
            secondRoom.id,
            addRoomWallJoin(updates.get(secondRoom.id) ?? secondRoom, secondWall.wall.id, {
              from: overlap.second.from,
              to: overlap.second.to,
              joinedToRoomId: firstRoom.id,
              joinedToWallId: firstWall.wall.id,
            }),
          );
        }
      }
    }
  }

  return nextRooms.map((room) => updates.get(room.id) ?? room);
}

export function refreshRoomJoinsForRoom(rooms: RoomAnnotation[], roomId: string, toleranceWorld: number) {
  const nextRooms = clearRoomJoinsForRoom(rooms, roomId);
  const targetRoom = nextRooms.find((room) => room.id === roomId);
  if (!targetRoom) return nextRooms;

  const updates = new Map<string, RoomAnnotation>(nextRooms.map((room) => [room.id, room]));

  for (const otherRoom of nextRooms) {
    if (otherRoom.id === roomId) continue;
    const currentTarget = updates.get(roomId) ?? targetRoom;
    const currentOther = updates.get(otherRoom.id) ?? otherRoom;

    for (const targetWall of getRoomWalls(currentTarget)) {
      for (const otherWall of getRoomWalls(currentOther)) {
        const overlap = getSharedWallOverlap(targetWall, otherWall, toleranceWorld);
        if (!overlap) continue;

        updates.set(
          currentTarget.id,
          addRoomWallJoin(updates.get(currentTarget.id) ?? currentTarget, targetWall.wall.id, {
            from: overlap.first.from,
            to: overlap.first.to,
            joinedToRoomId: currentOther.id,
            joinedToWallId: otherWall.wall.id,
          }),
        );
        updates.set(
          currentOther.id,
          addRoomWallJoin(updates.get(currentOther.id) ?? currentOther, otherWall.wall.id, {
            from: overlap.second.from,
            to: overlap.second.to,
            joinedToRoomId: currentTarget.id,
            joinedToWallId: targetWall.wall.id,
          }),
        );
      }
    }
  }

  return nextRooms.map((room) => updates.get(room.id) ?? room);
}

export function clearRoomJoinsForRoom(rooms: RoomAnnotation[], roomId: string) {
  return rooms.map((room) => {
    if (room.id === roomId) return clearRoomJoins(room);

    return {
      ...room,
      walls: room.walls.map((wall) => {
        const joinedSegments = wall.joinedSegments?.filter((segment) => segment.joinedToRoomId !== roomId);
        return {
          ...wall,
          visible: joinedSegments && joinedSegments.length > 0 ? !isFullyJoined(joinedSegments) : true,
          joinedToRoomId: joinedSegments?.[0]?.joinedToRoomId,
          joinedToWallId: joinedSegments?.[0]?.joinedToWallId,
          joinedSegments: joinedSegments && joinedSegments.length > 0 ? joinedSegments : undefined,
        };
      }),
      updatedAt: new Date().toISOString(),
    };
  });
}

export function hasRoomJoinOpportunity(rooms: RoomAnnotation[], roomId: string, toleranceWorld: number) {
  const targetRoom = rooms.find((room) => room.id === roomId);
  if (!targetRoom) return false;

  return rooms.some((otherRoom) => {
    if (otherRoom.id === roomId) return false;
    return getRoomWalls(targetRoom).some((targetWall) =>
      getRoomWalls(otherRoom).some((otherWall) => Boolean(getSharedWallOverlap(targetWall, otherWall, toleranceWorld))),
    );
  });
}

export function getVisibleWallSegments(input: {
  start: Point;
  end: Point;
  hiddenSegments?: RoomWall["joinedSegments"];
}) {
  const hiddenSegments = mergeWallSegments(input.hiddenSegments ?? []);
  const visibleRanges: Array<{ from: number; to: number }> = [];
  let cursor = 0;

  for (const segment of hiddenSegments) {
    if (segment.from > cursor) visibleRanges.push({ from: cursor, to: segment.from });
    cursor = Math.max(cursor, segment.to);
  }

  if (cursor < 1) visibleRanges.push({ from: cursor, to: 1 });

  return visibleRanges
    .filter((range) => range.to - range.from > 0.001)
    .map((range) => ({
      start: interpolatePoint(input.start, input.end, range.from),
      end: interpolatePoint(input.start, input.end, range.to),
    }));
}

export function joinRoomWalls(input: {
  room: RoomAnnotation;
  wallId: string;
  joinedToRoomId: string;
  joinedToWallId: string;
}) {
  return {
    ...input.room,
    walls: input.room.walls.map((wall) =>
      wall.id === input.wallId
        ? {
            ...wall,
            visible: false,
            joinedToRoomId: input.joinedToRoomId,
            joinedToWallId: input.joinedToWallId,
            joinedSegments: [
              {
                from: 0,
                to: 1,
                joinedToRoomId: input.joinedToRoomId,
                joinedToWallId: input.joinedToWallId,
              },
            ],
          }
        : wall,
    ),
    updatedAt: new Date().toISOString(),
  };
}

function clearRoomJoins(room: RoomAnnotation) {
  return {
    ...room,
    walls: room.walls.map((wall) => ({
      ...wall,
      visible: true,
      joinedToRoomId: undefined,
      joinedToWallId: undefined,
      joinedSegments: undefined,
    })),
  };
}

function addRoomWallJoin(room: RoomAnnotation, wallId: string, segment: NonNullable<RoomWall["joinedSegments"]>[number]) {
  return {
    ...room,
    walls: room.walls.map((wall) => {
      if (wall.id !== wallId) return wall;
      const joinedSegments = mergeWallSegments([...(wall.joinedSegments ?? []), segment]);
      return {
        ...wall,
        visible: !isFullyJoined(joinedSegments),
        joinedToRoomId: segment.joinedToRoomId,
        joinedToWallId: segment.joinedToWallId,
        joinedSegments,
      };
    }),
    updatedAt: new Date().toISOString(),
  };
}

function getSharedWallOverlap(
  first: ReturnType<typeof getRoomWalls>[number],
  second: ReturnType<typeof getRoomWalls>[number],
  toleranceWorld: number,
) {
  const firstDirection = getUnitVector(first.start, first.end);
  const secondDirection = getUnitVector(second.start, second.end);
  const parallel = Math.abs(firstDirection.x * secondDirection.x + firstDirection.y * secondDirection.y);
  if (parallel < 0.98) return undefined;

  const isVertical = Math.abs(first.end.x - first.start.x) <= Math.abs(first.end.y - first.start.y);
  const firstFixed = isVertical ? first.start.x : first.start.y;
  const secondFixed = isVertical ? second.start.x : second.start.y;
  if (Math.abs(firstFixed - secondFixed) > toleranceWorld) return undefined;

  const firstRange = getAxisRange(first, isVertical ? "y" : "x");
  const secondRange = getAxisRange(second, isVertical ? "y" : "x");
  const from = Math.max(firstRange.min, secondRange.min);
  const to = Math.min(firstRange.max, secondRange.max);
  if (to - from <= toleranceWorld) return undefined;

  return {
    first: rangeToWallParameters(first, from, to, isVertical ? "y" : "x"),
    second: rangeToWallParameters(second, from, to, isVertical ? "y" : "x"),
  };
}

export function translateRoom(room: RoomAnnotation, delta: Point) {
  return {
    ...room,
    points: room.points.map((point) => ({
      ...point,
      x: point.x + delta.x,
      y: point.y + delta.y,
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function resizeRoomToDimensions(room: RoomAnnotation, input: {
  internalWidth: string;
  internalHeight: string;
  mmPerWorldUnit: number;
}) {
  const bounds = getRoomBounds(room);
  const width = parsePositiveDimension(input.internalWidth);
  const height = parsePositiveDimension(input.internalHeight);
  const nextWidth = width ? width / input.mmPerWorldUnit : bounds.width;
  const nextHeight = height ? height / input.mmPerWorldUnit : bounds.height;
  const xScale = bounds.width > 0 ? nextWidth / bounds.width : 1;
  const yScale = bounds.height > 0 ? nextHeight / bounds.height : 1;

  return {
    ...room,
    internalWidth: input.internalWidth,
    internalHeight: input.internalHeight,
    points: room.points.map((point) => ({
      ...point,
      x: bounds.x + (point.x - bounds.x) * xScale,
      y: bounds.y + (point.y - bounds.y) * yScale,
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function createRoomFromRect(input: {
  drawingId: string;
  rect: ReturnType<typeof normalizeRect>;
  internalWidth: string;
  internalHeight: string;
  label?: string;
  id?: string;
  colour?: string;
  fillColour?: string;
  unit?: "mm" | "m";
  createdAt?: string;
  updatedAt?: string;
}): RoomAnnotation {
  const timestamp = new Date().toISOString();
  const id = input.id ?? crypto.randomUUID();
  const room: RoomAnnotation = {
    id,
    drawingId: input.drawingId,
    type: "room",
    layerId: "general",
    colour: input.colour ?? "#32b981",
    fillColour: input.fillColour ?? "#ffffff",
    label: input.label,
    points: [
      { id: `${id}-p-top-left`, x: input.rect.x, y: input.rect.y },
      { id: `${id}-p-top-right`, x: input.rect.x + input.rect.width, y: input.rect.y },
      { id: `${id}-p-bottom-right`, x: input.rect.x + input.rect.width, y: input.rect.y + input.rect.height },
      { id: `${id}-p-bottom-left`, x: input.rect.x, y: input.rect.y + input.rect.height },
    ],
    walls: [
      { id: `${id}-w-top`, fromPointId: `${id}-p-top-left`, toPointId: `${id}-p-top-right`, label: "top", visible: true },
      { id: `${id}-w-right`, fromPointId: `${id}-p-top-right`, toPointId: `${id}-p-bottom-right`, label: "right", visible: true },
      { id: `${id}-w-bottom`, fromPointId: `${id}-p-bottom-right`, toPointId: `${id}-p-bottom-left`, label: "bottom", visible: true },
      { id: `${id}-w-left`, fromPointId: `${id}-p-bottom-left`, toPointId: `${id}-p-top-left`, label: "left", visible: true },
    ],
    internalWidth: input.internalWidth,
    internalHeight: input.internalHeight,
    unit: input.unit ?? "mm",
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  };

  return room;
}

export function getCalibratedRoomRect(input: {
  roughRect: ReturnType<typeof normalizeRect>;
  internalWidth: string;
  internalHeight: string;
  anchorWallLabel?: RoomWall["label"];
  mmPerWorldUnit?: number;
}) {
  const scale = input.mmPerWorldUnit && input.mmPerWorldUnit > 0 ? input.mmPerWorldUnit : 1;
  const width = parsePositiveDimension(input.internalWidth) ? parsePositiveDimension(input.internalWidth)! / scale : input.roughRect.width;
  const height = parsePositiveDimension(input.internalHeight) ? parsePositiveDimension(input.internalHeight)! / scale : input.roughRect.height;
  const rect = { ...input.roughRect, width, height };

  if (input.anchorWallLabel === "right") {
    rect.x = input.roughRect.x + input.roughRect.width - width;
  }

  if (input.anchorWallLabel === "bottom") {
    rect.y = input.roughRect.y + input.roughRect.height - height;
  }

  return rect;
}

export function legacyRectToRoom(rect: LegacyRectShapeAnnotation) {
  return createRoomFromRect({
    drawingId: rect.drawingId,
    rect,
    internalWidth: rect.internalWidth,
    internalHeight: rect.internalHeight,
    label: rect.label,
    id: rect.id,
    colour: rect.colour,
    unit: rect.unit,
    createdAt: rect.createdAt,
    updatedAt: rect.updatedAt,
  });
}

export function getRectCorners(room: RoomAnnotation) {
  return getRoomCorners(room);
}

export function getRectMidpoints(room: RoomAnnotation) {
  return getRoomMidpoints(room);
}

export function getRectCenter(room: RoomAnnotation) {
  return getRoomCenter(room);
}

export function getRectEdge(room: RoomAnnotation, edge: RectEdge) {
  const match = getRoomWalls(room).find(({ wall }) => wall.label === edge);
  if (!match) {
    return { start: getRoomCorners(room)[0], end: getRoomCorners(room)[0], value: "" };
  }

  return {
    start: match.start,
    end: match.end,
    value: getRoomWallValue(room, match.wall),
  };
}

export function getNearestRectEdge(input: {
  rect: RoomAnnotation;
  point: Point;
  radiusWorld: number;
}) {
  return getNearestRoomWall({
    room: input.rect,
    point: input.point,
    radiusWorld: input.radiusWorld,
  })?.wall.label;
}

export function getClosestPointOnRectEdge(room: RoomAnnotation, point: Point) {
  return getClosestPointOnRoomWall(room, point);
}

function getWallStart(room: RoomAnnotation, wall: RoomWall) {
  const point = room.points.find((item) => item.id === wall.fromPointId);
  return point ? toPoint(point) : undefined;
}

function getWallEnd(room: RoomAnnotation, wall: RoomWall) {
  const point = room.points.find((item) => item.id === wall.toPointId);
  return point ? toPoint(point) : undefined;
}

function getAlignedWallDistance(
  first: ReturnType<typeof getRoomWalls>[number],
  second: ReturnType<typeof getRoomWalls>[number],
) {
  const firstDirection = getUnitVector(first.start, first.end);
  const secondDirection = getUnitVector(second.start, second.end);
  const parallel = Math.abs(firstDirection.x * secondDirection.x + firstDirection.y * secondDirection.y);
  if (parallel < 0.98) return Number.POSITIVE_INFINITY;

  const firstMid = first.midpoint;
  const secondMid = second.midpoint;
  const firstLength = Math.hypot(first.end.x - first.start.x, first.end.y - first.start.y);
  const secondLength = Math.hypot(second.end.x - second.start.x, second.end.y - second.start.y);
  const lengthMismatch = Math.abs(firstLength - secondLength);
  const midpointDistance = Math.hypot(firstMid.x - secondMid.x, firstMid.y - secondMid.y);
  const crossDistance = Math.abs(
    (secondMid.x - firstMid.x) * firstDirection.y - (secondMid.y - firstMid.y) * firstDirection.x,
  );

  return midpointDistance + lengthMismatch * 0.5 + crossDistance;
}

function getAxisRange(wall: ReturnType<typeof getRoomWalls>[number], axis: "x" | "y") {
  const first = wall.start[axis];
  const second = wall.end[axis];
  return {
    min: Math.min(first, second),
    max: Math.max(first, second),
  };
}

function rangeToWallParameters(
  wall: ReturnType<typeof getRoomWalls>[number],
  fromValue: number,
  toValue: number,
  axis: "x" | "y",
) {
  const delta = wall.end[axis] - wall.start[axis] || 1;
  const first = clamp01((fromValue - wall.start[axis]) / delta);
  const second = clamp01((toValue - wall.start[axis]) / delta);
  return {
    from: Math.min(first, second),
    to: Math.max(first, second),
  };
}

function mergeWallSegments(segments: NonNullable<RoomWall["joinedSegments"]>) {
  const sorted = segments
    .map((segment) => ({
      ...segment,
      from: clamp01(Math.min(segment.from, segment.to)),
      to: clamp01(Math.max(segment.from, segment.to)),
    }))
    .filter((segment) => segment.to - segment.from > 0.001)
    .sort((first, second) => first.from - second.from);
  const merged: NonNullable<RoomWall["joinedSegments"]> = [];

  for (const segment of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || segment.from > previous.to + 0.001) {
      merged.push(segment);
      continue;
    }

    previous.to = Math.max(previous.to, segment.to);
  }

  return merged;
}

function isFullyJoined(segments: NonNullable<RoomWall["joinedSegments"]>) {
  return mergeWallSegments(segments).some((segment) => segment.from <= 0.001 && segment.to >= 0.999);
}

function interpolatePoint(start: Point, end: Point, progress: number) {
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const projection = getClosestPointOnSegment(point, start, end);

  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

function getClosestPointOnSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));

  return {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };
}

function getUnitVector(start: Point, end: Point) {
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  return {
    x: (end.x - start.x) / length,
    y: (end.y - start.y) / length,
  };
}

function toPoint(point: { x: number; y: number }) {
  return { x: point.x, y: point.y };
}

function parsePositiveDimension(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
