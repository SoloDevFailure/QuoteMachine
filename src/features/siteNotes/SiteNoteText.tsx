import { useEffect, useRef, useState } from "react";
import { queueSave, flushSave } from "../../storage/pendingSaves";
import type { SiteNote, TextContent } from "./siteNoteTypes";
import { saveText } from "./siteNoteStore";

export function SiteNoteText({ note, content, autoFocus, onSaved }: { note: SiteNote; content: TextContent; autoFocus?: boolean; onSaved: (content: TextContent) => void }) {
  const [text, setText] = useState(content.text);
  const [error, setError] = useState<string>();
  const input = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  const callback = useRef(onSaved); callback.current = onSaved;
  const key = `text:${content.id}`;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current); void flushSave(key).catch(() => undefined); }; }, [key]);
  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);
  useEffect(() => { if (input.current) { input.current.style.height = "auto"; input.current.style.height = `${input.current.scrollHeight}px`; } }, [text]);
  function change(value: string) {
    setText(value); setError(undefined);
    queueSave(key, async () => { const updated = await saveText(note, content, value); if (mounted.current) callback.current(updated); });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushSave(key).catch(reason => { if (mounted.current) setError(String(reason)); }), 350);
  }
  return <div className="site-text"><textarea ref={input} value={text} rows={2} placeholder="Write site notes, measurements, materials…" aria-label="Section notes" onChange={event => change(event.target.value)} onBlur={() => { clearTimeout(timer.current); void flushSave(key).catch(reason => setError(String(reason))); }}/>{error ? <span className="form-error" role="alert">Not saved. Your text is retained. Use Retry saving above.</span> : null}</div>;
}
