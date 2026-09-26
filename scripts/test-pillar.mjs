import assert from "node:assert/strict";
import { test } from "node:test";
import "fake-indexeddb/auto";
import { build } from "esbuild";
const modules = ["storage/db","storage/pendingSaves","features/siteNotes/siteNoteStore","features/clients/clientStore","features/clients/contactMerge","features/assets/thumbnails","features/documents/workOrderModel","features/drawings/preview/visibleAnnotations"];
const compiled=await build({stdin:{contents:modules.map((path,i)=>`export * as m${i} from "./src/${path}";`).join("\n"),resolveDir:process.cwd(),loader:"ts"},bundle:true,write:false,platform:"node",format:"esm"});
const {m0:{db,runMultiStoreTransaction,requestResult},m1:saves,m2:notes,m3:clients,m4:{mergeContact},m5:{thumbnailSize},m6:{buildWorkOrderModel,fitImage},m7:{visibleDrawingAnnotations}}=await import("data:text/javascript;base64,"+Buffer.from(compiled.outputFiles[0].text).toString("base64"));
const date="2026-09-01T00:00:00.000Z";
const project={id:"legacy-project",name:"Existing job",status:"draft",createdAt:date,updatedAt:date,projectPhotoAssetId:"cover"};
await test("v6 upgrades to v7 without changing existing records or IDs",async()=>{
  const open=indexedDB.open("fortestack",6);
  open.onupgradeneeded=()=>{
    for(const name of ["projects","drawings","assets","annotations","referencePoints","siteNotes","siteNoteSections","siteNoteContents","clientContacts"]){
      const store=open.result.createObjectStore(name,{keyPath:"id"});
      if(["drawings","assets","siteNotes"].includes(name))store.createIndex("projectId","projectId");
      if(["annotations","referencePoints"].includes(name))store.createIndex("drawingId","drawingId");
      if(name==="siteNoteSections") {store.createIndex("siteNoteId","siteNoteId");store.createIndex("siteNoteId_order",["siteNoteId","order"]);}
      if(name==="siteNoteContents"){store.createIndex("sectionId","sectionId");store.createIndex("sectionId_order",["sectionId","order"]);}
      if(["projects","drawings","siteNotes","clientContacts"].includes(name))store.createIndex("updatedAt","updatedAt");
      if(name==="clientContacts")store.createIndex("name","name");
    }
    open.transaction.objectStore("projects").put(project);
  };
  const old=await new Promise((resolve,reject)=>{open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);});old.close();
  assert.deepEqual((await db.getProjects())[0],project);
  await runMultiStoreTransaction(["thumbnails"],"readonly",s=>assert.equal(s.thumbnails.keyPath,"id"));
});
await test("contact updates preserve creation date and omitted default address",()=>{
  const old={id:"contact",name:"Jo",createdAt:date,updatedAt:date,defaultAddress:"Original address"};
  const next=mergeContact(old,{id:"contact",name:"Jo Updated"},"2026-09-26");
  assert.equal(next.createdAt,date);assert.equal(next.defaultAddress,"Original address");assert.equal(next.name,"Jo Updated");
});
await test("cover references protect image assets and their thumbnail",async()=>{
  await db.putAsset({id:"cover",projectId:project.id,type:"image",mimeType:"image/png",blob:new Blob(["original"]),width:10,height:10,createdAt:date});
  await runMultiStoreTransaction(["thumbnails"],"readwrite",s=>s.thumbnails.put({id:"cover",blob:new Blob(["small"]),version:1,width:10,height:10}));
  assert.equal(await db.deleteAssetIfUnreferenced(await db.getAsset("cover")),false);
  assert.equal((await db.getAssetReferences("cover",project.id)).projectIds[0],project.id);
});
await test("removing a job photo persists and deletes its unreferenced cache",async()=>{
  const result=await clients.saveProjectInfo(project,{name:project.name,status:"draft",projectPhotoAssetId:"cover",removePhoto:true,saveContact:false});
  assert.equal(result.project.projectPhotoAssetId,undefined);assert.equal(await db.getAsset("cover"),undefined);
  assert.equal(await runMultiStoreTransaction(["thumbnails"],"readonly",s=>requestResult(s.thumbnails.get("cover"))),undefined);
});
await test("stale text save preserves current ordering, destination and ready status",async()=>{
  const document=await notes.createSiteNoteForProject(project);
  const text=document.contents[0];const section=await notes.addSection(document.note,document.sections);
  await notes.moveContentToSection(document.note,text,[text],section.section.id,[section.content]);
  await notes.finishSiteNote(document.note);
  await notes.saveText(document.note,text,"Latest typed text");
  const loaded=await notes.getSiteNoteDocument(document.note.id),saved=loaded.contents.find(i=>i.id===text.id);
  assert.equal(saved.sectionId,section.section.id);assert.equal(saved.order,1);assert.equal(saved.text,"Latest typed text");assert.equal(loaded.note.status,"readyForQuote");
});
await test("save flush serializes a new revision arriving during a write",async()=>{
  const written=[];let release;const gate=new Promise(resolve=>release=resolve);
  saves.queueSave("typing",async()=>{await gate;written.push("first");});
  const flushing=saves.flushPendingSaves();saves.queueSave("typing",async()=>written.push("latest"));release();await flushing;
  assert.deepEqual(written,["first","latest"]);assert.equal(saves.pendingSaveCount(),0);
});
await test("failed writes remain pending and retryable",async()=>{
  saves.queueSave("retry",async()=>{throw new Error("quota");});
  await assert.rejects(saves.flushPendingSaves(),/quota/);assert.equal(saves.pendingSaveCount(),1);
  saves.queueSave("retry",async()=>{});await saves.flushPendingSaves();assert.equal(saves.pendingSaveCount(),0);
});
await test("work order keeps notebook, section and mixed-content order without mutation",()=>{
  const docs=[{note:{id:"n",createdAt:date,title:"Notes"},sections:[{id:"b",order:1,title:"Second"},{id:"a",order:0,title:"First"}],contents:[{id:"photo",sectionId:"a",order:1,type:"photo"},{id:"text",sectionId:"a",order:0,type:"text"},{id:"drawing",sectionId:"b",order:0,type:"drawing"}]}];
  const before=JSON.stringify(docs),model=buildWorkOrderModel(project,docs,date);
  assert.deepEqual(model.sections.map(s=>s.id),["a","b"]);assert.deepEqual(model.sections[0].contents.map(i=>i.id),["text","photo"]);assert.equal(JSON.stringify(docs),before);
});
await test("thumbnail sizing never upscales and fits landscape/portrait",()=>{
  assert.deepEqual(thumbnailSize(4000,3000),{width:192,height:144});assert.deepEqual(thumbnailSize(3000,4000),{width:144,height:192});assert.deepEqual(thumbnailSize(60,40),{width:60,height:40});
});
await test("PDF image fit preserves aspect ratio within printable area",()=>{
  assert.deepEqual(fitImage(4000,2000,176,230),{width:176,height:88});assert.deepEqual(fitImage(1000,2000,176,230),{width:115,height:230});
});
await test("drawing previews omit hidden layers and preserve editor stacking",()=>{
  const d={layers:[{id:"hidden",visible:false,order:2},{id:"low",visible:true,order:0},{id:"high",visible:true,order:1}]};
  const result=visibleDrawingAnnotations(d,[{id:"hidden",layerId:"hidden",type:"note"},{id:"high",layerId:"high",type:"image"},{id:"text",layerId:"low",type:"note"},{id:"image",layerId:"low",type:"image"}]);
  assert.deepEqual(result.map(i=>i.id),["image","text","high"]);
});

await test("insertion and reorder never overwrite freshly saved text or section titles",async()=>{
  const p=(await db.getProjects())[0],doc=await notes.createSiteNoteForProject(p),stale=doc.contents[0];
  await notes.saveText(doc.note,stale,"Must survive insertion");
  const asset={id:"insert-asset",projectId:p.id,type:"image",mimeType:"image/png",blob:new Blob(["image"]),width:10,height:10,createdAt:date};
  await notes.insertPhoto(doc.note,doc.sections[0].id,asset,[stale],1);
  await notes.updateSection(doc.note,doc.sections[0],{title:"Fresh title"});
  await notes.reorderSections(doc.note,doc.sections);
  const loaded=await notes.getSiteNoteDocument(doc.note.id);
  assert.equal(loaded.contents.find(i=>i.id===stale.id).text,"Must survive insertion");
  assert.equal(loaded.sections[0].title,"Fresh title");
});
await test("drawing deletion removes links but retains shared project cover",async()=>{
  const p=(await db.getProjects())[0],doc=await notes.createSiteNoteForProject(p);
  const asset={id:"shared-cover",projectId:p.id,type:"image",mimeType:"image/png",blob:new Blob(["image"]),width:10,height:10,createdAt:date};
  await db.putAsset(asset);await db.putProject({...p,projectPhotoAssetId:asset.id});
  const drawing={id:"delete-drawing",projectId:p.id,name:"Delete test",backgroundType:"photo",backgroundAssetId:asset.id,createdAt:date,updatedAt:date,viewportHint:{centerX:0,centerY:0,scale:1}};
  await db.putDrawing(drawing);await notes.insertDrawing(doc.note,doc.sections[0].id,drawing.id,doc.contents,1);
  await db.deleteDrawingGraph(drawing);
  assert.equal(await db.getDrawing(drawing.id),undefined);
  assert.ok(await db.getAsset(asset.id));
  assert.equal((await notes.getSiteNoteDocument(doc.note.id)).contents.some(i=>i.type==="drawing"),false);
});

