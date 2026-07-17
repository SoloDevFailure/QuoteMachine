import { ChevronDown, ChevronUp, Eye, EyeOff, Layers3, Pencil, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { createId } from "../../../utils/ids";
import type { DrawingLayer } from "../drawingTypes";

type Props = { layers: DrawingLayer[]; activeLayerId: string; onChange(layers: DrawingLayer[], active: string): void };

export function LayerMenu({ layers, activeLayerId, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [reorderId, setReorderId] = useState<string>();
  const holdTimer = useRef<number | undefined>(undefined);
  const holdActivated = useRef(false);
  const sorted = [...layers].sort((a, b) => b.order - a.order);
  const active = layers.find((layer) => layer.id === activeLayerId) ?? layers[0];

  function update(next: DrawingLayer[], activeId = activeLayerId) {
    onChange(next.map((layer, order) => ({ ...layer, order })), activeId);
  }

  function move(id: string, delta: number) {
    const ascending = [...layers].sort((a, b) => a.order - b.order);
    const from = ascending.findIndex((layer) => layer.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ascending.length) return;
    [ascending[from], ascending[to]] = [ascending[to], ascending[from]];
    update(ascending, id);
  }

  function beginHold(id: string) {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdActivated.current = false;
    holdTimer.current = window.setTimeout(() => { holdActivated.current = true; setReorderId(id); }, 500);
  }

  function cancelHold() {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = undefined;
  }

  return (
    <div className="layer-menu">
      <button className={`layer-menu__trigger layer-menu__pill ${reorderId === active?.id ? "is-reordering" : ""}`} type="button" onPointerDown={() => active && beginHold(active.id)} onPointerUp={cancelHold} onPointerCancel={cancelHold} onClick={() => { if (holdActivated.current) { holdActivated.current = false; setOpen(true); return; } setOpen((value) => !value); }}>
        <Layers3 size={17} />
        <span>{active?.name ?? "Layer 0"}</span>
        <small>{active ? `${sorted.findIndex((layer) => layer.id === active.id) + 1}/${layers.length}` : ""}</small>
        <ChevronDown size={16} />
      </button>
      {open ? (
        <div className="layer-menu__stack">
          <div className="layer-menu__order-key"><span>TOP</span><i/><span>BOTTOM</span></div>
          {sorted.map((layer) => (
            <div className={`layer-menu__item ${activeLayerId === layer.id ? "is-active" : ""} ${reorderId === layer.id ? "is-reordering" : ""}`} key={layer.id}>
              <div className="layer-menu__actions">
                {reorderId === layer.id ? <><button type="button" aria-label="Move layer up" title="Move above" onClick={() => move(layer.id, 1)}><ChevronUp size={16} /></button><button type="button" aria-label="Move layer down" title="Move below" onClick={() => move(layer.id, -1)}><ChevronDown size={16} /></button></> : <><button type="button" aria-label={layer.visible ? "Hide layer" : "Show layer"} onClick={() => update(layers.map((item) => item.id === layer.id ? { ...item, visible: !item.visible } : item))}>{layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button><button type="button" aria-label="Rename layer" onClick={() => { const name = window.prompt("Layer name", layer.name)?.trim(); if (name) update(layers.map((item) => item.id === layer.id ? { ...item, name } : item), layer.id); }}><Pencil size={15} /></button></>}
              </div>
              <button className="layer-menu__pill layer-menu__layer" type="button" onPointerDown={() => beginHold(layer.id)} onPointerUp={cancelHold} onPointerCancel={cancelHold} onClick={() => onChange(layers, layer.id)}><small>{sorted.findIndex((item) => item.id === layer.id) + 1}</small><span>{layer.name}</span></button>
              <button className="layer-menu__remove" type="button" aria-label={`Remove ${layer.name}`} disabled={layers.length === 1} onClick={() => { const next = layers.filter((item) => item.id !== layer.id); update(next, activeLayerId === layer.id ? next[0].id : activeLayerId); }}><X size={15} /></button>
            </div>
          ))}
          <button className="layer-menu__pill layer-menu__add" type="button" onClick={() => { const name = window.prompt("Layer name", `Layer ${layers.length}`)?.trim(); if (!name) return; const id = createId(); update([...layers, { id, name, visible: true, order: layers.length }], id); }}><Plus size={17} /><span>Add layer</span></button>
        </div>
      ) : null}
    </div>
  );
}
