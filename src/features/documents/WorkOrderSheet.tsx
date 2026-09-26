import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { BottomSheet } from "../../components/BottomSheet";
import type { Project } from "../projects/projectTypes";
import { workOrderFilename } from "./workOrderModel";
export function WorkOrderSheet({project,isOpen,onClose}:{project:Project;isOpen:boolean;onClose:()=>void}) {
  const [busy,setBusy]=useState(false),[url,setUrl]=useState<string>(),[error,setError]=useState<string>(),[progress,setProgress]=useState("");
  useEffect(()=>()=>{if(url)URL.revokeObjectURL(url)},[url]);
  useEffect(()=>{if(isOpen){setUrl(undefined);setError(undefined);}},[isOpen]);
  async function generate(){setBusy(true);setError(undefined);setProgress("Reading the complete notebook…");try{const {generateWorkOrder}=await import("./generateWorkOrder");const blob=await generateWorkOrder(project,setProgress);setUrl(URL.createObjectURL(blob));}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false)}}
  return <BottomSheet title="Generate work order" isOpen={isOpen} placement="center" onDismiss={()=>{if(!busy)onClose()}}><div className="work-order-panel"><FileText size={34}/><h2>{project.name}</h2><p>A4 site documentation with job and client details, every notebook section, original photos and full-page drawings. Content stays in its captured order.</p><p className="muted-text">Internal client notes are excluded. This export uses the current notebook; it does not freeze or change your job.</p>{error?<p role="alert" className="form-error">{error}</p>:null}{busy?<p role="status">{progress}</p>:url?<><p className="export-success" role="status">Your work order is ready.</p><a className="primary-button" href={url} target="_blank" rel="noreferrer">View PDF</a><a className="secondary-button" href={url} download={workOrderFilename(project)}><Download size={18}/> Download PDF</a></>:<button className="primary-button" onClick={generate}>Generate A4 PDF</button>}</div></BottomSheet>;
}
