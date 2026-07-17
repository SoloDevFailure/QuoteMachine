import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import type { Project, ProjectInput, ProjectStatus } from "./projectTypes";

type ProjectFormSheetProps = {
  project?: Project;
  isOpen: boolean;
  onDismiss: () => void;
  onSubmit: (input: ProjectInput) => Promise<void>;
};

const statuses: Array<{ value: ProjectStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "inProgress", label: "In progress" },
  { value: "complete", label: "Complete" },
];

export function ProjectFormSheet({
  project,
  isOpen,
  onDismiss,
  onSubmit,
}: ProjectFormSheetProps) {
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("inProgress");
  const [isSaving, setIsSaving] = useState(false);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    setName(project?.name ?? "");
    setClientName(project?.clientName ?? "");
    setSiteAddress(project?.siteAddress ?? "");
    setStatus(project?.status ?? "inProgress");
    setErrorMessage("");

    window.setTimeout(() => nameInputRef.current?.focus(), 80);
  }, [isOpen, project]);

  useEffect(() => {
    if (!isOpen || !project) return;

    const trimmedName = name.trim();
    if (!trimmedName) return;

    const input: ProjectInput = {
      name: trimmedName,
      clientName: clientName.trim() || undefined,
      siteAddress: siteAddress.trim() || undefined,
      status,
    };

    const isUnchanged =
      input.name === project.name &&
      input.clientName === project.clientName &&
      input.siteAddress === project.siteAddress &&
      input.status === project.status;

    if (isUnchanged) {
      setAutosaveState("idle");
      return;
    }

    setAutosaveState("saving");
    const timeoutId = window.setTimeout(async () => {
      try {
        await onSubmit(input);
        setAutosaveState("saved");
      } catch (error) {
        const message = getErrorMessage(error);
        console.error("[ForteStack] caught error", message);
        setErrorMessage(message);
        setAutosaveState("idle");
      }
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [clientName, isOpen, name, onSubmit, project, siteAddress, status]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (project) return;

    const trimmedName = name.trim();
    if (!trimmedName) return;

    console.info("[ForteStack] project create submit started");
    setIsSaving(true);
    setErrorMessage("");

    try {
      await onSubmit({
        name: trimmedName,
        clientName: clientName.trim() || undefined,
        siteAddress: siteAddress.trim() || undefined,
        status,
      });
      onDismiss();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("[ForteStack] caught error", message);
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <BottomSheet
      title={project ? "Edit project" : "New project"}
      isOpen={isOpen}
      placement={project ? "bottom" : "center"}
      onDismiss={onDismiss}
      footer={
        project ? (
          <p className="autosave-state">
            {autosaveState === "saving"
              ? "Autosaving"
              : autosaveState === "saved"
                ? "Autosaved"
                : "Changes autosave"}
          </p>
        ) : (
          <button className="primary-button" form="project-form" type="submit" disabled={isSaving}>
            {isSaving ? "Creating" : "Create project"}
          </button>
        )
      }
    >
      <form className="form-stack" id="project-form" onSubmit={handleSubmit}>
        {errorMessage ? (
          <p className="form-error" role="alert">
            {formatStorageError(errorMessage)}
          </p>
        ) : null}

        <label>
          <span>Project name</span>
          <input
            ref={nameInputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Wesley Bathroom Renovation"
            required
          />
        </label>

        <label>
          <span>Client</span>
          <input
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            placeholder="Optional"
          />
        </label>

        <label>
          <span>Site address</span>
          <textarea
            value={siteAddress}
            onChange={(event) => setSiteAddress(event.target.value)}
            placeholder="Optional"
            rows={3}
          />
        </label>

        <div className="segmented-control" aria-label="Project status">
          {statuses.map((item) => (
            <button
              className={status === item.value ? "is-active" : ""}
              key={item.value}
              type="button"
              onClick={() => setStatus(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </form>
    </BottomSheet>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

function formatStorageError(message: string) {
  return `Project could not be created. ${message}`;
}
