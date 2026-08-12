import type { ReactNode } from "react";

export function ResponsivePage({ children, withNavigation = false, className = "" }: { children: ReactNode; withNavigation?: boolean; className?: string }) {
  return <main className={`responsive-page ${withNavigation ? "responsive-page--with-nav" : ""} ${className}`.trim()}><div className="responsive-page__content">{children}</div></main>;
}
