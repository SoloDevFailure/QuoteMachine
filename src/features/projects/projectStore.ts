import { db } from "../../storage/db";
import { createId } from "../../utils/ids";
import type { Project, ProjectInput } from "./projectTypes";

function now() {
  return new Date().toISOString();
}

export async function getProjects() {
  return db.getProjects();
}

export async function createProject(input: ProjectInput): Promise<Project> {
  console.info("[ForteStack] project create submit started", input);
  const timestamp = now();
  const project: Project = {
    id: createId(),
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.putProject(project);
  return project;
}

export async function updateProject(project: Project, input: ProjectInput): Promise<Project> {
  const updated: Project = {
    ...project,
    ...input,
    updatedAt: now(),
  };

  await db.putProject(updated);
  return updated;
}
