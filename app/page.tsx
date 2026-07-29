"use client";
import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import ApplicationDetailsModal, { type ApplicationDetails } from "./components/application-details";
import InsightsPanel, { type Analytics } from "./components/insights-panel";

type View = "applications" | "insights" | "settings";
type Application = ApplicationDetails;
 type HistoryEntry = { id:number; status:string; changedAt:number; note?:string | null };
const statuses = ["Applied", "Phone screen", "Assessment", "Interview", "Offer", "Rejected"];
const emptyForm = () => ({company:"", role:"", location:"Remote", status:"Applied", appliedDate:"", salary:"", url:"", notes:"", contactEmail:"", source:"", nextStep:"", nextActionDate:""});

function todayIso() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function formatDate(value:string) { return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month:"short", day:"numeric" }); }
function statusClass(status:string) { return status.toLowerCase().replaceAll(" ", "-"); }

function StatusPicker({value, onChange, compact = false}:{value:string; onChange:(value:string)=>void; compact?:boolean}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event:MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return <div className={`status-picker ${compact ? "compact" : ""}`} ref={pickerRef}>
    <button type="button" className={`status-picker-trigger ${statusClass(value)}`} role="combobox" aria-controls={menuId} aria-expanded={open} onClick={() => setOpen(current => !current)}><span className="status-color-dot"/>{value}<span className="picker-chevron" aria-hidden="true"/></button>
    {open && <div id={menuId} className="status-picker-menu" role="listbox">{statuses.map(status => <button type="button" role="option" aria-selected={status === value} className={`status-picker-option ${statusClass(status)}`} key={status} onClick={() => { onChange(status); setOpen(false); }}><span className="status-color-dot"/>{status}</button>)}</div>}
  </div>;
}
export default function Home() {
  const [view, setView] = useState<View>("applications");
  const [apps, setApps] = useState<Application[]>([]);
  const [filter, setFilter] = useState("All applications");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState("Alex");
  const [defaultLocation, setDefaultLocation] = useState("Remote");
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [historyFor, setHistoryFor] = useState<Application | null>(null);
  const [detailsFor, setDetailsFor] = useState<Application | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [insightYear, setInsightYear] = useState("all");
  const [todayLabel, setTodayLabel] = useState("TODAY");
  const [greeting, setGreeting] = useState("Good morning");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const savedName = window.localStorage.getItem("applyly.displayName");
    const savedLocation = window.localStorage.getItem("applyly.defaultLocation");
    const now = new Date();
    Promise.resolve().then(() => {
      if (savedName) setDisplayName(savedName);
      if (savedLocation) setDefaultLocation(savedLocation);
      setTodayLabel(now.toLocaleDateString("en-US", {weekday:"long", month:"long", day:"numeric", year:"numeric"}).toUpperCase());
      setGreeting(now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening");
      setHydrated(true);
    });
    fetch("/api/applications")
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to load applications")))
      .then(data => setApps(data.applications ?? []))
      .catch(() => setError("Could not load your applications. Please refresh and try again."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (view !== "insights") return;
    const analyticsUrl = insightYear === "all" ? "/api/applications/analytics" : `/api/applications/analytics?year=${encodeURIComponent(insightYear)}`;
    fetch(analyticsUrl).then(response => response.ok ? response.json() : Promise.reject(new Error())).then(data => setAnalytics(data)).catch(() => setError("Insights data could not be loaded."));
  }, [view, apps, insightYear]);
  const visible = useMemo(() => apps.filter(app =>
    (filter === "All applications" || app.status === filter) &&
    `${app.company} ${app.role}`.toLowerCase().includes(search.toLowerCase())
  ), [apps, filter, search]);
  const counts = useMemo(() => statuses.map(status => ({ status, count: apps.filter(app => app.status === status).length })), [apps]);
  const active = apps.filter(app => app.status !== "Rejected").length;
  const response = apps.length ? Math.round((apps.filter(app => ["Phone screen", "Interview", "Offer"].includes(app.status)).length / apps.length) * 100) : 0;

  async function add(event:FormEvent) {
    event.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;
    setSaving(true); setError("");
    const submitted = {...form, appliedDate:form.appliedDate || todayIso()}; const optimistic = {...submitted, id:Date.now()};
    setApps(current => [optimistic, ...current]); setForm({...emptyForm(), location:defaultLocation});
    try {
      const response = await fetch("/api/applications", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(submitted) });
      if (!response.ok) throw new Error("Unable to save application");
      const data = await response.json(); setApps(current => current.map(app => app.id === optimistic.id ? data.application : app));
    } catch { setApps(current => current.filter(app => app.id !== optimistic.id)); setError("The application could not be saved."); }
    finally { setSaving(false); }
  }

  async function changeStatus(id:number, status:string) {
    const previous = apps.find(app => app.id === id)?.status;
    setApps(current => current.map(app => app.id === id ? {...app, status} : app));
    try {
      const response = await fetch(`/api/applications/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status}) });
      if (!response.ok) throw new Error();
    } catch { if (previous) setApps(current => current.map(app => app.id === id ? {...app, status:previous} : app)); setError("Status could not be updated."); }
  }

  async function removeApplication(id:number) {
    if (!window.confirm("Delete this application? This cannot be undone.")) return;
    const previous = apps; setApps(current => current.filter(app => app.id !== id));
    try {
      const response = await fetch(`/api/applications/${id}`, { method:"DELETE" });
      if (!response.ok) throw new Error();
    } catch { setApps(previous); setError("Application could not be deleted."); }
  }

  async function openHistory(application:Application) {
    setHistoryFor(application); setHistoryEntries([]);
    try {
      const response = await fetch(`/api/applications/${application.id}`);
      if (!response.ok) throw new Error();
      const data = await response.json(); setHistoryEntries(data.history ?? []);
    } catch { setError("Status history could not be loaded."); }
  }
  function openDetails(application:Application) { setDetailsFor(application); }
  async function undoHistory(entry:HistoryEntry) {
    if (!historyFor || !window.confirm(`Undo the change to ${entry.status}? This will remove this change and anything recorded after it.`)) return;
    try {
      const response = await fetch(`/api/applications/${historyFor.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({undoHistoryId:entry.id}) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      const updated = {...historyFor, status:data.status};
      setApps(current => current.map(app => app.id === historyFor.id ? updated : app));
      setHistoryFor(updated);
      await openHistory(updated);
    } catch { setError("That status change could not be undone."); }
  }
  function saveSettings(event:FormEvent) {
    event.preventDefault();
    window.localStorage.setItem("applyly.displayName", displayName.trim() || "Alex");
    window.localStorage.setItem("applyly.defaultLocation", defaultLocation.trim() || "Remote");
    setSettingsSaved(true); window.setTimeout(() => setSettingsSaved(false), 2400);
  }

  async function clearApplications() {
    if (!apps.length || !window.confirm("Delete all applications? This cannot be undone.")) return;
    const previous = apps; setApps([]);
    try {
      const results = await Promise.all(previous.map(app => fetch(`/api/applications/${app.id}`, { method:"DELETE" })));
      if (results.some(result => !result.ok)) throw new Error();
    } catch { setApps(previous); setError("Some applications could not be deleted."); }
  }
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">apply<span>ly</span></div>
      <nav className="nav" aria-label="Primary navigation">
        <button className={view === "applications" ? "active" : ""} onClick={() => setView("applications")}><span className="nav-mark applications-mark" aria-hidden="true"/><span>Applications</span></button>
        <button className={view === "insights" ? "active" : ""} onClick={() => setView("insights")}><span className="nav-mark insights-mark" aria-hidden="true"/><span>Insights</span></button>
        <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><span className="nav-mark settings-mark" aria-hidden="true"/><span>Settings</span></button>
      </nav>
      <div className="sidebar-foot">A calm place to keep your job search moving.<br/><br/>{apps.length} saved application{apps.length === 1 ? "" : "s"}</div>
    </aside>
    <main className="content">
      <header className="topbar"><div><p className="eyebrow">{todayLabel}</p><h1>{view === "applications" ? (hydrated ? `${greeting}, ${displayName}.` : "Welcome back.") : view === "insights" ? "Your search at a glance." : "Make Applyly yours."}</h1><p className="sub">{view === "applications" ? "Here's the pulse of your job search." : view === "insights" ? "Patterns and progress across your applications." : "Update your preferences and manage your data."}</p></div></header>
      {error && <div className="notice error">{error}<button onClick={() => setError("")} aria-label="Dismiss">Dismiss</button></div>}
      {view === "applications" && <>
        <section className="stats"><div className="stat"><div className="stat-label">Total applications</div><strong>{apps.length}</strong><span className="trend">All time</span></div><div className="stat"><div className="stat-label">Active pipeline</div><strong>{active}</strong><span className="trend">Keep the momentum</span></div><div className="stat"><div className="stat-label">Response rate</div><strong>{response}%</strong><span className="trend">Phone screen or later</span></div><div className="stat"><div className="stat-label">Interviews</div><strong>{apps.filter(app => app.status === "Interview").length}</strong><span className="trend">In your pipeline</span></div></section>
        <div className="grid"><section className="card"><div className="card-head"><div><h2>Application pipeline</h2><p className="sub">Move each opportunity forward.</p></div><div className="filter"><input className="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search roles..."/><select value={filter} onChange={event => setFilter(event.target.value)}><option>All applications</option>{statuses.map(status => <option key={status}>{status}</option>)}</select></div></div><div className="pipeline">{counts.map(({status,count}) => <div className="stage" key={status}><span className="dot"/><label>{status}</label><strong>{count}</strong></div>)}</div><div className="table-wrap"><table className="table"><thead><tr><th>ROLE & COMPANY</th><th>STATUS</th><th>APPLIED</th><th>LOCATION</th><th>ACTIONS</th></tr></thead><tbody>{loading ? <tr><td colSpan={5}><div className="empty">Loading applications...</div></td></tr> : visible.length ? visible.map(app => <tr key={app.id}><td><div className="company">{app.url ? <a className="application-link" href={app.url} target="_blank" rel="noreferrer">{app.company} <span className="url-icon" aria-hidden="true"/></a> : app.company}</div><div className="role">{app.role}</div></td><td><StatusPicker value={app.status} onChange={status => changeStatus(app.id, status)} compact /></td><td>{formatDate(app.appliedDate)}</td><td>{app.location}</td><td className="actions-cell"><button className="row-action" title="View application details" onClick={() => openDetails(app)}>Details</button><button className="row-action history-action" title="View status history" onClick={() => openHistory(app)}>History</button><button className="row-action delete-action" title="Delete application" onClick={() => removeApplication(app.id)}>Delete</button></td></tr>) : <tr><td colSpan={5}><div className="empty">No applications match this view.</div></td></tr>}</tbody></table></div></section><aside className="card side-card"><h2>Add an application</h2><div className="tip"><strong>Small steps, steady progress.</strong>Capture the details while they&apos;re fresh, then keep your pipeline moving.</div><form onSubmit={add}><div className="field"><label htmlFor="company">COMPANY</label><input id="company" placeholder="e.g. Stripe" value={form.company} onChange={event => setForm({...form, company:event.target.value})}/></div><div className="field"><label htmlFor="role">ROLE</label><input id="role" placeholder="e.g. Product Designer" value={form.role} onChange={event => setForm({...form, role:event.target.value})}/></div><div className="field"><label htmlFor="status">STATUS</label><StatusPicker value={form.status} onChange={status => setForm({...form, status})} /></div><div className="field"><div className="date-label"><label htmlFor="appliedDate">APPLIED DATE</label><button type="button" className="today-button" onClick={() => setForm({...form, appliedDate:todayIso()})}>Today</button></div><input id="appliedDate" type="date" value={form.appliedDate} onChange={event => setForm({...form, appliedDate:event.target.value})}/></div><div className="field"><label htmlFor="location">LOCATION</label><input id="location" placeholder="Remote or city" value={form.location} onChange={event => setForm({...form, location:event.target.value})}/></div><div className="field"><label htmlFor="contactEmail">CONTACT EMAIL</label><input id="contactEmail" type="email" placeholder="recruiter@company.com" value={form.contactEmail} onChange={event => setForm({...form, contactEmail:event.target.value})}/></div><div className="field"><label htmlFor="source">SOURCE</label><select id="source" value={form.source} onChange={event => setForm({...form, source:event.target.value})}><option value="">Select source</option><option>Company website</option><option>LinkedIn</option><option>Email</option><option>Referral</option><option>Recruiter</option><option>Other</option></select></div><div className="field"><label htmlFor="nextStep">NEXT STEP</label><input id="nextStep" placeholder="e.g. Complete take-home test" value={form.nextStep} onChange={event => setForm({...form, nextStep:event.target.value})}/></div><div className="field"><label htmlFor="nextActionDate">NEXT ACTION DATE</label><input id="nextActionDate" type="date" value={form.nextActionDate} onChange={event => setForm({...form, nextActionDate:event.target.value})}/></div><div className="field"><label htmlFor="url">APPLICATION LINK</label><input id="url" type="url" placeholder="https://company.com/jobs/..." value={form.url} onChange={event => setForm({...form, url:event.target.value})}/></div><div className="field"><label htmlFor="notes">NOTES <span style={{fontWeight:400}}>(optional)</span></label><textarea id="notes" placeholder="Next step, contact, or a reminder..." value={form.notes} onChange={event => setForm({...form, notes:event.target.value})}/></div><button className="primary full" disabled={saving}>{saving ? "Saving..." : "Save application"}</button></form></aside></div>
      </>}
      {view === "insights" && <InsightsPanel apps={apps} analytics={analytics} selectedYear={insightYear} onSelectYear={setInsightYear}/>}
      {view === "settings" && <section className="settings-layout"><form className="card settings-card" onSubmit={saveSettings}><div className="card-head"><div><h2>Preferences</h2><p className="sub">These settings are stored in this browser.</p></div></div><div className="settings-body"><div className="field"><label htmlFor="displayName">YOUR NAME</label><input id="displayName" value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Alex"/></div><div className="field"><label htmlFor="defaultLocation">DEFAULT LOCATION</label><input id="defaultLocation" value={defaultLocation} onChange={event => setDefaultLocation(event.target.value)} placeholder="Remote"/></div><button className="primary" type="submit">Save preferences</button>{settingsSaved && <div className="notice success">Preferences saved.</div>}</div></form><section className="card settings-card danger-card"><div className="card-head"><div><h2>Data management</h2><p className="sub">Your applications are stored in local D1.</p></div></div><div className="settings-body"><p className="sub">You have <strong>{apps.length}</strong> saved application{apps.length === 1 ? "" : "s"}.</p><button className="danger-button" onClick={clearApplications} disabled={!apps.length}>Delete all applications</button></div></section></section>}
      {detailsFor && <ApplicationDetailsModal application={detailsFor} onClose={() => setDetailsFor(null)} onSaved={updated => { setApps(current => current.map(app => app.id === updated.id ? updated : app)); setDetailsFor(updated); }}/>}
      {historyFor && <div className="modal-backdrop" onClick={() => setHistoryFor(null)}><section className="history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title" onClick={event => event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">STATUS TIMELINE</p><h2 id="history-title">{historyFor.company}</h2><p className="sub">{historyFor.role}</p></div><button className="modal-close" onClick={() => setHistoryFor(null)} aria-label="Close">Close</button></div><div className="timeline">{historyEntries.length ? historyEntries.map((entry, index) => <div className="timeline-item" key={entry.id}><span className={`timeline-dot ${statusClass(entry.status)}`}/><div><strong>{entry.status}</strong><p>{entry.note ?? "Status updated"}</p>{index > 0 && <button className="timeline-undo" onClick={() => undoHistory(entry)}>Undo this change</button>}</div><time>{new Date(entry.changedAt).toLocaleString("en-US", {month:"short", day:"numeric", hour:"numeric", minute:"2-digit"})}</time></div>) : <div className="empty">Loading status history...</div>}</div></section></div>}    </main>
  </div>;
}

