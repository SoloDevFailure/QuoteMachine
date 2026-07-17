import { useEffect } from "react";
import type { RefObject } from "react";

export function useKeyboardAwareViewport(isOpen: boolean, scrollRootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!isOpen) return;
    const scrollRoot = scrollRootRef.current;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function updateViewportVars() {
      const viewport = window.visualViewport;
      const inset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportOffsetTop = viewport?.offsetTop ?? 0;

      document.documentElement.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
      document.documentElement.style.setProperty("--visual-viewport-height", `${Math.round(viewportHeight)}px`);
      document.documentElement.style.setProperty("--visual-viewport-offset-top", `${Math.round(viewportOffsetTop)}px`);
    }

    function scrollFocusedFieldIntoView(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !scrollRoot?.contains(target)) return;

      window.setTimeout(() => {
        target.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "smooth",
        });
      }, 80);
    }

    updateViewportVars();
    window.visualViewport?.addEventListener("resize", updateViewportVars);
    window.visualViewport?.addEventListener("scroll", updateViewportVars);
    scrollRoot?.addEventListener("focusin", scrollFocusedFieldIntoView);

    return () => {
      window.visualViewport?.removeEventListener("resize", updateViewportVars);
      window.visualViewport?.removeEventListener("scroll", updateViewportVars);
      scrollRoot?.removeEventListener("focusin", scrollFocusedFieldIntoView);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.setProperty("--keyboard-inset", "0px");
      document.documentElement.style.setProperty("--visual-viewport-height", "100dvh");
      document.documentElement.style.setProperty("--visual-viewport-offset-top", "0px");
    };
  }, [isOpen, scrollRootRef]);
}
