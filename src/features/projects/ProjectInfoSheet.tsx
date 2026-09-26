import { Camera, ImagePlus, Search, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { createImageAsset } from "../assets/imageImport";
import type { Asset } from "../assets/assetTypes";
import { ThumbnailImage } from "../assets/ThumbnailImage";
import { getClientContacts, saveProjectInfo } from "../clients/clientStore";
import type { ClientContact } from "../clients/clientTypes";
import type { Project, ProjectInput } from "./projectTypes";
import { createId } from "../../utils/ids";

type Props = { project?: Project; isOpen: boolean; required?: string[]; onDismiss: () => void; onSaved: (project: Project) => void | Promise<void> };
export function ProjectInfoSheet({ project, isOpen, required, onDismiss, onSaved }: Props) {
  const [base, setBase] = useState<Project>();
  const [draft, setDraft] = useState<ProjectInput>({ name: "", status: "inProgress" });
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [query, setQuery] = useState(""); const [showContacts, setShowContacts] = useState(false);
  const [photo, setPhoto] = useState<Asset>(); const [photoUrl, setPhotoUrl] = useState<string>();
  const [removePhoto, setRemovePhoto] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState<string>();
  const [saveContact, setSaveContact] = useState(true);
  const photoInput = useRef<HTMLInputElement>(null), cameraInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const timestamp = new Date().toISOString();
    const initial = project ?? { id: createId(), name: "", status: "inProgress" as const, createdAt: timestamp, updatedAt: timestamp };
    setBase(initial); setDraft({ ...initial }); setPhoto(undefined); setRemovePhoto(false); setError(undefined); setShowContacts(false); setQuery(""); setSaveContact(true);
    getClientContacts().then(setContacts).catch(reason => setError(String(reason)));
  }, [isOpen, project?.id]);
  useEffect(() => { if (!photo) { setPhotoUrl(undefined); return; } const url = URL.createObjectURL(photo.blob); setPhotoUrl(url); return () => URL.revokeObjectURL(url); }, [photo]);
  function field(key: keyof ProjectInput, value: string) { setDraft(current => ({ ...current, [key]: value || undefined })); }
  async function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file || !base) return;
    try { setPhoto(await createImageAsset(base.id, file)); setRemovePhoto(false); setError(undefined); } catch (reason) { setError(String(reason)); }
    event.target.value = "";
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!base || !draft.name?.trim()) return;
    setSaving(true); setError(undefined);
    try {
      const result = await saveProjectInfo(base, { ...draft, name: draft.name.trim(), removePhoto, saveContact }, photo);
      await onSaved(result.project); onDismiss();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  }
  const fields: Array<[keyof ProjectInput, string, string?]> = [["siteAddress","Street address"],["suburb","Suburb"],["state","State"],["postcode","Postcode"],["reference","Job / reference number"]];
  const clientFields: Array<[keyof ProjectInput,string,string?]> = [["clientCompany","Company"],["clientPhone","Mobile","tel"],["clientAlternatePhone","Alternate phone","tel"],["clientEmail","Email","email"]];
  return <BottomSheet title={project ? "Job & client details" : "New job"} isOpen={isOpen} placement="center" onDismiss={() => { if (!saving) onDismiss(); }} footer={<button className="primary-button" form="job-info-form" type="submit" disabled={saving}>{saving ? "Saving…" : project ? "Save details" : "Create job & open notebook"}</button>}>
    <form id="job-info-form" className="job-form" onSubmit={save}>
      <p className="form-intro">{project ? "Job details stay with this project." : "Give this job a name you will recognise on site."}</p>
      {required?.length ? <p className="form-error">{required.join(" · ")}</p> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}
      <h3>01 / JOB</h3>
      <label className="full"><span>Job name *</span><input autoFocus required value={draft.name ?? ""} onChange={e => field("name",e.target.value)} placeholder="e.g. Highvale patio roof"/></label>
      {fields.map(([key,label]) => <label key={key} className={key === "siteAddress" ? "full" : ""}><span>{label}</span><input value={String(draft[key] ?? "")} onChange={e => field(key,e.target.value)}/></label>)}
      <label><span>Status</span><select value={draft.status} onChange={e => field("status",e.target.value)}><option value="draft">Draft</option><option value="inProgress">Active</option><option value="complete">Completed</option></select></label>
      <div className="job-photo-field full"><div className="job-photo-preview">{photoUrl ? <img src={photoUrl} alt="Selected job cover"/> : !removePhoto && draft.projectPhotoAssetId ? <ThumbnailImage assetId={draft.projectPhotoAssetId}/> : <ImagePlus/>}</div><div><span className="technical-label">PROJECT PHOTO</span><div className="inline-actions"><button type="button" onClick={() => cameraInput.current?.click()}><Camera size={17}/> Camera</button><button type="button" onClick={() => photoInput.current?.click()}>Choose</button>{photo || (!removePhoto && draft.projectPhotoAssetId) ? <button type="button" aria-label="Remove project photo" onClick={() => { setPhoto(undefined); setRemovePhoto(true); }}><Trash2 size={17}/></button> : null}</div></div></div>
      <input hidden ref={photoInput} type="file" accept="image/*" onChange={choose}/><input hidden ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={choose}/>
      <label className="full"><span>General job notes</span><textarea rows={2} value={draft.jobNotes ?? ""} onChange={e => field("jobNotes",e.target.value)}/></label>
      <h3>02 / CLIENT</h3>
      <button className="contact-select full" type="button" onClick={() => setShowContacts(v => !v)}><Search size={17}/> Choose saved contact</button>
      {showContacts ? <div className="contact-results full"><input aria-label="Search contacts" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search contacts"/>{contacts.filter(c => [c.name,c.company,c.phone,c.email].some(v => v?.toLowerCase().includes(query.toLowerCase()))).map(c => <button type="button" key={c.id} onClick={() => { setDraft(d => ({ ...d, clientContactId:c.id, clientName:c.name, clientCompany:c.company, clientPhone:c.phone, clientAlternatePhone:c.alternatePhone, clientEmail:c.email, billingAddress:c.billingAddress, clientNotes:c.notes, siteAddress:d.siteAddress || c.defaultAddress })); setShowContacts(false); }}><strong>{c.name}</strong><small>{c.company || c.phone || c.email}</small></button>)}{!contacts.length ? <p>No saved contacts yet.</p> : null}</div> : null}
      <label className="full"><span>Client name</span><input value={draft.clientName ?? ""} onChange={e => setDraft(d => ({ ...d, clientName:e.target.value, clientContactId:undefined }))}/></label>
      {clientFields.map(([key,label,type]) => <label key={key}><span>{label}</span><input type={type ?? "text"} value={String(draft[key] ?? "")} onChange={e => field(key,e.target.value)}/></label>)}
      <label className="full"><span>Billing address, if different from site</span><textarea rows={2} value={draft.billingAddress ?? ""} onChange={e => field("billingAddress",e.target.value)}/></label>
      <label className="full"><span>Client notes (internal)</span><textarea rows={2} value={draft.clientNotes ?? ""} onChange={e => field("clientNotes",e.target.value)}/></label>
      <label className="check-label full"><input type="checkbox" checked={saveContact} onChange={e => setSaveContact(e.target.checked)}/><span>{draft.clientContactId ? "Update selected saved contact" : "Save client for future jobs"}</span></label>
    </form>
  </BottomSheet>;
}
