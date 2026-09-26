type Entry = { revision: number; saved: number; write: () => Promise<unknown>; running?: Promise<void>; error?: unknown };
const pending = new Map<string, Entry>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
export function queueSave(key: string, write: () => Promise<unknown>) {
  const entry = pending.get(key) ?? { revision: 0, saved: 0, write };
  entry.revision++; entry.write = write; entry.error = undefined;
  pending.set(key, entry); emit();
}
export async function flushSave(key: string): Promise<void> {
  const entry = pending.get(key);
  if (!entry) return;
  if (entry.running) return entry.running;
  const run = async () => { while (entry.saved < entry.revision) { const revision = entry.revision; await entry.write(); entry.saved = revision; } };
  entry.running = run(); emit();
  try { await entry.running; if (entry.saved === entry.revision) pending.delete(key); }
  catch (error) { entry.error = error; throw error; }
  finally { entry.running = undefined; emit(); }
}
export async function flushPendingSaves(): Promise<void> {
  while (pending.size) await Promise.all([...pending.keys()].map(flushSave));
}
export function pendingSaveCount() { return pending.size; }
export function subscribeSaves(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function saveFailure() { return [...pending.values()].find(entry => entry.error)?.error; }
