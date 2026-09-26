import { jsPDF } from "jspdf";
import type { WorkOrderModel } from "./workOrderModel";
import { fitImage } from "./workOrderModel";
import { fullSiteAddress, projectStatusLabel } from "../projects/projectLabels";
export type PdfImage = {data:string;width:number;height:number};
export type PdfSources = {fontBase64:string;photo:(assetId:string)=>Promise<PdfImage>;drawing:(drawingId:string)=>Promise<PdfImage>;progress?:(message:string)=>void};

export async function composeWorkOrder(model:WorkOrderModel,sources:PdfSources):Promise<Blob> {
  const pdf=new jsPDF({unit:"mm",format:"a4",compress:true,putOnlyUsedFonts:true});
  pdf.addFileToVFS("PillarSans.ttf",sources.fontBase64);pdf.addFont("PillarSans.ttf","PillarSans","normal");pdf.setFont("PillarSans");
  pdf.setProperties({title:`${model.project.name} - Work Order`,author:"PILLAR BUILDWORKS",subject:"Site documentation"});
  const left=17,right=193,width=176,bottom=274;let y=30;
  function page() {pdf.addPage("a4","portrait");y=30;}
  function ensure(height:number) {if(y+height>bottom)page();}
  function text(value:string,size=10.5,colour=[35,40,42],gap=3) {
    pdf.setFontSize(size);pdf.setTextColor(colour[0],colour[1],colour[2]);
    const lines=pdf.splitTextToSize(value || " ",width) as string[];
    const leading=size*.48;
    for(const line of lines){ensure(leading);pdf.text(line,left,y);y+=leading;}
    y+=gap;
  }
  function label(name:string,value?:string) {if(!value)return;ensure(15);text(name.toUpperCase(),8,[100,108,113],1);text(value,11,[25,30,32],4);}
  text("WORK ORDER",27,[24,30,31],4);text("SITE DOCUMENTATION",10,[93,105,108],10);
  text(model.project.name,21,[20,25,27],9);
  label("Job reference",model.project.reference);
  label("Client",model.project.clientName);label("Company",model.project.clientCompany);
  label("Phone",[model.project.clientPhone,model.project.clientAlternatePhone].filter(Boolean).join(" / "));
  label("Email",model.project.clientEmail);label("Site",fullSiteAddress(model.project));
  label("Billing address",model.project.billingAddress);label("Status",projectStatusLabel(model.project));
  label("Generated",new Intl.DateTimeFormat("en-AU",{dateStyle:"long",timeStyle:"short"}).format(new Date(model.generatedAt)));
  if(model.project.jobNotes){label("General job notes",model.project.jobNotes);}
  for(const section of model.sections) {
    page();
    const heading=`${String(section.number).padStart(2,"0")} / ${section.title || "Untitled section"}`;
    text(heading,18,[33,49,21],7);
    if(!section.contents.length)text("No content recorded.",10,[110,115,117]);
    for(const item of section.contents) {
      if(item.type==="text"){if(item.text.trim())text(item.text);continue;}
      // One large attachment per page; mixed-content order stays exact.
      page();text(heading,12,[60,70,60],4);
      sources.progress?.(`Rendering ${item.type === "photo" ? "photo" : "drawing"} in ${section.title}…`);
      const image=item.type==="photo"?await sources.photo(item.assetId):await sources.drawing(item.drawingId);
      const caption=item.caption;
      pdf.setFontSize(10);
      const captionLines=caption?(pdf.splitTextToSize(caption,width) as string[]):[];
      const reserve=Math.min(30,captionLines.length*4.8+4);
      const size=fitImage(image.width,image.height,width,bottom-y-reserve);
      pdf.addImage(image.data,item.type==="photo"?"JPEG":"PNG",left+(width-size.width)/2,y,size.width,size.height,undefined,"FAST");
      y+=size.height+5;
      if(caption)text(caption,10,[80,85,88]);
      // Following text gets its own space after the full-page attachment.
      y=bottom;
    }
  }
  const count=pdf.getNumberOfPages();
  for(let number=1;number<=count;number++){
    pdf.setPage(number);pdf.setDrawColor(167,207,71);pdf.setLineWidth(.7);pdf.line(left,16,right,16);
    pdf.setFontSize(8);pdf.setTextColor(45,52,43);pdf.text("PILLAR BUILDWORKS",left,12);
    pdf.setDrawColor(210,213,211);pdf.setLineWidth(.2);pdf.line(left,282,right,282);
    pdf.setFontSize(8);pdf.setTextColor(110,116,113);pdf.text("WORK ORDER / SITE DOCUMENTATION",left,288);pdf.text(`${number} / ${count}`,right,288,{align:"right"});
  }
  return pdf.output("blob");
}
