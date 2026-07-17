import { useRef } from "react";
import type { LineAnnotation } from "../annotationTypes";
import { cornerAngle, lineNode, segmentLength, segmentNodes } from "./lineGeometry";

type Props = {
  line: LineAnnotation; scale: number; mmPerWorldUnit: number; isSelected: boolean; isEditable: boolean;
  selectedSegmentId?: string;
  onSelect(id: string): void; onEdit(id: string): void; onSelectSegment?(id: string, segmentId: string): void;
  onNodeStart?(id: string, nodeId: string, event: React.PointerEvent<SVGCircleElement>): void;
  onNodeUpdate?(id: string, nodeId: string, event: React.PointerEvent<SVGCircleElement>): void;
  onNodeEnd?(id: string, nodeId: string, event: React.PointerEvent<SVGCircleElement>): void;
  onEditLength?(id: string, segmentId: string): void;
  onEditAngle?(id:string,nodeId:string):void;
  onMeasurementStart?(id:string,segmentId:string,event:React.PointerEvent<SVGTextElement>):void;
  onMeasurementUpdate?(id:string,segmentId:string,event:React.PointerEvent<SVGTextElement>):void;
  onMeasurementEnd?(id:string,segmentId:string,event:React.PointerEvent<SVGTextElement>):void;
};

export function LineRenderer({ line, scale, mmPerWorldUnit, isSelected, isEditable, selectedSegmentId, onSelect, onEdit, onSelectSegment, onNodeStart, onNodeUpdate, onNodeEnd, onEditLength, onEditAngle, onMeasurementStart, onMeasurementUpdate, onMeasurementEnd }: Props) {
  const hold = useRef<{ timer: number; pointerId: number; x: number; y: number } | undefined>(undefined);
  const measurementHold=useRef<{timer:number;pointerId:number;x:number;y:number;active:boolean;consumeClick:boolean}|undefined>(undefined);
  const s = scale || 1;
  const stroke = Math.max(.5, line.thicknessMm / Math.max(mmPerWorldUnit, 1));
  const cancel = () => { if (hold.current) window.clearTimeout(hold.current.timer); hold.current = undefined; };
  const startHold = (event: React.PointerEvent<SVGLineElement>, segmentId: string) => {
    cancel();
    hold.current = {
      pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      timer: window.setTimeout(() => {
        hold.current = undefined;
        if (isEditable) onSelectSegment?.(line.id, segmentId);
        else { onSelect(line.id); onEdit(line.id); }
      }, 500),
    };
  };
  const moveHold = (event: React.PointerEvent<SVGLineElement>) => {
    const current = hold.current;
    if (current?.pointerId === event.pointerId && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 10) cancel();
  };

  return <g className={`connected-line ${isSelected ? "is-selected" : ""} ${isEditable ? "is-editable" : ""}`} opacity={line.opacity}>
    {line.segments.map(segment => { const pair = segmentNodes(line, segment); if (!pair) return null;const label=measurementPosition(pair.start,pair.end,segment.measurementAngle,segment.measurementDistancePx,s); return <g key={segment.id}>
      <line className={`connected-line__segment connected-line__segment--${line.lineStyle} ${selectedSegmentId === segment.id ? "is-selected" : ""}`} x1={pair.start.x} y1={pair.start.y} x2={pair.end.x} y2={pair.end.y} style={{ stroke: line.colour, strokeWidth: stroke }} />
      <line className="connected-line__hit" data-annotation-hit="true" x1={pair.start.x} y1={pair.start.y} x2={pair.end.x} y2={pair.end.y}
        onPointerDown={event => startHold(event, segment.id)} onPointerMove={moveHold} onPointerUp={cancel} onPointerCancel={cancel} />
      {isEditable||line.showMeasurements ? <text className="connected-line__length" data-annotation-hit={isEditable?"true":undefined} x={label.x} y={label.y} fontSize={12 / s}
        onPointerDown={event=>{if(!isEditable)return;const target=event.currentTarget;measurementHold.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY,active:false,consumeClick:false,timer:window.setTimeout(()=>{const current=measurementHold.current;if(!current||current.pointerId!==event.pointerId)return;current.active=true;current.consumeClick=true;target.setPointerCapture(event.pointerId);onMeasurementStart?.(line.id,segment.id,event)},500)}}}
        onPointerMove={event=>{const current=measurementHold.current;if(!current||current.pointerId!==event.pointerId)return;if(!current.active&&Math.hypot(event.clientX-current.x,event.clientY-current.y)>10){window.clearTimeout(current.timer);measurementHold.current=undefined;return}if(current.active){event.preventDefault();event.stopPropagation();onMeasurementUpdate?.(line.id,segment.id,event)}}}
        onPointerUp={event=>{const current=measurementHold.current;if(!current||current.pointerId!==event.pointerId)return;window.clearTimeout(current.timer);if(current.active){event.stopPropagation();onMeasurementEnd?.(line.id,segment.id,event)}setTimeout(()=>{measurementHold.current=undefined},0)}} onPointerCancel={()=>{if(measurementHold.current)window.clearTimeout(measurementHold.current.timer);measurementHold.current=undefined}}
        onClick={event => { event.stopPropagation();if(measurementHold.current?.consumeClick)return;onEditLength?.(line.id, segment.id); }}>{formatLength(segmentLength(line, segment.id) * mmPerWorldUnit)}</text> : null}
    </g>; })}
    {isEditable ? line.nodeOrder.map(id => { const node = lineNode(line, id); return node ? <g key={id} className="edit-handle-group"><circle className={`connected-line__node ${node.locked ? "is-locked" : ""}`} cx={node.x} cy={node.y} r={11 / s}/><circle className="edit-handle-hit" data-annotation-hit="true" cx={node.x} cy={node.y} r={24/s}
      onPointerDown={event => { event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onNodeStart?.(line.id, id, event); }}
      onPointerMove={event => { event.stopPropagation(); onNodeUpdate?.(line.id, id, event); }}
      onPointerUp={event => { event.stopPropagation(); onNodeEnd?.(line.id, id, event); }} onPointerCancel={event=>onNodeEnd?.(line.id,id,event)}/></g> : null; }) : null}
    {isEditable||line.showAngles?line.nodeOrder.slice(1,-1).map(id=>{const visual=getAngleVisual(line,id,26/s);return visual?<g key={`angle-${id}`} className="connected-line__angle" data-annotation-hit={isEditable?"true":undefined} onPointerDown={event=>isEditable&&event.stopPropagation()} onClick={event=>{if(!isEditable)return;event.stopPropagation();onEditAngle?.(line.id,id)}}><path d={visual.path}/><text x={visual.label.x} y={visual.label.y} fontSize={12/s}>{Math.round(visual.angle)}°</text></g>:null}):null}
  </g>;
}

export function LineDraftRenderer({ points, preview, scale }: { points: Array<{ x: number; y: number }>; preview?: { x: number; y: number }; scale: number }) { const all = preview && points.length ? [...points, preview] : points, s = scale || 1; return <g className="connected-line is-draft">{all.slice(0, -1).map((point, index) => <line key={index} className="connected-line__segment" x1={point.x} y1={point.y} x2={all[index + 1].x} y2={all[index + 1].y} />)}{points.map((point, index) => <circle key={index} className="connected-line__node" cx={point.x} cy={point.y} r={5 / s} />)}</g>; }
function formatLength(mm: number) { return mm >= 1000 ? `${(mm / 1000).toFixed(2)} m` : `${Math.round(mm)} mm`; }
function measurementPosition(start:{x:number;y:number},end:{x:number;y:number},angle:number|undefined,distancePx:number|undefined,scale:number){const mid={x:(start.x+end.x)/2,y:(start.y+end.y)/2};let a=angle;if(a===undefined){const dx=end.x-start.x,dy=end.y-start.y;a=Math.atan2(dx,-dy);if(Math.sin(a)>0)a+=Math.PI}const distance=(distancePx??24)/scale;return{x:mid.x+Math.cos(a)*distance,y:mid.y+Math.sin(a)*distance}}
function getAngleVisual(line:LineAnnotation,nodeId:string,r:number){const index=line.nodeOrder.indexOf(nodeId),p=lineNode(line,nodeId),a=lineNode(line,line.nodeOrder[index-1]),b=lineNode(line,line.nodeOrder[index+1]),angle=cornerAngle(line,nodeId);if(!p||!a||!b||angle===undefined)return;const l1=Math.hypot(a.x-p.x,a.y-p.y)||1,l2=Math.hypot(b.x-p.x,b.y-p.y)||1,u1={x:(a.x-p.x)/l1,y:(a.y-p.y)/l1},u2={x:(b.x-p.x)/l2,y:(b.y-p.y)/l2},cross=u1.x*u2.y-u1.y*u2.x,start={x:p.x+u1.x*r,y:p.y+u1.y*r},end={x:p.x+u2.x*r,y:p.y+u2.y*r},sum={x:u1.x+u2.x,y:u1.y+u2.y},sl=Math.hypot(sum.x,sum.y)||1,label={x:p.x+sum.x/sl*r*1.55,y:p.y+sum.y/sl*r*1.55},isRightAngle=Math.abs(angle-90)<.5,path=isRightAngle?`M ${start.x} ${start.y} L ${p.x+(u1.x+u2.x)*r} ${p.y+(u1.y+u2.y)*r} L ${end.x} ${end.y}`:`M ${start.x} ${start.y} A ${r} ${r} 0 0 ${cross>=0?1:0} ${end.x} ${end.y}`;return{angle,label,path}}
