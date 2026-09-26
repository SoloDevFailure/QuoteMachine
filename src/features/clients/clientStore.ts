import { requestResult, runMultiStoreTransaction } from "../../storage/db";
import { createId } from "../../utils/ids";
import type { Asset } from "../assets/assetTypes";
import { deleteAssetIfUnreferenced, getAsset } from "../assets/assetStore";
import type { Project, ProjectInput } from "../projects/projectTypes";
import type { ClientContact } from "./clientTypes";
import { mergeContact } from "./contactMerge";

export async function getClientContacts() {
  return runMultiStoreTransaction(["clientContacts"] as const, "readonly", async s =>
    (await requestResult<ClientContact[]>(s.clientContacts.getAll())).sort((a,b) => a.name.localeCompare(b.name)));
}
export type ProjectInfoInput = ProjectInput & { removePhoto?: boolean; saveContact: boolean };
export async function saveProjectInfo(project: Project, input: ProjectInfoInput, newPhoto?: Asset): Promise<{ project: Project; contact?: ClientContact }> {
  const timestamp = new Date().toISOString();
  const { removePhoto, saveContact, ...fields } = input;
  const result = await runMultiStoreTransaction(["projects", "clientContacts", "assets"] as const, "readwrite", async stores => {
    const stored = await requestResult<Project | undefined>(stores.projects.get(project.id));
    let contact: ClientContact | undefined;
    if (saveContact && input.clientName?.trim()) {
      const id = input.clientContactId ?? createId();
      const existing = await requestResult<ClientContact | undefined>(stores.clientContacts.get(id));
      contact = mergeContact(existing, { id, name: input.clientName.trim(), company: input.clientCompany,
        phone: input.clientPhone, alternatePhone: input.clientAlternatePhone, email: input.clientEmail,
        billingAddress: input.billingAddress, notes: input.clientNotes }, timestamp);
      stores.clientContacts.put(contact);
    }
    const updated: Project = { ...(stored ?? project), ...fields, name: input.name.trim(),
      projectPhotoAssetId: removePhoto ? undefined : newPhoto?.id ?? input.projectPhotoAssetId,
      clientContactId: contact?.id ?? input.clientContactId, updatedAt: timestamp };
    stores.projects.put(updated);
    if (newPhoto) stores.assets.put(newPhoto);
    return { project: updated, contact };
  });
  if (project.projectPhotoAssetId && project.projectPhotoAssetId !== result.project.projectPhotoAssetId) {
    // The job is already durable. Cleanup failures must not turn a successful save into a false failure.
    try { const old = await getAsset(project.projectPhotoAssetId); if (old) await deleteAssetIfUnreferenced(old); }
    catch (error) { console.warn("Unused project photo cleanup will be retried later", error); }
  }
  return result;
}
