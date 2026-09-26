import type { Project } from "../projects/projectTypes";
import type { SiteNoteDocument, SiteNoteContent } from "../siteNotes/siteNoteTypes";
export type WorkOrderSection = { id:string; number:number; title:string; notebookTitle:string; contents:SiteNoteContent[] };
export type WorkOrderModel = { project:Project; generatedAt:string; sections:WorkOrderSection[] };
export function buildWorkOrderModel(project:Project, documents:SiteNoteDocument[], generatedAt = new Date().toISOString()):WorkOrderModel {
  const sections = [...documents].sort((a,b) => a.note.createdAt.localeCompare(b.note.createdAt) || a.note.id.localeCompare(b.note.id)).flatMap(doc =>
    [...doc.sections].sort((a,b) => a.order-b.order || a.id.localeCompare(b.id)).map(section => ({
      id:section.id, number:0, title:section.title, notebookTitle:doc.note.title,
      contents:doc.contents.filter(item => item.sectionId === section.id).sort((a,b) => a.order-b.order || a.id.localeCompare(b.id))
    })));
  return {project:{...project},generatedAt,sections:sections.map((section,index) => ({...section,number:index+1}))};
}
export function fitImage(width:number,height:number,maxWidth:number,maxHeight:number) {
  const scale = Math.min(maxWidth/Math.max(1,width),maxHeight/Math.max(1,height));
  return {width:width*scale,height:height*scale};
}
export function workOrderFilename(project:Project) { return `PILLAR-BUILDWORKS-${(project.reference || project.name).replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"") || "Job"}-Work-Order.pdf`; }
