import { db } from "../../storage/db";
import { flushPendingSaves } from "../../storage/pendingSaves";
import type { Project } from "../projects/projectTypes";
import { getSiteNoteDocument, getSiteNotesByProject } from "../siteNotes/siteNoteStore";
import { buildWorkOrderModel } from "./workOrderModel";
import { composeWorkOrder } from "./workOrderPdf";
import { photoForPdf, blobDataUrl } from "./imageRendering";
import { renderDrawingForPdf } from "./renderDrawing";
let font:Promise<string> | undefined;
export async function generateWorkOrder(project:Project,progress?:(message:string)=>void) {
  await flushPendingSaves();
  const notes=await getSiteNotesByProject(project.id);
  const documents=await Promise.all(notes.map(note=>getSiteNoteDocument(note.id)));
  if(documents.some(doc=>!doc))throw new Error("A notebook could not be loaded. Please reopen the job.");
  const current=(await db.getProjects()).find(p=>p.id===project.id);
  if(!current)throw new Error("Project no longer exists.");
  if(!font)font=fetch(new URL("fonts/DejaVuSans.ttf",document.baseURI)).then(async response=>{if(!response.ok)throw new Error("Document font unavailable. Reopen the app online once.");return (await blobDataUrl(await response.blob())).split(",")[1];}).catch(error=>{font=undefined;throw error;});
  return composeWorkOrder(buildWorkOrderModel(current,documents.filter((doc):doc is NonNullable<typeof doc>=>Boolean(doc))),{
    fontBase64:await font, progress,
    photo:async id=>{const asset=await db.getAsset(id);if(!asset)throw new Error("A notebook photo is missing. Restore it or remove its link before exporting.");return photoForPdf(asset.blob);},
    drawing:renderDrawingForPdf
  });
}
