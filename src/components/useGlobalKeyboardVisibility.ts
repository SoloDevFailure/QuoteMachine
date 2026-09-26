import { useEffect } from "react";
export function useGlobalKeyboardVisibility() {
  useEffect(() => {
    const viewport = window.visualViewport;
    let frame = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const ensure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const vv = window.visualViewport;
        const top = vv?.offsetTop ?? 0, bottom = top + (vv?.height ?? innerHeight);
        const keyboardOpen = Boolean(vv && vv.height < innerHeight * .82);
        document.documentElement.style.setProperty("--keyboard-inset", `${Math.max(0, innerHeight-bottom)}px`);
        document.documentElement.classList.toggle("keyboard-open", keyboardOpen);
        const el = document.activeElement;
        if (!keyboardOpen || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLElement && el.isContentEditable)) return;
        const rect = el.getBoundingClientRect(), margin = 48;
        // Do not scroll a full document on every keystroke when no keyboard is occluding it.
        const caretBottom = el instanceof HTMLTextAreaElement
          ? Math.min(rect.bottom, rect.top + el.scrollHeight - el.scrollTop) : rect.bottom;
        if (caretBottom > bottom-margin) scrollBy({top:caretBottom-(bottom-margin)});
        else if (rect.top < top+24) scrollBy({top:rect.top-(top+24)});
      });
    };
    const focus = () => {
      ensure();
      for (const delay of [80,280]) { const timer = setTimeout(() => { timers.delete(timer); ensure(); },delay); timers.add(timer); }
    };
    const pointer = (event:PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest("input,textarea,[contenteditable=true]")) return;
      cancelAnimationFrame(frame); timers.forEach(clearTimeout); timers.clear();
    };
    document.addEventListener("focusin",focus); document.addEventListener("focusout",ensure);
    document.addEventListener("pointerdown",pointer,true); document.addEventListener("input",ensure);
    viewport?.addEventListener("resize",ensure); viewport?.addEventListener("scroll",ensure); addEventListener("orientationchange",ensure);
    return () => {
      cancelAnimationFrame(frame); timers.forEach(clearTimeout);
      document.removeEventListener("focusin",focus);document.removeEventListener("focusout",ensure);
      document.removeEventListener("pointerdown",pointer,true);document.removeEventListener("input",ensure);
      viewport?.removeEventListener("resize",ensure);viewport?.removeEventListener("scroll",ensure);removeEventListener("orientationchange",ensure);
      document.documentElement.classList.remove("keyboard-open");
    };
  },[]);
}
