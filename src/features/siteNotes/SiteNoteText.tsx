import { useEffect, useRef, useState } from "react";
import { SaveStatus } from "../../components/SaveStatus";
import { useSaveState } from "../../storage/saveState";
import type { SiteNote, TextContent } from "./siteNoteTypes";
import { saveText } from "./siteNoteStore";

export function SiteNoteText({ note, content, autoFocus, onSaved }: { note: SiteNote; content: TextContent; autoFocus?: boolean; onSaved: (content: TextContent) => void }) {
  const [text, setText] = useState(content.text);
  const { state, error, run } = useSaveState();
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);
  useEffect(() => { if (text === content.text) return; const timer = window.setTimeout(() => { run(() => saveText(note, content, text)).then(onSaved).catch(() => undefined); }, 550); return () => window.clearTimeout(timer); }, [content, note, onSaved, run, text]);
  return <div className="site-text"><textarea ref={input} value={text} rows={Math.max(2, text.split("\n").length)} placeholder="Start typing your notes…" aria-label="Section notes" onChange={(event) => { setText(event.target.value); event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`; }}/><SaveStatus state={state} error={error}/></div>;
}
