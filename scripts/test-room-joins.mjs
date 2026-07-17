import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearRoomJoinsForRoom,
  createRoomFromRect,
  hasRoomJoinOpportunity,
  refreshRoomJoins,
  refreshRoomJoinsForRoom,
} from "../src/features/annotations/shapes/rectGeometry.ts";

function room(id, rect) {
  return createRoomFromRect({
    id,
    drawingId: "drawing-test",
    rect,
    internalWidth: String(rect.width),
    internalHeight: String(rect.height),
  });
}

function wall(room, label) {
  const match = room.walls.find((item) => item.label === label);
  assert.ok(match, `expected ${room.id} to have ${label} wall`);
  return match;
}

function joinedRange(room, label) {
  return wall(room, label).joinedSegments?.[0];
}

test("full-height side-by-side rooms hide the full shared wall", () => {
  const [left, right] = refreshRoomJoins(
    [
      room("left", { x: 0, y: 0, width: 100, height: 100 }),
      room("right", { x: 100, y: 0, width: 100, height: 100 }),
    ],
    0.5,
  );

  assert.equal(wall(left, "right").visible, false);
  assert.equal(wall(right, "left").visible, false);
  assert.deepEqual(joinedRange(left, "right"), {
    from: 0,
    to: 1,
    joinedToRoomId: "right",
    joinedToWallId: "right-w-left",
  });
});

test("partial overlap hides only the shared segment", () => {
  const [left, right] = refreshRoomJoins(
    [
      room("left", { x: 0, y: 0, width: 100, height: 100 }),
      room("right", { x: 100, y: 25, width: 100, height: 50 }),
    ],
    0.5,
  );

  assert.equal(wall(left, "right").visible, true);
  assert.equal(wall(right, "left").visible, false);
  assert.deepEqual(joinedRange(left, "right"), {
    from: 0.25,
    to: 0.75,
    joinedToRoomId: "right",
    joinedToWallId: "right-w-left",
  });
});

test("T-junction hides the stem overlap without merging rooms", () => {
  const [top, stem] = refreshRoomJoins(
    [
      room("top", { x: 0, y: 0, width: 200, height: 100 }),
      room("stem", { x: 75, y: 100, width: 50, height: 100 }),
    ],
    0.5,
  );

  assert.equal(wall(top, "bottom").visible, true);
  assert.equal(wall(stem, "top").visible, false);
  assert.deepEqual(joinedRange(top, "bottom"), {
    from: 0.375,
    to: 0.625,
    joinedToRoomId: "stem",
    joinedToWallId: "stem-w-top",
  });
});

test("resize while joined recomputes the shared range", () => {
  const resizedLeft = room("left", { x: 0, y: 0, width: 100, height: 150 });
  const right = room("right", { x: 100, y: 50, width: 100, height: 100 });
  const [left] = refreshRoomJoins([resizedLeft, right], 0.5);

  assert.deepEqual(joinedRange(left, "right"), {
    from: 1 / 3,
    to: 1,
    joinedToRoomId: "right",
    joinedToWallId: "right-w-left",
  });
});

test("moving rooms apart restores visible walls", () => {
  const [left, right] = refreshRoomJoins(
    [
      room("left", { x: 0, y: 0, width: 100, height: 100 }),
      room("right", { x: 130, y: 0, width: 100, height: 100 }),
    ],
    0.5,
  );

  assert.equal(wall(left, "right").visible, true);
  assert.equal(wall(right, "left").visible, true);
  assert.equal(wall(left, "right").joinedSegments, undefined);
});

test("deleting one room clears the remaining room relationship", () => {
  const [left] = refreshRoomJoins(
    [room("left", { x: 0, y: 0, width: 100, height: 100 })],
    0.5,
  );

  assert.equal(wall(left, "right").visible, true);
  assert.equal(wall(left, "right").joinedSegments, undefined);
});

test("join opportunity can be detected without changing room walls", () => {
  const rooms = [
    room("left", { x: 0, y: 0, width: 100, height: 100 }),
    room("right", { x: 100, y: 0, width: 100, height: 100 }),
  ];

  assert.equal(hasRoomJoinOpportunity(rooms, "right", 0.5), true);
  assert.equal(wall(rooms[0], "right").visible, true);
  assert.equal(wall(rooms[1], "left").visible, true);
});

test("accepted join applies only for the selected room relationship", () => {
  const joinedRooms = refreshRoomJoinsForRoom(
    [
      room("left", { x: 0, y: 0, width: 100, height: 100 }),
      room("right", { x: 100, y: 0, width: 100, height: 100 }),
    ],
    "right",
    0.5,
  );

  assert.equal(wall(joinedRooms[0], "right").visible, false);
  assert.equal(wall(joinedRooms[1], "left").visible, false);
});

test("moving a joined room apart clears both sides of the relationship", () => {
  const joinedRooms = refreshRoomJoinsForRoom(
    [
      room("left", { x: 0, y: 0, width: 100, height: 100 }),
      room("right", { x: 100, y: 0, width: 100, height: 100 }),
    ],
    "right",
    0.5,
  );
  const clearedRooms = clearRoomJoinsForRoom(joinedRooms, "right");

  assert.equal(wall(clearedRooms[0], "right").visible, true);
  assert.equal(wall(clearedRooms[1], "left").visible, true);
  assert.equal(wall(clearedRooms[0], "right").joinedSegments, undefined);
});
