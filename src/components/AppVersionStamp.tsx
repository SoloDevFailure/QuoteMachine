import { buildInfo } from "../app/buildInfo";

export function AppVersionStamp() {
  return (
    <footer className="app-version-stamp" aria-label="App build version">
      ForteStack v{buildInfo.version} · {formatBuildTime(buildInfo.buildTime)}
    </footer>
  );
}

function formatBuildTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date);
}
