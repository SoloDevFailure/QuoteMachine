import { useEffect, useRef } from "react";
import type { NoteAnnotation } from "../annotationTypes";

export type NoteEditHandle = "anchor" | "text" | "leader" | "resize";
type Props = { note: NoteAnnotation; isSelected: boolean; isEditable: boolean; isTextEditing?:boolean; scale: number; exportPreview?:boolean; onSelect(id:string):void; onEdit(id:string):void; onTextChange?(id:string,text:string):void; onTextCommit?(id:string):void; onHandleStart?(id:string,handle:NoteEditHandle,event:React.PointerEvent<SVGElement>):void; onHandleUpdate?(id:string,handle:NoteEditHandle,event:React.PointerEvent<SVGElement>):void; onHandleEnd?(id:string,handle:NoteEditHandle,event:React.PointerEvent<SVGElement>):void };

export function NoteRenderer({note,isSelected,isEditable,isTextEditing,scale,exportPreview,onSelect,onEdit,onTextChange,onTextCommit,onHandleStart,onHandleUpdate,onHandleEnd}:Props) {
  const holdTimer=useRef<number|undefined>(undefined); const holdActivated=useRef(false); const editDragStarted=useRef(false); const holdStart=useRef<{x:number;y:number}|undefined>(undefined); const inputRef=useRef<HTMLTextAreaElement>(null);
  const lines=note.text.split("\n"); const longest=Math.max(4,...lines.map(line=>line.length));
  const s=scale||1, pad=7/s, font=14/s, width=note.boxWidth?note.boxWidth/s:Math.min(280,Math.max(70,longest*7+18))/s, height=note.boxHeight?note.boxHeight/s:Math.max(30,lines.length*19+12)/s,boxX=note.boxWidth?note.textPosition.x-width/2:note.textPosition.x-pad,boxY=note.textPosition.y-height/2;
  const bubbleCenter={x:boxX+width/2,y:boxY+height/2};
  const textHandlePosition={x:bubbleCenter.x,y:boxY-11/s};
  const hasLeader=note.hasLeader!==false,arrow=leaderArrow(bubbleCenter,note.anchor,8/s,4/s);
  useEffect(()=>{if(isTextEditing){inputRef.current?.focus();inputRef.current?.setSelectionRange(note.text.length,note.text.length)}},[isTextEditing]);
  const cancelHold=()=>{if(holdTimer.current!==undefined)window.clearTimeout(holdTimer.current);holdTimer.current=undefined;holdStart.current=undefined};
  const angle=((note.rotation??0)+360)%360; const readable=angle>90&&angle<270?angle+180:angle;
  const handle=(kind:NoteEditHandle)=>(e:React.PointerEvent<SVGElement>)=>{e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);onSelect(note.id);onHandleStart?.(note.id,kind,e)};
  return <g className={`note-object ${isSelected?"is-selected":""}`}>
    {hasLeader?<><line className="note-leader" x1={bubbleCenter.x} y1={bubbleCenter.y} x2={note.anchor.x} y2={note.anchor.y}/><polygon className="note-arrowhead" points={arrow.map(point=>`${point.x},${point.y}`).join(" ")}/></>:null}
    <g transform={`rotate(${readable} ${note.textPosition.x} ${note.textPosition.y})`}>
      <rect className="note-bubble" x={boxX} y={boxY} width={width} height={height} rx={5/s}/>
      {isTextEditing ? <foreignObject x={boxX} y={boxY} width={width} height={height}>
        <textarea ref={inputRef} className="note-inline-editor" style={{fontSize:font,lineHeight:`${19/s}px`,padding:`${5/s}px ${7/s}px`}} value={note.text} aria-label="Edit note text" onPointerDown={event=>event.stopPropagation()} onPointerMove={event=>event.stopPropagation()} onPointerUp={event=>event.stopPropagation()} onChange={event=>onTextChange?.(note.id,event.target.value)} onBlur={()=>onTextCommit?.(note.id)} />
      </foreignObject> : <>
        {lines.map((line,index)=><text key={index} className="note-text" x={boxX+pad} y={note.textPosition.y+(index-(lines.length-1)/2)*19/s} fontSize={font} dominantBaseline="middle">{line||" "}</text>)}
        <rect className="note-hit-zone" data-annotation-hit="true" x={boxX} y={boxY} width={width} height={height}
          onPointerDown={event=>{onSelect(note.id);cancelHold();holdActivated.current=false;editDragStarted.current=false;event.currentTarget.setPointerCapture(event.pointerId);holdStart.current={x:event.clientX,y:event.clientY};if(isEditable){event.preventDefault();event.stopPropagation()}else{holdTimer.current=window.setTimeout(()=>{holdActivated.current=true;if(exportPreview)onHandleStart?.(note.id,"text",event);else onEdit(note.id)},500)}}}
          onPointerMove={event=>{const start=holdStart.current;if(exportPreview&&holdActivated.current){event.preventDefault();event.stopPropagation();onHandleUpdate?.(note.id,"text",event);return}if(isEditable&&start){const moved=Math.hypot(event.clientX-start.x,event.clientY-start.y);if(!editDragStarted.current&&moved>8){editDragStarted.current=true;onHandleStart?.(note.id,"leader",event)}if(editDragStarted.current){event.preventDefault();event.stopPropagation();onHandleUpdate?.(note.id,"leader",event)}return}if(start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>10)cancelHold()}}
          onPointerUp={event=>{if(exportPreview&&holdActivated.current){event.stopPropagation();onHandleEnd?.(note.id,"text",event);cancelHold();return}if(isEditable&&editDragStarted.current){event.preventDefault();event.stopPropagation();onHandleEnd?.(note.id,"leader",event);editDragStarted.current=false;cancelHold();return}if(isEditable){event.preventDefault();event.stopPropagation()}cancelHold();if(isEditable)window.setTimeout(()=>onEdit(note.id),0)}}
          onPointerCancel={cancelHold}
          onClick={event=>event.stopPropagation()}/>
      </>}
    </g>
    {isSelected&&isEditable?<>{hasLeader?<NoteHandle x={note.anchor.x} y={note.anchor.y} visualRadius={6/s} hitRadius={22/s} className="object-edit-handle" onDown={handle("anchor")} onMove={e=>onHandleUpdate?.(note.id,"anchor",e)} onUp={e=>onHandleEnd?.(note.id,"anchor",e)}/>:null}<line className="note-text-handle-stem" x1={bubbleCenter.x} y1={boxY} x2={textHandlePosition.x} y2={textHandlePosition.y}/><NoteHandle x={textHandlePosition.x} y={textHandlePosition.y} visualRadius={7/s} hitRadius={22/s} className="object-edit-handle object-edit-handle--move" onDown={handle("text")} onMove={e=>onHandleUpdate?.(note.id,"text",e)} onUp={e=>onHandleEnd?.(note.id,"text",e)}/><NoteHandle x={boxX+width} y={boxY+height} visualRadius={5/s} hitRadius={22/s} className="note-resize-handle" onDown={handle("resize")} onMove={e=>onHandleUpdate?.(note.id,"resize",e)} onUp={e=>onHandleEnd?.(note.id,"resize",e)}/></>:null}
  </g>;
}
function NoteHandle({x,y,visualRadius,hitRadius,className,onDown,onMove,onUp}:{x:number;y:number;visualRadius:number;hitRadius:number;className:string;onDown:(event:React.PointerEvent<SVGElement>)=>void;onMove:(event:React.PointerEvent<SVGElement>)=>void;onUp:(event:React.PointerEvent<SVGElement>)=>void}){return <g className="edit-handle-group"><circle className={className} cx={x} cy={y} r={visualRadius}/><circle className="edit-handle-hit" data-annotation-hit="true" cx={x} cy={y} r={hitRadius} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}/></g>}
function leaderArrow(from:{x:number;y:number},tip:{x:number;y:number},length:number,halfWidth:number){const distance=Math.hypot(tip.x-from.x,tip.y-from.y)||1,ux=(tip.x-from.x)/distance,uy=(tip.y-from.y)/distance,base={x:tip.x-ux*length,y:tip.y-uy*length},px=-uy,py=ux;return[tip,{x:base.x+px*halfWidth,y:base.y+py*halfWidth},{x:base.x-px*halfWidth,y:base.y-py*halfWidth}]}
