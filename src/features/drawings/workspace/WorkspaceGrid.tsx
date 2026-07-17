import { getConstructionGrid } from "../../annotations/snapping";
import { screenToWorld } from "./viewportMath";
import type { ViewportSize, ViewTransform } from "./viewportTypes";

type WorkspaceGridProps = {
  mmPerWorldUnit: number;
  transform: ViewTransform;
  viewport: ViewportSize;
};

type GridLine = {
  key: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
};

export function WorkspaceGrid({ mmPerWorldUnit, transform, viewport }: WorkspaceGridProps) {
  const grid = getConstructionGrid({
    mmPerWorldUnit,
    viewportScale: transform.scale,
  });
  const bounds = getVisibleWorldBounds(viewport, transform);

  return (
    <svg
      className="workspace-grid"
      width={viewport.width}
      height={viewport.height}
      viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      aria-hidden="true"
    >
      <g transform={`translate(${transform.translateX} ${transform.translateY}) scale(${transform.scale})`}>
        {grid.showPrecision ? <GridLines className="workspace-grid__line workspace-grid__line--precision" bounds={bounds} spacing={grid.precisionWorld} /> : null}
        {grid.showDetail ? <GridLines className="workspace-grid__line workspace-grid__line--detail" bounds={bounds} spacing={grid.detailWorld} /> : null}
        {grid.showFine ? <GridLines className="workspace-grid__line workspace-grid__line--fine" bounds={bounds} spacing={grid.fineWorld} /> : null}
        {grid.showMedium ? <GridLines className="workspace-grid__line workspace-grid__line--medium" bounds={bounds} spacing={grid.mediumWorld} /> : null}
        {grid.showMajor ? <GridLines className="workspace-grid__line workspace-grid__line--major" bounds={bounds} spacing={grid.majorWorld} /> : null}
      </g>
    </svg>
  );
}

function GridLines({
  bounds,
  className,
  spacing,
}: {
  bounds: ReturnType<typeof getVisibleWorldBounds>;
  className: string;
  spacing: number;
}) {
  if (!Number.isFinite(spacing) || spacing <= 0) return null;

  const lines = getGridLines(bounds, spacing);

  return (
    <>
      {lines.map((line) => (
        <line className={className} key={line.key} x1={line.x1} x2={line.x2} y1={line.y1} y2={line.y2} />
      ))}
    </>
  );
}

function getVisibleWorldBounds(viewport: ViewportSize, transform: ViewTransform) {
  const topLeft = screenToWorld({ x: 0, y: 0 }, transform);
  const bottomRight = screenToWorld({ x: viewport.width, y: viewport.height }, transform);
  const padding = 2 / transform.scale;

  return {
    minX: Math.min(topLeft.x, bottomRight.x) - padding,
    maxX: Math.max(topLeft.x, bottomRight.x) + padding,
    minY: Math.min(topLeft.y, bottomRight.y) - padding,
    maxY: Math.max(topLeft.y, bottomRight.y) + padding,
  };
}

function getGridLines(bounds: ReturnType<typeof getVisibleWorldBounds>, spacing: number) {
  const lines: GridLine[] = [];
  const startX = Math.floor(bounds.minX / spacing) * spacing;
  const endX = Math.ceil(bounds.maxX / spacing) * spacing;
  const startY = Math.floor(bounds.minY / spacing) * spacing;
  const endY = Math.ceil(bounds.maxY / spacing) * spacing;

  for (let x = startX; x <= endX; x += spacing) {
    lines.push({
      key: `v-${spacing}-${roundGridKey(x)}`,
      x1: x,
      x2: x,
      y1: bounds.minY,
      y2: bounds.maxY,
    });
  }

  for (let y = startY; y <= endY; y += spacing) {
    lines.push({
      key: `h-${spacing}-${roundGridKey(y)}`,
      x1: bounds.minX,
      x2: bounds.maxX,
      y1: y,
      y2: y,
    });
  }

  return lines;
}

function roundGridKey(value: number) {
  return Math.round(value * 1000) / 1000;
}
