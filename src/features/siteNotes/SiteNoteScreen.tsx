import { ArrowLeft, Camera, ChevronDown, ChevronRight, GripVertical, MoreVertical, PencilRuler, Plus, Sparkles, Trash2, Type } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { IconButton } from "../../components/IconButton";
import { ResponsivePage } from "../../components/ResponsivePage";
import { createImageAsset } from "../assets/imageImport";
import { createDrawing, getProjectDrawings } from "../drawings/drawingStore";
import type { Drawing } from "../drawings/drawingTypes";
import { DrawingPreview } from "../drawings/preview/DrawingPreview";
import type { Project } from "../projects/projectTypes";
import { PhotoContentView } from "./PhotoContentView";
import { SectionOverview } from "./SectionOverview";
import { SiteNoteText } from "./SiteNoteText";
import { addSection, deleteContent, deleteSection, getSiteNoteDocument, insertDrawing, insertPhoto, insertText, moveContentToSection, reorderContents, reorderSections, updateSection } from "./siteNoteStore";
import type { DrawingContent, SiteNoteContent, SiteNoteDocument, SiteNoteSection, TextContent } from "./siteNoteTypes";

type Props = { project: Project; siteNoteId: string; focusSectionId?: string; onBack: () => void; onOpenDrawing: (drawingId: string, sectionId: string) => void };

export function SiteNoteScreen({ project, siteNoteId, focusSectionId, onBack, onOpenDrawing }: Props) {
  const [document, setDocument] = useState<SiteNoteDocument | null>();
  const [activeSectionId, setActiveSectionId] = useState(focusSectionId);
  const [insertion, setInsertion] = useState<{ sectionId: string; index: number }>();
  const [menuSection, setMenuSection] = useState<SiteNoteSection>();
  const [deleteTarget, setDeleteTarget] = useState<SiteNoteSection>();
  const [deleteItem, setDeleteItem] = useState<SiteNoteContent>();
  const [itemMenu, setItemMenu] = useState<SiteNoteContent>();
  const [drawingPicker, setDrawingPicker] = useState<{ sectionId: string; index: number }>();
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [overview, setOverview] = useState<{ original: SiteNoteSection[]; activeId?: string }>();
  const [moving, setMoving] = useState<{ sectionId: string; itemId: string; original: SiteNoteContent[] }>();
  const [photoUrl, setPhotoUrl] = useState<string>();
  const [aiMessage, setAiMessage] = useState(false);
  const [photoSourceOpen, setPhotoSourceOpen] = useState(false);
  const [focusTextId, setFocusTextId] = useState<string>();
  const [operationError, setOperationError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const hold = useRef<{ timer: number; x: number; y: number; id: string; kind: "section" | "content"; sectionId?: string } | undefined>(undefined);
  const suppressTap = useRef(false);

  const refresh = useCallback(async () => setDocument((await getSiteNoteDocument(siteNoteId)) ?? null), [siteNoteId]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (!document || !focusSectionId) return; requestAnimationFrame(() => { const section = globalThis.document.getElementById(`site-section-${focusSectionId}`); section?.scrollIntoView({ block: "center" }); const title = section?.querySelector<HTMLInputElement>(".site-section-header input"); if (title?.value === "New Section") { title.focus(); title.select(); } }); }, [document, focusSectionId]);
  useEffect(() => { const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { if (overview) { setDocument((current) => current ? { ...current, sections: overview.original } : current); setOverview(undefined); } if (moving) { setDocument((current) => current ? { ...current, contents: [...current.contents.filter((item) => item.sectionId !== moving.sectionId), ...moving.original] } : current); setMoving(undefined); } } }; addEventListener("keydown", escape); return () => removeEventListener("keydown", escape); }, [moving, overview]);

  if (document === undefined) return <main className="app-shell app-shell--centered"><p className="muted-text">Opening Site Notes…</p></main>;
  if (document === null) return <main className="app-shell"><header className="dashboard-header"><IconButton icon={<ArrowLeft size={22}/>} label="Back" onClick={onBack}/></header><section className="empty-state"><h2>Site Notes not found</h2><p>This document is no longer available in the local workspace.</p></section></main>;
  const { note, sections, contents } = document;
  const sectionContents = (sectionId: string) => contents.filter((item) => item.sectionId === sectionId).sort((a, b) => a.order - b.order);
  const setContentsForSection = (sectionId: string, next: SiteNoteContent[]) => setDocument((current) => current ? { ...current, contents: [...current.contents.filter((item) => item.sectionId !== sectionId), ...next] } : current);

  function beginHold(event: React.PointerEvent, id: string, kind: "section" | "content", sectionId?: string) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    cancelHold(); const x = event.clientX, y = event.clientY;
    hold.current = { x, y, id, kind, sectionId, timer: window.setTimeout(() => { suppressTap.current = true; navigator.vibrate?.(18); if (kind === "section") setOverview({ original: sections, activeId: id }); else if (sectionId) setMoving({ sectionId, itemId: id, original: sectionContents(sectionId) }); }, 500) };
  }
  function moveHold(event: React.PointerEvent) {
    const current = hold.current; if (!current) return;
    if (!overview && !moving && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 10) { cancelHold(); return; }
    if (overview) { const id = documentFromPoint(event.clientX, event.clientY, "overviewSection"); if (id) hoverSection(id); }
    if (moving && current.sectionId) { const id = documentFromPoint(event.clientX, event.clientY, "contentId"); if (id) hoverContent(current.sectionId, id); autoScroll(event.clientY); }
  }
  async function endHold() {
    cancelHold();
    try {
      if (overview?.activeId) { const ordered = await reorderSections(note, sections); setDocument((current) => current ? { ...current, sections: ordered, note: { ...note, updatedAt: new Date().toISOString() } } : current); setOverview(undefined); }
      if (moving) { const ordered = await reorderContents(note, moving.sectionId, sectionContents(moving.sectionId)); setContentsForSection(moving.sectionId, ordered); setMoving(undefined); }
      setOperationError(undefined);
    } catch (error) { setOperationError(messageFrom(error)); }
    window.setTimeout(() => { suppressTap.current = false; }, 0);
  }
  function cancelHold() { if (hold.current) window.clearTimeout(hold.current.timer); hold.current = undefined; }
  function hoverSection(id: string) { if (!overview?.activeId || id === overview.activeId) return; const from = sections.findIndex((item) => item.id === overview.activeId), to = sections.findIndex((item) => item.id === id); const next = [...sections], [item] = next.splice(from, 1); next.splice(to, 0, item); setDocument({ ...document!, sections: next }); }
  function hoverContent(sectionId: string, id: string) { if (!moving || id === moving.itemId) return; const items = sectionContents(sectionId), from = items.findIndex((item) => item.id === moving.itemId), to = items.findIndex((item) => item.id === id); if (from < 0 || to < 0) return; const next = [...items], [item] = next.splice(from, 1); next.splice(to, 0, item); setContentsForSection(sectionId, next.map((value, order) => ({ ...value, order }))); }

  async function createSection() { try { const result = await addSection(note, sections); setDocument({ ...document!, sections: [...sections, result.section], contents: [...contents, result.content] }); setActiveSectionId(result.section.id); setOperationError(undefined); requestAnimationFrame(() => { const section = globalThis.document.getElementById(`site-section-${result.section.id}`); section?.scrollIntoView({ behavior: "smooth", block: "center" }); const title = section?.querySelector<HTMLInputElement>(".site-section-header input"); title?.focus(); title?.select(); }); } catch (error) { setOperationError(messageFrom(error)); } }
  async function addTextAt(sectionId: string, index: number) { const items = sectionContents(sectionId), item = await insertText(note, sectionId, items, index); setContentsForSection(sectionId, [...items.slice(0, index), item, ...items.slice(index)].map((value, order) => ({ ...value, order }))); setFocusTextId(item.id); setInsertion(undefined); }
  function choosePhoto(sectionId: string, index: number) { setInsertion({ sectionId, index }); setPhotoSourceOpen(true); }
  async function onPhoto(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file || !insertion) return; try { const asset = await createImageAsset(project.id, file), items = sectionContents(insertion.sectionId); const item = await insertPhoto(note, insertion.sectionId, asset, items, insertion.index); setContentsForSection(insertion.sectionId, [...items.slice(0, insertion.index), item, ...items.slice(insertion.index)].map((value, order) => ({ ...value, order }))); setOperationError(undefined); event.target.value = ""; setInsertion(undefined); } catch (error) { setOperationError(messageFrom(error)); } }
  async function chooseDrawing(drawing?: Drawing) { if (!drawingPicker) return; try { const selected = drawing ?? await createDrawing(project.id, { name: `Site sketch · ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date())}`, backgroundType: "blank" }); const items = sectionContents(drawingPicker.sectionId); const item = await insertDrawing(note, drawingPicker.sectionId, selected.id, items, drawingPicker.index); setContentsForSection(drawingPicker.sectionId, [...items.slice(0, drawingPicker.index), item, ...items.slice(drawingPicker.index)].map((value, order) => ({ ...value, order }))); const sectionId = drawingPicker.sectionId; setDrawingPicker(undefined); setOperationError(undefined); onOpenDrawing(selected.id, sectionId); } catch (error) { setOperationError(messageFrom(error)); } }
  async function openDrawingPicker(sectionId: string, index: number) { setInsertion({ sectionId, index }); setDrawings(await getProjectDrawings(project.id)); setDrawingPicker({ sectionId, index }); }

  return <ResponsivePage className={`site-note-screen ${moving ? "is-moving-content" : ""}`}>
    <header className="site-note-header"><IconButton icon={<ArrowLeft size={23}/>} label="Back" onClick={onBack}/><div><h1>{project.name}</h1><span>Site Notes</span></div><button className="site-note-add" type="button" aria-label="Add section" onClick={createSection}><Plus/></button></header>
    <input ref={fileInput} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={onPhoto}/><input ref={libraryInput} className="visually-hidden" type="file" accept="image/*" onChange={onPhoto}/>
    {operationError ? <div className="site-note-error" role="alert"><span><strong>Changes could not be saved</strong>{operationError}</span><button type="button" onClick={() => setOperationError(undefined)}>Dismiss</button></div> : null}
    <div className="site-note-sections">{sections.map((section) => {
      const items = sectionContents(section.id), active = activeSectionId === section.id;
      return <section id={`site-section-${section.id}`} className={`site-note-section ${active ? "is-active" : ""} ${section.collapsed ? "is-collapsed" : ""}`} key={section.id} onPointerDown={() => setActiveSectionId(section.id)}>
        <header className="site-section-header" onPointerDown={(event) => beginHold(event, section.id, "section")} onPointerMove={moveHold} onPointerUp={endHold} onPointerCancel={cancelHold}>
          <input value={section.title} aria-label="Section title" onPointerDown={(event) => event.stopPropagation()} onChange={(event) => setDocument({ ...document, sections: sections.map((item) => item.id === section.id ? { ...item, title: event.target.value } : item) })} onBlur={async (event) => { const updated = await updateSection(note, section, { title: event.target.value.trim() || "Untitled Section" }); setDocument((current) => current ? { ...current, sections: current.sections.map((item) => item.id === updated.id ? updated : item) } : current); }}/>
          <span className="site-section-count">{items.length} item{items.length === 1 ? "" : "s"}</span>
          <button type="button" aria-label={section.collapsed ? "Expand section" : "Collapse section"} onPointerDown={(event) => event.stopPropagation()} onClick={async () => { const updated = await updateSection(note, section, { collapsed: !section.collapsed }); setDocument({ ...document, sections: sections.map((item) => item.id === section.id ? updated : item) }); }}><span>{section.collapsed ? <ChevronRight/> : <ChevronDown/>}</span></button>
          <button type="button" aria-label="Section options" onPointerDown={(event) => event.stopPropagation()} onClick={() => setMenuSection(section)}><MoreVertical/></button>
        </header>
        {!section.collapsed ? <><div className="site-content-stream">{items.map((item, index) => <div key={item.id} className={`site-content ${moving?.itemId === item.id ? "is-picked-up" : ""}`} data-content-id={item.id} onPointerDown={(event) => { if (item.type !== "text" || event.target === event.currentTarget) beginHold(event, item.id, "content", section.id); }} onPointerMove={moveHold} onPointerUp={endHold} onPointerCancel={cancelHold}>
          <InsertionGap active={active && insertion?.sectionId === section.id && insertion.index === index} onActivate={() => setInsertion({ sectionId: section.id, index })} onText={() => addTextAt(section.id, index)} onPhoto={() => choosePhoto(section.id, index)} onSketch={() => openDrawingPicker(section.id, index)}/>
          {item.type === "text" ? <SiteNoteText note={note} content={item} autoFocus={focusTextId === item.id} onSaved={(updated) => setDocument((current) => current ? { ...current, contents: current.contents.map((value) => value.id === updated.id ? updated : value) } : current)}/> : item.type === "photo" ? <PhotoContentView assetId={item.assetId} onOpen={(url) => { if (!suppressTap.current) setPhotoUrl(url); }}/> : <button className="site-drawing" type="button" onClick={() => { if (!suppressTap.current) onOpenDrawing(item.drawingId, section.id); }}><DrawingPreview drawingId={item.drawingId} label="Site sketch preview"/><span><strong>Site sketch</strong><small>Tap to open drawing</small></span></button>}
          {item.type === "text" ? <button className="content-hold" type="button" aria-label="Hold to move text" onPointerDown={(event) => beginHold(event, item.id, "content", section.id)} onPointerMove={moveHold} onPointerUp={endHold} onPointerCancel={cancelHold}><GripVertical size={17}/></button> : null}
          <button className="content-delete" type="button" aria-label={`${item.type} options`} onClick={() => setItemMenu(item)}><MoreVertical size={18}/></button>
        </div>)}<InsertionGap active={active && insertion?.sectionId === section.id && insertion.index === items.length} onActivate={() => setInsertion({ sectionId: section.id, index: items.length })} onText={() => addTextAt(section.id, items.length)} onPhoto={() => choosePhoto(section.id, items.length)} onSketch={() => openDrawingPicker(section.id, items.length)}/></div>
        <div className="site-section-actions"><button type="button" onClick={() => choosePhoto(section.id, items.length)}><Camera/><span>Photo</span></button><button type="button" onClick={() => openDrawingPicker(section.id, items.length)}><PencilRuler/><span>Sketch</span></button><button type="button" onClick={() => setAiMessage(true)}><Sparkles/><span>AI Notes</span></button></div></> : null}
      </section>;
    })}</div>
    <button className="add-section-button" type="button" onClick={createSection}><Plus/> Add Section</button>

    {overview ? <SectionOverview sections={sections} contents={contents} activeId={overview.activeId} onHover={hoverSection} onCommit={endHold} onCancel={() => { setDocument({ ...document, sections: overview.original }); setOverview(undefined); }} onNavigate={(id) => { setOverview(undefined); requestAnimationFrame(() => globalThis.document.getElementById(`site-section-${id}`)?.scrollIntoView({ behavior: "smooth" })); }}/>:null}
    {photoUrl ? <div className="photo-lightbox" role="dialog" aria-modal="true" onClick={() => setPhotoUrl(undefined)}><img src={photoUrl} alt="Site note enlarged"/><button type="button" aria-label="Close photo">×</button></div>:null}
    <BottomSheet title="Section options" isOpen={Boolean(menuSection)} onDismiss={() => setMenuSection(undefined)}><div className="action-list"><button className="action-row" type="button" onClick={() => { if (menuSection) setDeleteTarget(menuSection); setMenuSection(undefined); }}><span className="action-row__icon"><Trash2/></span><span><strong>Delete section</strong><small>Remove this section and its content</small></span></button></div></BottomSheet>
    <BottomSheet title="Delete section?" isOpen={Boolean(deleteTarget)} placement="center" onDismiss={() => setDeleteTarget(undefined)}><p className="muted-text">{deleteTarget && sectionContents(deleteTarget.id).some((item) => item.type !== "text" || item.text.trim()) ? "This section contains notes, photos or drawings. This cannot be undone." : "Remove this empty section?"}</p><div className="sheet-actions"><button className="secondary-button" type="button" onClick={() => setDeleteTarget(undefined)}>Cancel</button><button className="danger-button" type="button" onClick={async () => { if (!deleteTarget) return; const remaining = sections.filter((item) => item.id !== deleteTarget.id); await deleteSection(note, deleteTarget, remaining); setDocument({ ...document, sections: remaining, contents: contents.filter((item) => item.sectionId !== deleteTarget.id) }); setDeleteTarget(undefined); }}>Delete</button></div></BottomSheet>
    <BottomSheet title={`Delete ${deleteItem?.type ?? "item"}?`} isOpen={Boolean(deleteItem)} placement="center" onDismiss={() => setDeleteItem(undefined)}><p className="muted-text">This removes the item from this section.</p><div className="sheet-actions"><button className="secondary-button" type="button" onClick={() => setDeleteItem(undefined)}>Cancel</button><button className="danger-button" type="button" onClick={async () => { if (!deleteItem) return; const remaining = sectionContents(deleteItem.sectionId).filter((item) => item.id !== deleteItem.id); await deleteContent(note, deleteItem, remaining); setContentsForSection(deleteItem.sectionId, remaining); setDeleteItem(undefined); }}>Delete</button></div></BottomSheet>
    <BottomSheet title="Item options" isOpen={Boolean(itemMenu)} onDismiss={() => setItemMenu(undefined)}><div className="action-list">{itemMenu && sections.filter((section) => section.id !== itemMenu.sectionId).map((section) => <button className="action-row" type="button" key={section.id} onClick={async () => { const sourceId = itemMenu.sectionId; const result = await moveContentToSection(note, itemMenu, sectionContents(sourceId), section.id, sectionContents(section.id)); setDocument((current) => current ? { ...current, contents: [...current.contents.filter((value) => value.sectionId !== sourceId && value.sectionId !== section.id), ...result.source, ...result.destination] } : current); setItemMenu(undefined); }}><span className="action-row__icon"><ChevronRight/></span><span><strong>Move to {section.title}</strong><small>Place at the end of this section</small></span></button>)}<button className="action-row" type="button" onClick={() => { setDeleteItem(itemMenu); setItemMenu(undefined); }}><span className="action-row__icon"><Trash2/></span><span><strong>Delete item</strong><small>Remove it from this section</small></span></button></div></BottomSheet>
    <BottomSheet title="Add a sketch" isOpen={Boolean(drawingPicker)} onDismiss={() => setDrawingPicker(undefined)}><div className="action-list"><button className="action-row" type="button" onClick={() => chooseDrawing()}><span className="action-row__icon"><Plus/></span><span><strong>New sketch</strong><small>Open a fresh ForteStack drawing</small></span></button>{drawings.map((drawing) => <button className="action-row" type="button" key={drawing.id} onClick={() => chooseDrawing(drawing)}><span className="action-row__icon"><PencilRuler/></span><span><strong>{drawing.name}</strong><small>Insert existing drawing</small></span></button>)}</div></BottomSheet>
    <BottomSheet title="Add a photo" isOpen={photoSourceOpen} placement="center" onDismiss={() => setPhotoSourceOpen(false)}><div className="action-list"><button className="action-row" type="button" onClick={() => { setPhotoSourceOpen(false); fileInput.current?.click(); }}><span className="action-row__icon"><Camera/></span><span><strong>Take photo</strong><small>Open the camera</small></span></button><button className="action-row" type="button" onClick={() => { setPhotoSourceOpen(false); libraryInput.current?.click(); }}><span className="action-row__icon"><Plus/></span><span><strong>Choose image</strong><small>Select an existing photo</small></span></button></div></BottomSheet>
    <BottomSheet title="AI Notes" isOpen={aiMessage} placement="center" onDismiss={() => setAiMessage(false)}><p className="muted-text">Section-specific AI Notes are coming in a future phase. No information has been sent anywhere.</p></BottomSheet>
  </ResponsivePage>;
}

function InsertionGap({ active, onActivate, onText, onPhoto, onSketch }: { active: boolean; onActivate: () => void; onText: () => void; onPhoto: () => void; onSketch: () => void }) {
  return <div className={`insertion-gap ${active ? "is-active" : ""}`}>{active ? <div className="insertion-tools"><button type="button" onClick={onText}><Type size={17}/>Text</button><button type="button" onClick={onPhoto}><Camera size={17}/>Photo</button><button type="button" onClick={onSketch}><PencilRuler size={17}/>Sketch</button></div> : <button type="button" aria-label="Insert content here" onClick={onActivate}><Plus size={15}/></button>}</div>;
}
function documentFromPoint(x: number, y: number, key: "overviewSection" | "contentId") { return (document.elementFromPoint(x, y)?.closest(`[data-${key === "overviewSection" ? "overview-section" : "content-id"}]`) as HTMLElement | null)?.dataset[key]; }
function autoScroll(y: number) { const edge = 80; if (y < edge) scrollBy({ top: -14 }); else if (y > innerHeight - edge) scrollBy({ top: 14 }); }
function messageFrom(error: unknown) { return error instanceof Error ? error.message : String(error); }
