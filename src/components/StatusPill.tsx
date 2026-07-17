import type { ProjectStatus } from "../features/projects/projectTypes";

const statusLabels: Record<ProjectStatus, string> = {
  draft: "Draft",
  inProgress: "In progress",
  complete: "Complete",
};

type StatusPillProps = {
  status: ProjectStatus;
};

export function StatusPill({ status }: StatusPillProps) {
  return <span className={`status-pill status-pill--${status}`}>{statusLabels[status]}</span>;
}
