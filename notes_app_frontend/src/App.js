import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const STORAGE_KEY = "retro_notes_v1";

function generateId() {
  // Avoid extra dependencies; sufficient uniqueness for local-only notes.
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Safely parse notes from localStorage.
 * Returns [] on any error or invalid shape.
 */
function readNotesFromStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((n) => n && typeof n === "object")
      .map((n) => ({
        id: typeof n.id === "string" ? n.id : generateId(),
        title: typeof n.title === "string" ? n.title : "",
        body: typeof n.body === "string" ? n.body : "",
        createdAt: typeof n.createdAt === "number" ? n.createdAt : Date.now(),
        updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : Date.now(),
      }));
  } catch {
    return [];
  }
}

function writeNotesToStorage(notes) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // If storage is full/blocked, we silently degrade (still works during session).
  }
}

// PUBLIC_INTERFACE
function App() {
  const [notes, setNotes] = useState(() => readNotesFromStorage());
  const [selectedId, setSelectedId] = useState(() => (readNotesFromStorage()[0]?.id ?? null));
  const [query, setQuery] = useState("");

  // Editor draft (controlled inputs)
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");

  const titleInputRef = useRef(null);

  // Persist notes whenever they change.
  useEffect(() => {
    writeNotesToStorage(notes);
  }, [notes]);

  // Ensure selectedId always points to an existing note (or null).
  useEffect(() => {
    if (selectedId && !notes.some((n) => n.id === selectedId)) {
      setSelectedId(notes[0]?.id ?? null);
    }
  }, [notes, selectedId]);

  const selectedNote = useMemo(() => notes.find((n) => n.id === selectedId) ?? null, [notes, selectedId]);

  // Load selected note into the draft.
  useEffect(() => {
    if (!selectedNote) {
      setDraftTitle("");
      setDraftBody("");
      return;
    }
    setDraftTitle(selectedNote.title);
    setDraftBody(selectedNote.body);
  }, [selectedNote?.id]); // intentionally only on note change

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => {
      const hay = `${n.title}\n${n.body}`.toLowerCase();
      return hay.includes(q);
    });
  }, [notes, query]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedNote) return false;
    return selectedNote.title !== draftTitle || selectedNote.body !== draftBody;
  }, [selectedNote, draftTitle, draftBody]);

  function formatDate(ts) {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return "";
    }
  }

  function selectNote(id) {
    if (id === selectedId) return;
    // For simplicity, switching notes discards un-saved draft changes.
    setSelectedId(id);
  }

  // PUBLIC_INTERFACE
  function createNote() {
    const now = Date.now();
    const newNote = {
      id: generateId(),
      title: "Untitled",
      body: "",
      createdAt: now,
      updatedAt: now,
    };

    setNotes((prev) => [newNote, ...prev]);
    setSelectedId(newNote.id);

    // focus after render
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }

  // PUBLIC_INTERFACE
  function saveSelectedNote() {
    if (!selectedNote) return;

    const nextTitle = draftTitle.trimEnd();
    const nextBody = draftBody;

    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedNote.id
          ? {
              ...n,
              title: nextTitle,
              body: nextBody,
              updatedAt: Date.now(),
            }
          : n
      )
    );
  }

  // PUBLIC_INTERFACE
  function deleteSelectedNote() {
    if (!selectedNote) return;

    const ok = window.confirm(`Delete "${selectedNote.title || "Untitled"}"? This cannot be undone.`);
    if (!ok) return;

    setNotes((prev) => prev.filter((n) => n.id !== selectedNote.id));
  }

  function onEditorKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveSelectedNote();
    }
  }

  return (
    <div className="App">
      <div className="retro-bg" aria-hidden="true" />
      <header className="appHeader">
        <div className="brand">
          <div className="brandMark" aria-hidden="true">
            R
          </div>
          <div className="brandText">
            <h1 className="appTitle">Retro Notes</h1>
            <p className="appSubtitle">Add, edit, delete. Stored locally in your browser.</p>
          </div>
        </div>

        <div className="headerActions">
          <button className="btn btnPrimary" type="button" onClick={createNote}>
            + New Note
          </button>
        </div>
      </header>

      <main className="layout" aria-label="Notes application">
        <aside className="panel listPanel" aria-label="Notes list">
          <div className="panelHeader">
            <label className="searchLabel" htmlFor="noteSearch">
              Search
            </label>
            <input
              id="noteSearch"
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="title or text…"
              aria-label="Search notes"
            />
          </div>

          <div className="listMeta" role="status" aria-live="polite">
            <span className="pill">{filteredNotes.length} note{filteredNotes.length === 1 ? "" : "s"}</span>
            <span className="pill pillSecondary">LocalStorage</span>
          </div>

          <ul className="notesList" role="list">
            {filteredNotes.map((n) => {
              const isActive = n.id === selectedId;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`noteRow ${isActive ? "active" : ""}`}
                    onClick={() => selectNote(n.id)}
                    aria-current={isActive ? "true" : "false"}
                  >
                    <div className="noteRowTop">
                      <span className="noteTitle">{n.title?.trim() ? n.title : "Untitled"}</span>
                      <span className="noteTime">{formatDate(n.updatedAt)}</span>
                    </div>
                    <div className="notePreview">{(n.body || "").trim() ? n.body : "—"}</div>
                  </button>
                </li>
              );
            })}

            {filteredNotes.length === 0 && (
              <li className="emptyState">
                <div className="emptyTitle">No notes found</div>
                <div className="emptyHint">Try clearing search or create a new note.</div>
              </li>
            )}
          </ul>
        </aside>

        <section className="panel editorPanel" aria-label="Note editor">
          {!selectedNote ? (
            <div className="editorEmpty">
              <div className="crtFrame">
                <div className="crtTitle">No note selected</div>
                <p className="crtHint">Create a new note to get started.</p>
                <button className="btn btnPrimary" type="button" onClick={createNote}>
                  + New Note
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="editorHeader">
                <div className="editorInfo">
                  <div className="editorMeta">
                    <span className="mono">Created: {formatDate(selectedNote.createdAt)}</span>
                    <span className="mono">Updated: {formatDate(selectedNote.updatedAt)}</span>
                  </div>
                  {hasUnsavedChanges && <span className="unsaved" role="status">Unsaved changes</span>}
                </div>

                <div className="editorActions">
                  <button
                    className="btn btnGhost"
                    type="button"
                    onClick={saveSelectedNote}
                    disabled={!hasUnsavedChanges}
                    aria-disabled={!hasUnsavedChanges}
                    title="Save (Ctrl/⌘ + S)"
                  >
                    Save
                  </button>
                  <button className="btn btnDanger" type="button" onClick={deleteSelectedNote}>
                    Delete
                  </button>
                </div>
              </div>

              <div className="editorBody" onKeyDown={onEditorKeyDown}>
                <label className="fieldLabel" htmlFor="noteTitle">
                  Title
                </label>
                <input
                  id="noteTitle"
                  ref={titleInputRef}
                  className="input inputTitle"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Untitled"
                  autoComplete="off"
                />

                <label className="fieldLabel" htmlFor="noteBody">
                  Note
                </label>
                <textarea
                  id="noteBody"
                  className="textarea"
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  placeholder="Start typing…"
                  rows={12}
                />

                <div className="editorFooter">
                  <div className="kbdHint">
                    Tip: press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>S</kbd> to save
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="appFooter">
        <span className="mono">Retro Notes • Offline • Data stays on this device</span>
      </footer>
    </div>
  );
}

export default App;
