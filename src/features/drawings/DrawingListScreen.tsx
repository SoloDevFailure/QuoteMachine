import { ArrowLeft, Layers3, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppVersionStamp } from "../../components/AppVersionStamp";
import { BottomSheet } from "../../components/BottomSheet";
import { EmptyState } from "../../components/EmptyState";
import { IconButton } from "../../components/IconButton";
import type { Project } from "../projects/projectTypes";
import { CreateDrawingSheet } from "./CreateDrawingSheet";
import { deleteDrawing, getProjectDrawings, renameDrawing } from "./drawingStore";
import type { Drawing } from "./drawingTypes";

type DrawingListScreenProps = {
  project: Project;
  onBack: () => void;
  onOpenDrawing: (drawingId: string) => void;
};

export function DrawingListScreen({ project, onBack, onOpenDrawing }: DrawingListScreenProps) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [drawingToDelete, setDrawingToDelete] = useState<Drawing>();
  const [drawingToRename, setDrawingToRename] = useState<Drawing>();
  const [draftName, setDraftName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function refreshDrawings() {
    setDrawings(await getProjectDrawings(project.id));
  }

  useEffect(() => {
    refreshDrawings().finally(() => setIsLoading(false));
  }, [project.id]);

  function handleCreated(drawing: Drawing) {
    refreshDrawings();
    onOpenDrawing(drawing.id);
  }

  function openRename(drawing: Drawing) {
    setDrawingToRename(drawing);
    setDraftName(drawing.name);
  }

  async function handleRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftName.trim();
    if (!drawingToRename || !name) return;

    setIsSaving(true);
    try {
      const updated = await renameDrawing(drawingToRename, name);
      setDrawings((items) => items.map((drawing) => (drawing.id === updated.id ? updated : drawing)));
      setDrawingToRename(undefined);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!drawingToDelete) return;

    setIsSaving(true);
    try {
      await deleteDrawing(drawingToDelete);
      setDrawings((items) => items.filter((drawing) => drawing.id !== drawingToDelete.id));
      setDrawingToDelete(undefined);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="dashboard-header">
        <IconButton icon={<ArrowLeft size={22} />} label="Back to project" onClick={onBack} />
        <IconButton
          icon={<Plus size={24} />}
          label="Create drawing"
          variant="primary"
          onClick={() => setIsCreateOpen(true)}
        />
      </header>

      <section className="project-hero">
        <div>
          <p className="app-header__eyebrow">{project.name}</p>
          <h1>Drawings</h1>
        </div>
      </section>

      {isLoading ? (
        <p className="muted-text">Loading drawings</p>
      ) : drawings.length === 0 ? (
        <EmptyState
          title="Create the first drawing"
          body="Start blank or import a site photo. Both use the same drawing workspace."
          action={
            <button className="primary-button" type="button" onClick={() => setIsCreateOpen(true)}>
              New drawing
            </button>
          }
        />
      ) : (
        <section className="project-list" aria-label="Drawings">
          {drawings.map((drawing) => (
            <article className="project-card drawing-card" key={drawing.id}>
              <button className="drawing-card__open" type="button" onClick={() => onOpenDrawing(drawing.id)}>
                <span className="project-card__icon">
                  <Layers3 size={22} />
                </span>
                <span className="project-card__body">
                  <strong>{drawing.name}</strong>
                  <span>
                    Layered workspace -{" "}
                    {formatUpdated(drawing.updatedAt)}
                  </span>
                </span>
              </button>
              <div className="drawing-card__actions" aria-label={`${drawing.name} actions`}>
                <IconButton icon={<Pencil size={18} />} label="Rename drawing" onClick={() => openRename(drawing)} />
                <IconButton icon={<Trash2 size={18} />} label="Delete drawing" onClick={() => setDrawingToDelete(drawing)} />
              </div>
            </article>
          ))}
        </section>
      )}

      <CreateDrawingSheet
        projectId={project.id}
        isOpen={isCreateOpen}
        onDismiss={() => setIsCreateOpen(false)}
        onCreated={handleCreated}
      />

      <BottomSheet
        title="Rename drawing"
        isOpen={Boolean(drawingToRename)}
        onDismiss={() => setDrawingToRename(undefined)}
        footer={
          <button className="primary-button" form="rename-drawing-form" type="submit" disabled={!draftName.trim() || isSaving}>
            {isSaving ? "Renaming" : "Rename"}
          </button>
        }
      >
        <form className="form-stack" id="rename-drawing-form" onSubmit={handleRename}>
          <label>
            <span>Drawing name</span>
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
          </label>
        </form>
      </BottomSheet>

      <BottomSheet
        title="Delete drawing"
        isOpen={Boolean(drawingToDelete)}
        onDismiss={() => setDrawingToDelete(undefined)}
        placement="center"
      >
        <div className="form-stack">
          <p className="muted-text">Delete "{drawingToDelete?.name}" and its saved annotations?</p>
          <div className="sheet-actions">
            <button className="secondary-button" type="button" disabled={isSaving} onClick={() => setDrawingToDelete(undefined)}>
              Cancel
            </button>
            <button className="danger-button" type="button" disabled={isSaving} onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>
      </BottomSheet>

      <AppVersionStamp />
    </main>
  );
}

function formatUpdated(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}
