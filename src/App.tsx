import { useEffect, useMemo, useRef, useState } from "react";
import { seedDemoEvents } from "./lib/seed";
import {
  addDays,
  clashGroups,
  createEvent,
  downloadText,
  eventsToCsv,
  formatShortDate,
  isClashing,
  loadStore,
  parseCsv,
  saveStore,
  startOfWeek,
  todayISO,
  weekDates,
} from "./lib/store";
import type { EventRow, StoreSnapshot, TimeBand } from "./types";
import { TIME_BANDS } from "./types";

type Draft = {
  title: string;
  date: string;
  timeBand: TimeBand;
  org: string;
  postedBy: string;
  notes: string;
  checkedBeforePublish: boolean;
};

const emptyDraft = (): Draft => ({
  title: "",
  date: todayISO(),
  timeBand: "evening",
  org: "",
  postedBy: "",
  notes: "",
  checkedBeforePublish: true,
});

export default function App() {
  const [store, setStore] = useState<StoreSnapshot>(() => loadStore());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()));
  const [orgFilter, setOrgFilter] = useState("all");
  const [bandFilter, setBandFilter] = useState<"all" | TimeBand>("all");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const weekEvents = useMemo(() => {
    const days = new Set(weekDates(weekStart));
    return store.events
      .filter((e) => days.has(e.date))
      .filter((e) => (orgFilter === "all" ? true : e.org === orgFilter))
      .filter((e) => (bandFilter === "all" ? true : e.timeBand === bandFilter))
      .filter((e) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          e.org.toLowerCase().includes(q) ||
          e.postedBy.toLowerCase().includes(q) ||
          e.notes.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.timeBand.localeCompare(b.timeBand));
  }, [store.events, weekStart, orgFilter, bandFilter, query]);

  const clashes = useMemo(() => clashGroups(store.events), [store.events]);
  const weekClashCount = useMemo(() => {
    const days = new Set(weekDates(weekStart));
    let n = 0;
    for (const [key, list] of clashes) {
      const date = key.split("|")[0];
      if (days.has(date)) n += list.length;
    }
    return n;
  }, [clashes, weekStart]);

  const draftConflicts = useMemo(() => {
    if (!draft.date || !draft.timeBand) return [];
    return store.events.filter(
      (e) =>
        e.id !== editingId &&
        e.date === draft.date &&
        e.timeBand === draft.timeBand,
    );
  }, [draft, store.events, editingId]);

  function persist(next: StoreSnapshot) {
    setStore(next);
  }

  function upsertEvent() {
    if (!draft.title.trim() || !draft.org.trim() || !draft.date) {
      setToast("Title, organization, and date are required.");
      return;
    }

    let orgs = store.orgs;
    if (!orgs.includes(draft.org.trim())) {
      orgs = [...orgs, draft.org.trim()].sort((a, b) => a.localeCompare(b));
    }

    if (editingId) {
      const events = store.events.map((e) =>
        e.id === editingId
          ? {
              ...e,
              title: draft.title.trim(),
              date: draft.date,
              timeBand: draft.timeBand,
              org: draft.org.trim(),
              postedBy: draft.postedBy.trim(),
              notes: draft.notes.trim(),
              checkedBeforePublish: draft.checkedBeforePublish,
              updatedAt: new Date().toISOString(),
            }
          : e,
      );
      persist({ ...store, events, orgs });
      setToast("Event updated.");
    } else {
      const event = createEvent(draft);
      persist({ ...store, events: [...store.events, event], orgs });
      setToast(
        draftConflicts.length
          ? "Saved with a clash warning — still published to the week list."
          : "Event added to the week list.",
      );
    }
    setEditingId(null);
    setDraft({ ...emptyDraft(), org: draft.org, postedBy: draft.postedBy });
  }

  function editEvent(event: EventRow) {
    setEditingId(event.id);
    setDraft({
      title: event.title,
      date: event.date,
      timeBand: event.timeBand,
      org: event.org,
      postedBy: event.postedBy,
      notes: event.notes,
      checkedBeforePublish: event.checkedBeforePublish,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeEvent(id: string) {
    persist({ ...store, events: store.events.filter((e) => e.id !== id) });
    if (editingId === id) {
      setEditingId(null);
      setDraft(emptyDraft());
    }
    setToast("Event removed.");
  }

  function loadSeed() {
    if (store.events.length && !confirm("Replace current events with demo data?")) return;
    persist({ ...store, events: seedDemoEvents() });
    setWeekStart(startOfWeek(todayISO()));
    setToast("Demo week loaded (includes a Thursday evening clash).");
  }

  function clearAll() {
    if (!confirm("Clear all events from this browser?")) return;
    persist({ ...store, events: [] });
    setToast("All events cleared.");
  }

  function exportCsv() {
    downloadText(
      `week-list-${todayISO()}.csv`,
      eventsToCsv(store.events),
      "text/csv;charset=utf-8",
    );
  }

  function exportJson() {
    downloadText(
      `week-list-${todayISO()}.json`,
      JSON.stringify(store, null, 2),
      "application/json",
    );
  }

  function onCsvImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result ?? ""));
      if (!rows.length) {
        setToast("No usable rows in that CSV.");
        return;
      }
      const orgs = Array.from(
        new Set([...store.orgs, ...rows.map((r) => r.org)]),
      ).sort((a, b) => a.localeCompare(b));
      persist({ ...store, events: [...store.events, ...rows], orgs });
      setToast(`Imported ${rows.length} events from CSV.`);
    };
    reader.readAsText(file);
  }

  function onJsonImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? "")) as StoreSnapshot;
        if (!parsed.events || !Array.isArray(parsed.events)) throw new Error("bad");
        persist({
          version: 1,
          events: parsed.events,
          orgs: parsed.orgs?.length ? parsed.orgs : store.orgs,
          updatedAt: new Date().toISOString(),
        });
        setToast("JSON backup restored.");
      } catch {
        setToast("Could not read that JSON backup.");
      }
    };
    reader.readAsText(file);
  }

  const days = weekDates(weekStart);
  const weekLabel = `${formatShortDate(weekStart)} – ${formatShortDate(addDays(weekStart, 6))}`;

  return (
    <div className="app">
      <header className="hero">
        <p className="rule">
          <span aria-hidden />
          Check → publish → add your row (~2 min)
        </p>
        <h1 className="brand">Pre-Publish Week List</h1>
        <p className="lede">
          See who else is running founder events before you hit publish. Local-only —
          data stays in this browser. No database, no login, no daily checklist.
        </p>
      </header>

      <div className="toolbar">
        <button type="button" className="btn btn-primary" onClick={() => {
          setEditingId(null);
          setDraft(emptyDraft());
          document.getElementById("composer")?.scrollIntoView({ behavior: "smooth" });
        }}>
          New event
        </button>
        <button type="button" className="btn" onClick={loadSeed}>
          Load demo week
        </button>
        <button type="button" className="btn" onClick={exportCsv}>
          Export CSV
        </button>
        <button type="button" className="btn" onClick={exportJson}>
          Export JSON
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Import CSV
        </button>
        <button type="button" className="btn" onClick={() => jsonRef.current?.click()}>
          Restore JSON
        </button>
        <button type="button" className="btn" onClick={() => window.print()}>
          Print week
        </button>
        <button type="button" className="btn btn-danger" onClick={clearAll}>
          Clear all
        </button>
        <input
          ref={fileRef}
          className="hidden-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onCsvImport(f);
            e.target.value = "";
          }}
        />
        <input
          ref={jsonRef}
          className="hidden-file"
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onJsonImport(f);
            e.target.value = "";
          }}
        />
      </div>

      {toast ? (
        <p className="rule" role="status" style={{ marginBottom: 16 }}>
          <span aria-hidden />
          {toast}
        </p>
      ) : null}

      <div className="layout">
        <aside className="panel" id="composer">
          <h2>{editingId ? "Edit event" : "Pre-publish check"}</h2>
          <p className="meta" style={{ marginBottom: 12 }}>
            Pick date and time band first. If something already sits there, you will see it
            before you save.
          </p>

          <div className="field">
            <label htmlFor="date">Date</label>
            <input
              id="date"
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="band">Time band</label>
            <select
              id="band"
              value={draft.timeBand}
              onChange={(e) =>
                setDraft((d) => ({ ...d, timeBand: e.target.value as TimeBand }))
              }
            >
              {TIME_BANDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label} — {b.hint}
                </option>
              ))}
            </select>
          </div>

          {draftConflicts.length > 0 ? (
            <div className="clash-box">
              <strong>Clash risk:</strong> {draftConflicts.length} event
              {draftConflicts.length === 1 ? "" : "s"} already on{" "}
              {formatShortDate(draft.date)} · {draft.timeBand}
              <ul>
                {draftConflicts.map((c) => (
                  <li key={c.id}>
                    {c.title} — {c.org}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="clash-box ok">
              Clear for this date and time band among events already on the list.
            </div>
          )}

          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="title">Event title</label>
            <input
              id="title"
              value={draft.title}
              placeholder="Founder office hours"
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="org">Organization</label>
            <input
              id="org"
              list="org-list"
              value={draft.org}
              placeholder="Harbour Launch Collective"
              onChange={(e) => setDraft((d) => ({ ...d, org: e.target.value }))}
            />
            <datalist id="org-list">
              {store.orgs.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="postedBy">Posted by</label>
            <input
              id="postedBy"
              value={draft.postedBy}
              placeholder="Jordan"
              onChange={(e) => setDraft((d) => ({ ...d, postedBy: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              value={draft.notes}
              placeholder="Zoom link, room, audience…"
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            />
          </div>
          <label className="meta" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={draft.checkedBeforePublish}
              onChange={(e) =>
                setDraft((d) => ({ ...d, checkedBeforePublish: e.target.checked }))
              }
            />
            I checked this list before publishing
          </label>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={upsertEvent}>
              {editingId ? "Save changes" : "Add to week list"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditingId(null);
                  setDraft(emptyDraft());
                }}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </aside>

        <section className="panel">
          <div className="stats">
            <div className="stat">
              <strong>{weekEvents.length}</strong>
              <span>Events this week</span>
            </div>
            <div className={`stat ${weekClashCount ? "warn" : ""}`}>
              <strong>{weekClashCount}</strong>
              <span>In clash slots</span>
            </div>
            <div className="stat">
              <strong>{new Set(weekEvents.map((e) => e.org)).size}</strong>
              <span>Orgs posting</span>
            </div>
          </div>

          <div className="week-nav">
            <button
              type="button"
              className="btn"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
            >
              ← Prev
            </button>
            <h2>{weekLabel}</h2>
            <button
              type="button"
              className="btn"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
            >
              Next →
            </button>
          </div>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setWeekStart(startOfWeek(todayISO()))}
            >
              This week
            </button>
          </div>

          <div className="filters">
            <div className="field">
              <label htmlFor="search">Search</label>
              <input
                id="search"
                value={query}
                placeholder="Title, org, person…"
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="orgFilter">Organization</label>
              <select
                id="orgFilter"
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
              >
                <option value="all">All orgs</option>
                {store.orgs.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="bandFilter">Time band</label>
              <select
                id="bandFilter"
                value={bandFilter}
                onChange={(e) => setBandFilter(e.target.value as "all" | TimeBand)}
              >
                <option value="all">All bands</option>
                {TIME_BANDS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {weekEvents.length === 0 ? (
            <div className="empty">
              Nothing on this week yet. Use <strong>Load demo week</strong> for a sample,
              or add your first event after a pre-publish check.
            </div>
          ) : (
            days.map((day) => {
              const items = weekEvents.filter((e) => e.date === day);
              if (!items.length) return null;
              return (
                <div className="day-block" key={day}>
                  <h3>
                    {formatShortDate(day)}
                    <em>{day}</em>
                  </h3>
                  <div className="event-list">
                    {items.map((event) => {
                      const clash = isClashing(event, store.events);
                      return (
                        <article
                          key={event.id}
                          className={`event ${clash ? "clash" : ""}`}
                        >
                          <div className="band">{event.timeBand}</div>
                          <div>
                            <h4>{event.title}</h4>
                            <p className="meta">
                              {event.org}
                              {event.postedBy ? ` · ${event.postedBy}` : ""}
                            </p>
                            {event.notes ? <p className="meta">{event.notes}</p> : null}
                            {clash ? (
                              <span className="badge">Same day + band clash</span>
                            ) : null}
                            {event.checkedBeforePublish ? (
                              <span className="badge ok">Checked before publish</span>
                            ) : (
                              <span className="badge">Not marked checked</span>
                            )}
                          </div>
                          <div className="event-actions">
                            <button
                              type="button"
                              className="btn"
                              onClick={() => editEvent(event)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => removeEvent(event.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          <p className="footer-note">
            Clash rule for this pilot: same <strong>date</strong> + same{" "}
            <strong>time band</strong>. Data last saved locally{" "}
            {new Date(store.updatedAt).toLocaleString()}. Export CSV/JSON before clearing
            your browser storage.
          </p>
        </section>
      </div>
    </div>
  );
}
