import type { ReactNode } from "react";

type AppHeaderProps = {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
};

export function AppHeader({ title, eyebrow, action }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div>
        {eyebrow ? <p className="app-header__eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
      </div>
      {action ? <div className="app-header__action">{action}</div> : null}
    </header>
  );
}
