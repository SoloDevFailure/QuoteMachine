import { GripVertical, X } from "lucide-react";
import type { SiteNoteContent, SiteNoteSection } from "./siteNoteTypes";

export function SectionOverview({ sections, contents, activeId, onHover, onCommit, onCancel, onNavigate }: { sections: SiteNoteSection[]; contents: SiteNoteContent[]; activeId?: string; onHover: (id: string) => void; onCommit: () => void; onCancel: () => void; onNavigate: (id: string) => void }) {
  return <div className="section-overview" role="dialog" aria-modal="true" aria-label="Reorder sections" onPointerUp={onCommit}>
    <header><div><strong>Section overview</strong><span>Drag to reorder · release when placed</span></div><button type="button" aria-label="Close overview" onClick={(event) => { event.stopPropagation(); onCancel(); }}><X/></button></header>
    <div className="section-overview__stack">{sections.map((section) => {
      const count = contents.filter((item) => item.sectionId === section.id).length;
      const lines = Math.max(1, Math.min(5, count + 1));
      return <button data-overview-section={section.id} className={`overview-section ${activeId === section.id ? "is-dragging" : ""} ${section.collapsed ? "is-collapsed" : ""}`} key={section.id} type="button" onPointerEnter={() => onHover(section.id)} onClick={() => { if (!activeId) onNavigate(section.id); }}><span className="overview-section__title"><GripVertical size={17}/>{section.title || "Untitled Section"}<small>{count} item{count === 1 ? "" : "s"}</small></span>{!section.collapsed ? <span className="overview-section__shape">{Array.from({ length: lines }, (_, index) => <i key={index} style={{ width: `${88 - (index % 3) * 15}%` }}/>)}</span> : null}</button>;
    })}</div>
    <p>Hold a section header anytime to return to this view.</p>
  </div>;
}
