import { ArrowLeft, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Brand } from "../../components/Brand";
import { BottomNavigation } from "../../components/BottomNavigation";
import { ProjectRow } from "./ProjectRow";
import type { Project } from "./projectTypes";
export function ProjectListScreen({ projects, onBack, onNewJob, onOpenProject }: { projects: Project[]; onBack: () => void; onNewJob: () => void; onOpenProject: (id: string) => void }) {
  const [query,setQuery] = useState(""), [filter,setFilter] = useState("all");
  const filtered = projects.filter(p => (filter === "all" || p.status === filter) && [p.name,p.clientName,p.clientCompany,p.siteAddress,p.suburb,p.reference].some(v => v?.toLowerCase().includes(query.toLowerCase())));
  const filters = [["all","All"],["inProgress","Active"],["draft","Draft"],["complete","Completed"]];
  return <main className="pillar-page"><header className="projects-header"><div><button className="back-label" onClick={onBack}><ArrowLeft size={18}/><Brand compact/></button><h1>Projects</h1></div><button className="new-job-circle" aria-label="New job" onClick={onNewJob}><Plus/></button></header><label className="pillar-search"><Search size={19}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search jobs, clients, addresses…" aria-label="Search projects"/></label><nav className="project-filters" aria-label="Project status">{filters.map(([id,label]) => <button key={id} aria-pressed={filter === id} className={filter === id ? "is-active" : ""} onClick={() => setFilter(id)}>{label} <span>({projects.filter(p => id === "all" || p.status === id).length})</span></button>)}</nav><section className="job-list" aria-label="Projects">{filtered.map(p => <ProjectRow key={p.id} project={p} onOpen={() => onOpenProject(p.id)}/>)}{!filtered.length ? <div className="notebook-empty"><h2>{projects.length ? "No matching jobs" : "Your jobs belong here"}</h2><p>{projects.length ? "Try another search or status." : "Create a job to start your site notebook."}</p>{!projects.length ? <button className="primary-button" onClick={onNewJob}>New job</button> : null}</div> : null}</section><BottomNavigation active="projects" onNavigate={tab => tab === "home" ? onBack() : undefined}/></main>;
}
