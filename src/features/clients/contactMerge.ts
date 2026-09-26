import type { ClientContact } from "./clientTypes";
export function mergeContact(existing: ClientContact | undefined, patch: Partial<ClientContact> & Pick<ClientContact, "id" | "name">, timestamp: string): ClientContact {
  return { ...existing, ...patch, createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp };
}
