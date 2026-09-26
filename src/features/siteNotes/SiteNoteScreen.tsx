import { ArrowDown, ArrowLeft, ArrowUp, Camera, ChevronDown, ChevronRight, FileDown, GripVertical, ImagePlus, Info, MoreVertical, PencilRuler, Plus, Trash2, Type } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { Brand } from "../../components/Brand";
import { StatusPill } from "../../components/StatusPill";
import { flushPendingSaves, flushSave, pendingSaveCount, queueSave, saveFailure, subscribeSaves } from "../../storage/pendingSaves";
import { createImageAsset } from "../assets/imageImport";
import { PhotoViewer } from "../assets/PhotoViewer";
import { createDrawing, deleteDrawing, renameDrawing, getProjectDrawings } from "../drawings/drawingStore";
import type { Drawing } from "../drawings/drawingTypes";
import { DrawingPreview } from "../drawings/preview/DrawingPreview";
import type { Project } from "../projects/projectTypes";
import { fullSiteAddress, projectLocation } from "../projects/projectLabels";
import { ProjectInfoSheet } from "../projects/ProjectInfoSheet";
import { PhotoContentView } from "./PhotoContentView";
import { SiteNoteText } from "./SiteNoteText";
import { addSection, deleteContent, deleteSection, getSiteNoteDocument, getSiteNotesByProject, insertDrawing, insertPhoto, insertText, moveContentToSection, reorderContents, reorderSections, updateSection } from "./siteNoteStore";
import type { SiteNote, SiteNoteContent, SiteNoteDocument, SiteNoteSection } from "./siteNoteTypes";
import { WorkOrderSheet } from "../documents/WorkOrderSheet";

type Props = { project: Project; siteNoteId: string; focusSectionId?: string; onBack: () => void; onOpenDrawing: (drawingId: string, sectionId: string) => void; onProjectChanged: () => Promise<void>; onSelectNote: (id:string) => void };
export function SiteNoteScreen({project,siteNoteId,focusSectionId,onBack,onOpenDrawing,onProjectChanged,onSelectNote}: Props) {
  const [doc,setDoc] = useState<SiteNoteDocument | null>(), [notes,setNotes] = useState<SiteNote[]>([]);
  const [tab,setTab] = useState("notes"), [drawings,setDrawings] = useState<Drawing[]>([]);
  const [drawingMenu,setDrawingMenu] = useState<Drawing>(), [drawingName,setDrawingName] = useState(""), [deleteDrawingPrompt,setDeleteDrawingPrompt] = useState(false);
  const [info,setInfo] = useState(false), [workOrder,setWorkOrder] = useState(false), [photoId,setPhotoId] = useState<string>();
  const [addAt,setAddAt] = useState<{sectionId:string;index:number}>(), [picker,setPicker] = useState(false);
  const [sectionMenu,setSectionMenu] = useState<SiteNoteSection>(), [itemMenu,setItemMenu] = useState<SiteNoteContent>();
  const [deleting,setDeleting] = useState<{section?:SiteNoteSection;item?:SiteNoteContent}>();
  const [busy,setBusy] = useState(false), [error,setError] = useState<string>(), [focusText,setFocusText] = useState<string>();
  const [,renderSave] = useState(0), [dragId,setDragId] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null), cameraInput = useRef<HTMLInputElement>(null);
  const docRef = useRef(doc); docRef.current = doc;
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const drag = useRef<{id:string;original:SiteNoteSection[]} | undefined>(undefined);
  const locked = useRef(false);
  const refresh = useCallback(async () => { setDoc((await getSiteNoteDocument(siteNoteId)) ?? null); setDrawings(await getProjectDrawings(project.id)); setNotes(await getSiteNotesByProject(project.id)); },[project.id,siteNoteId]);
  useEffect(() => { refresh().catch(e => setError(String(e))); return subscribeSaves(() => renderSave(v => v+1)); },[refresh]);
  useEffect(() => { if (doc && focusSectionId) requestAnimationFrame(() => document.getElementById(`site-section-${focusSectionId}`)?.scrollIntoView({block:"center"})); },[Boolean(doc),focusSectionId]);
  async function run(action: () => Promise<void> | void) {
    if (locked.current) return; locked.current = true; setBusy(true); setError(undefined);
    try { await flushPendingSaves(); await action(); }
    catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { locked.current = false; setBusy(false); }
  }
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!drag.current || !docRef.current) return;
      event.preventDefault();
      const target = document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-section-id]")?.dataset.sectionId;
      const current = docRef.current;
      if (target && target !== drag.current.id) {
        const next = [...current.sections], from = next.findIndex(s => s.id === drag.current!.id), to = next.findIndex(s => s.id === target);
        if (from >= 0 && to >= 0) { const [item] = next.splice(from,1); next.splice(to,0,item); const updated = {...current,sections:next}; docRef.current = updated; setDoc(updated); }
      }
      if (event.clientY < 145) window.scrollBy(0,-12); else if (event.clientY > innerHeight-110) window.scrollBy(0,12);
    };
    const end = () => {
      clearTimeout(hold.current);
      const active = drag.current, current = docRef.current; drag.current = undefined; setDragId(undefined);
      if (active && current) void run(async () => { try { await reorderSections(current.note,current.sections); await refresh(); } catch(e) { setDoc({...current,sections:active.original}); throw e; } });
    };
    const cancel = () => { clearTimeout(hold.current); if (drag.current && docRef.current) setDoc({...docRef.current,sections:drag.current.original}); drag.current = undefined; setDragId(undefined); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") cancel(); };
    window.addEventListener("pointermove",move,{passive:false}); window.addEventListener("pointerup",end); window.addEventListener("pointercancel",cancel); window.addEventListener("keydown",escape);
    return () => { clearTimeout(hold.current); window.removeEventListener("pointermove",move); window.removeEventListener("pointerup",end); window.removeEventListener("pointercancel",cancel); window.removeEventListener("keydown",escape); };
  },[refresh]);
  const itemsFor = (id:string) => doc?.contents.filter(i => i.sectionId === id).sort((a,b) => a.order-b.order) ?? [];
  async function newSection() {
    if (!doc) return;
    const result = await addSection(doc.note,doc.sections); await refresh(); setFocusText(result.content.id);
    requestAnimationFrame(() => { const section = document.getElementById(`site-section-${result.section.id}`); section?.scrollIntoView({block:"center",behavior:"smooth"}); const input = section?.querySelector<HTMLInputElement>(".section-title"); input?.focus(); input?.select(); });
  }
  function titleChange(section:SiteNoteSection,title:string) {
    if (!doc) return;
    setDoc(current => current ? {...current,sections:current.sections.map(s => s.id === section.id ? {...s,title} : s)} : current);
    const note = doc.note;
    queueSave(`section:${section.id}`,() => updateSection(note,section,{title:title.trim() || "Untitled Section"}));
    void flushSave(`section:${section.id}`).catch(e => setError(String(e)));
  }
  async function photoSelected(event:React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []); event.target.value = "";
    const insertion = addAt; if (!insertion || !doc) return;
    await run(async () => {
      let contents = itemsFor(insertion.sectionId), index = insertion.index;
      for (const file of files) {
        const asset = await createImageAsset(project.id,file);
        const item = await insertPhoto(doc.note,insertion.sectionId,asset,contents,index);
        contents = [...contents.slice(0,index),item,...contents.slice(index)].map((v,order) => ({...v,order})); index++;
      }
      setAddAt(undefined); await refresh();
    });
  }
  async function addDrawing(existing?:Drawing) {
    if (!doc || !addAt) return;
    const sectionId = addAt.sectionId;
    const drawing = existing ?? await createDrawing(project.id,{name:`${doc.sections.find(s => s.id === sectionId)?.title || project.name} sketch`});
    await insertDrawing(doc.note,sectionId,drawing.id,itemsFor(sectionId),addAt.index);
    setAddAt(undefined); setPicker(false); await refresh(); onOpenDrawing(drawing.id,sectionId);
  }
  async function moveSection(section:SiteNoteSection,delta:number) {
    if (!doc) return; const next = [...doc.sections], from = next.findIndex(s => s.id === section.id), to = from+delta;
    if (to < 0 || to >= next.length) return; [next[from],next[to]] = [next[to],next[from]]; await reorderSections(doc.note,next); setSectionMenu(undefined); await refresh();
  }
  async function moveItem(item:SiteNoteContent,delta:number) {
    if (!doc) return; const next = itemsFor(item.sectionId), from = next.findIndex(i => i.id === item.id), to = from+delta;
    if (to < 0 || to >= next.length) return; [next[from],next[to]] = [next[to],next[from]]; await reorderContents(doc.note,item.sectionId,next); setItemMenu(undefined); await refresh();
  }
  const failure = saveFailure();
  if (!doc) return <main className="pillar-page"><button className="back-label" onClick={onBack}><ArrowLeft/> Back to projects</button><p>{error ?? (doc === null ? "Notebook unavailable." : "Opening notebook…")}</p>{error ? <button onClick={() => run(refresh)}>Retry</button> : null}</main>;
  return <main className="notebook-page" aria-busy={busy}>
    <header className="notebook-sticky"><div className="notebook-heading"><button className="icon-button" aria-label="Back to projects" disabled={busy} onClick={() => run(onBack)}><ArrowLeft size={21}/></button><div className="notebook-identity"><Brand compact/><h1>{project.name}</h1><p>{project.clientName || "Client not added"} <span>·</span> {projectLocation(project)}</p></div><div className="notebook-reference">{project.reference ? <small>{project.reference}</small> : null}<StatusPill status={project.status}/></div><button className="icon-button" aria-label="Edit job details" onClick={() => run(() => setInfo(true))}><Info size={19}/></button></div><nav className="workspace-tabs" aria-label="Project workspace">{["notes","drawings","photos"].map(id => <button key={id} aria-current={tab === id ? "page" : undefined} onClick={() => run(async () => { await refresh(); setTab(id); })}>{id}</button>)}<span className={failure ? "save-indicator is-error" : "save-indicator"}>{busy || pendingSaveCount() ? failure ? "NOT SAVED" : "SAVING…" : "SAVED LOCALLY"}</span></nav></header>
    <div className="notebook-body">
    {error || failure ? <div className="site-note-error" role="alert"><span><strong>Action not completed</strong>{error ?? String(failure)}</span><button onClick={() => run(refresh)}>Retry saving</button></div> : null}
    <button className="client-strip" onClick={() => run(() => setInfo(true))}><span className="technical-label">CLIENT / JOB DETAILS</span><strong>{project.clientName || "Add client details"}</strong><span>{[project.clientPhone,project.clientEmail].filter(Boolean).join(" · ") || "Add contact information"}</span><small>{fullSiteAddress(project) || "Add site address"}</small><span className="client-edit">EDIT <ChevronRight size={14}/></span></button>
    {notes.length > 1 ? <label className="notebook-select">NOTEBOOK <select value={siteNoteId} onChange={e => { const id=e.target.value; void run(() => onSelectNote(id)); }}>{notes.map((n,index) => <option value={n.id} key={n.id}>{n.title} · {index+1}</option>)}</select></label> : null}
    {tab === "notes" ? <div className="notebook-sections">{doc.sections.map((section,index) => {
      const items = itemsFor(section.id);
      return <section key={section.id} id={`site-section-${section.id}`} data-section-id={section.id} className={`notebook-section ${dragId === section.id ? "is-dragging" : ""}`}>
        <header className="notebook-section-header"><button className="section-grip" aria-label={`Hold to reorder ${section.title}`} onPointerDown={event => { if (busy) return; event.currentTarget.setPointerCapture(event.pointerId); clearTimeout(hold.current); hold.current = setTimeout(() => { if (docRef.current) { drag.current = {id:section.id,original:docRef.current.sections}; setDragId(section.id); } },350); }}><span>{String(index+1).padStart(2,"0")}</span><GripVertical size={14}/></button><input className="section-title" aria-label="Section title" value={section.title} onChange={e => titleChange(section,e.target.value)}/><small>{items.length}</small><button aria-label={section.collapsed ? "Expand section" : "Collapse section"} onClick={() => run(async () => { await updateSection(doc.note,section,{collapsed:!section.collapsed}); await refresh(); })}>{section.collapsed ? <ChevronRight size={17}/> : <ChevronDown size={17}/>}</button><button aria-label={`Options for ${section.title}`} onClick={() => run(() => setSectionMenu(section))}><MoreVertical size={17}/></button></header>
        {!section.collapsed ? <div className="notebook-content">{items.map(item => <div key={item.id} className={`notebook-item notebook-item--${item.type}`}>
          {item.type === "text" ? <SiteNoteText note={doc.note} content={item} autoFocus={focusText === item.id} onSaved={updated => setDoc(current => current ? {...current,contents:current.contents.map(i => i.id === updated.id ? updated : i)} : current)}/> : item.type === "photo" ? <PhotoContentView assetId={item.assetId} onOpen={id => run(() => setPhotoId(id))}/> : <button className="site-drawing" aria-label="Open drawing" onClick={() => run(() => onOpenDrawing(item.drawingId,section.id))}><DrawingPreview drawingId={item.drawingId} label="Site sketch"/><PencilRuler size={12} className="attachment-badge"/></button>}
          <button className="item-options" aria-label={`${item.type} options`} onClick={() => run(() => setItemMenu(item))}><MoreVertical size={15}/></button>
        </div>)}<button className="compact-add" aria-label={`Add content to ${section.title}`} onClick={() => run(() => setAddAt({sectionId:section.id,index:items.length}))}><Plus size={19}/><span>ADD</span></button></div> : null}
      </section>;
    })}{!doc.sections.length ? <div className="notebook-empty"><h2>A clean page for this job.</h2><p>Add a section for each area or trade.</p></div> : null}</div> : tab === "drawings" ? <section className="project-drawings"><div className="list-heading"><h2>PROJECT DRAWINGS</h2><button onClick={() => run(async () => { const drawing = await createDrawing(project.id,{name:"Untitled sketch"}); onOpenDrawing(drawing.id,""); })}><Plus size={16}/> NEW SKETCH</button></div>{drawings.map(d => <article className="drawing-library-item" key={d.id}><button className="drawing-library-row" onClick={() => run(() => onOpenDrawing(d.id,""))}><div><DrawingPreview drawing={d}/></div><strong>{d.name}</strong><ChevronRight size={18}/></button><button className="drawing-library-options" aria-label={`Options for drawing ${d.name}`} onClick={() => {setDrawingMenu(d);setDrawingName(d.name);setDeleteDrawingPrompt(false);}}><MoreVertical size={18}/></button></article>)}{!drawings.length ? <p className="muted-text">No drawings yet. Start a sketch for this job.</p> : null}</section> : <section><div className="list-heading"><h2>NOTEBOOK PHOTOS</h2></div><div className="photo-library">{doc.contents.filter(i => i.type === "photo").map(i => i.type === "photo" ? <PhotoContentView key={i.id} assetId={i.assetId} onOpen={id => run(() => setPhotoId(id))}/> : null)}</div>{!doc.contents.some(i => i.type === "photo") ? <p className="muted-text">Add photos to a section in Notes.</p> : null}</section>}
    </div>
    <footer className="notebook-footer"><button className="secondary-button" disabled={busy} onClick={() => run(async () => { setTab("notes"); await newSection(); })}><Plus size={19}/> ADD SECTION</button><button className="primary-button" disabled={busy} onClick={() => run(() => setWorkOrder(true))}><FileDown size={18}/> GENERATE WORK ORDER <ChevronRight size={17}/></button></footer>
    <input hidden type="file" ref={fileInput} accept="image/*" multiple onChange={photoSelected}/><input hidden type="file" ref={cameraInput} accept="image/*" capture="environment" onChange={photoSelected}/>
    <BottomSheet title="Add to section" isOpen={Boolean(addAt) && !picker} onDismiss={() => setAddAt(undefined)}><div className="action-list"><button className="action-row" onClick={() => cameraInput.current?.click()}><Camera/><span><strong>Take photo</strong><small>Use your camera</small></span></button><button className="action-row" onClick={() => fileInput.current?.click()}><ImagePlus/><span><strong>Choose photos</strong><small>Import from your library</small></span></button><button className="action-row" onClick={() => setPicker(true)}><PencilRuler/><span><strong>Drawing</strong><small>New sketch or existing drawing</small></span></button><button className="action-row" onClick={() => run(async () => { if (!addAt) return; const item = await insertText(doc.note,addAt.sectionId,itemsFor(addAt.sectionId),addAt.index); setFocusText(item.id); setAddAt(undefined); await refresh(); })}><Type/><strong>Text / note</strong></button></div></BottomSheet>
    <BottomSheet title="Add a drawing" isOpen={picker} onDismiss={() => {setPicker(false);setAddAt(undefined);}}><div className="action-list"><button className="action-row" disabled={busy} onClick={() => run(() => addDrawing())}><Plus/><strong>New sketch</strong></button>{drawings.map(d => <button key={d.id} className="action-row" disabled={busy} onClick={() => run(() => addDrawing(d))}><PencilRuler/><strong>{d.name}</strong></button>)}</div></BottomSheet>
    <BottomSheet title="Section options" isOpen={Boolean(sectionMenu)} onDismiss={() => setSectionMenu(undefined)}>{sectionMenu ? <div className="action-list"><button className="action-row" onClick={() => run(() => moveSection(sectionMenu,-1))}><ArrowUp/> Move section up</button><button className="action-row" onClick={() => run(() => moveSection(sectionMenu,1))}><ArrowDown/> Move section down</button><button className="action-row danger-text" onClick={() => {setDeleting({section:sectionMenu});setSectionMenu(undefined);}}><Trash2/> Delete section</button></div> : null}</BottomSheet>
    <BottomSheet title="Content options" isOpen={Boolean(itemMenu)} onDismiss={() => setItemMenu(undefined)}>{itemMenu ? <div className="action-list"><button className="action-row" onClick={() => run(() => moveItem(itemMenu,-1))}><ArrowUp/> Move earlier</button><button className="action-row" onClick={() => run(() => moveItem(itemMenu,1))}><ArrowDown/> Move later</button><button className="action-row" onClick={() => {setAddAt({sectionId:itemMenu.sectionId,index:itemMenu.order+1});setItemMenu(undefined);}}><Plus/> Insert content after this</button>{doc.sections.filter(s => s.id !== itemMenu.sectionId).map(s => <button className="action-row" key={s.id} onClick={() => run(async () => {await moveContentToSection(doc.note,itemMenu,itemsFor(itemMenu.sectionId),s.id,itemsFor(s.id));setItemMenu(undefined);await refresh();})}><ChevronRight/> Move to {s.title}</button>)}<button className="action-row danger-text" onClick={() => {setDeleting({item:itemMenu});setItemMenu(undefined);}}><Trash2/> Remove item</button></div> : null}</BottomSheet>
    <BottomSheet title={deleting?.section ? "Delete this section?" : "Remove this item?"} isOpen={Boolean(deleting)} onDismiss={() => setDeleting(undefined)}><p className="muted-text">This cannot be undone. Linked drawings stay in the project.</p><div className="sheet-actions"><button className="secondary-button" onClick={() => setDeleting(undefined)}>Cancel</button><button className="danger-button" disabled={busy} onClick={() => run(async () => {if (deleting?.section) await deleteSection(doc.note,deleting.section,doc.sections.filter(s => s.id !== deleting.section!.id)); if (deleting?.item) await deleteContent(doc.note,deleting.item,itemsFor(deleting.item.sectionId).filter(i => i.id !== deleting.item!.id));setDeleting(undefined);await refresh();})}>Delete</button></div></BottomSheet>
    <BottomSheet title={deleteDrawingPrompt ? "Delete drawing?" : "Drawing options"} isOpen={Boolean(drawingMenu)} onDismiss={() => setDrawingMenu(undefined)}>{drawingMenu ? deleteDrawingPrompt ? <div className="work-order-panel"><p>Delete {drawingMenu.name} and its notebook links? This cannot be undone. Shared photos stay in the project.</p><button className="danger-button" disabled={busy} onClick={() => run(async () => {await deleteDrawing(drawingMenu);setDrawingMenu(undefined);await refresh();})}>Delete drawing</button></div> : <form className="job-form" onSubmit={event => {event.preventDefault();void run(async () => {if(!drawingName.trim())return;await renameDrawing(drawingMenu,drawingName.trim());setDrawingMenu(undefined);await refresh();});}}><label className="full"><span>Drawing name</span><input value={drawingName} onChange={event => setDrawingName(event.target.value)} required/></label><button className="primary-button" disabled={busy}>Save name</button><button className="danger-button" type="button" onClick={() => setDeleteDrawingPrompt(true)}>Delete drawing</button></form> : null}</BottomSheet>
    <PhotoViewer assetId={photoId} onClose={() => setPhotoId(undefined)}/>
    <ProjectInfoSheet project={project} isOpen={info} onDismiss={() => setInfo(false)} onSaved={async () => {await onProjectChanged();}}/>
    <WorkOrderSheet project={project} isOpen={workOrder} onClose={() => setWorkOrder(false)}/>
  </main>;
}
