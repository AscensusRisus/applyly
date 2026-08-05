"use client";
import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import ApplicationDetailsModal, { type ApplicationDetails } from "./components/application-details";
import InsightsPanel, { type Analytics } from "./components/insights-panel";
import DataTransferPanel from "./components/data-transfer-panel";
import { formatCalendarDate, formatStoredDate } from "./lib/date-format";
import { applicationSources, applicationStatuses } from "./lib/application-options";

type View = "applications" | "insights" | "settings" | "data";
type Application = ApplicationDetails;
 type HistoryEntry = { id:number; status:string; changedAt:number; note?:string | null };
const statuses = applicationStatuses;
type DefaultDateMode = "none" | "today" | "custom";
type Theme = "default" | "applyly-dark" | "dusk-stone" | "warm-taupe" | "indigo-paper" | "harbor-blue" | "berry-noir" | "greenwood" | "earth-sage";
const emptyForm = () => ({company:"", role:"", location:"Remote", status:"Applied", appliedDate:"", salary:"", url:"", notes:"", contactEmail:"", source:"", nextStep:"", nextActionDate:""});

function todayIso() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function formatTimelineTimestamp(value:number, locale:string) { const date = new Date(value); return `${formatCalendarDate(date, locale)}, ${date.toLocaleTimeString(locale, {hour:"numeric", minute:"2-digit"})}`; }
function defaultAppliedDate(mode:DefaultDateMode, customDate:string) { return mode === "today" ? todayIso() : mode === "custom" ? customDate : ""; }
function statusClass(status:string) { return status.toLowerCase().replaceAll(" ", "-"); }

function StatusPicker({value, onChange, compact = false}:{value:string; onChange:(value:string)=>void; compact?:boolean}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({top:0, left:0, width:0});
  const menuId = useId();
  const pickerRef = useRef<HTMLDivElement>(null);
  const positionMenu = () => {
    const trigger = pickerRef.current?.querySelector(".status-picker-trigger");
    if (!(trigger instanceof HTMLElement)) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = Math.min(292, window.innerHeight - 24);
    const openUp = rect.bottom + menuHeight + 8 > window.innerHeight && rect.top > menuHeight + 8;
    const top = openUp ? Math.max(12, rect.top - menuHeight - 6) : Math.min(window.innerHeight - menuHeight - 12, rect.bottom + 6);
    setMenuPosition({top, left:Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), width:rect.width});
  };
  useEffect(() => {
    if (!open) return;
    positionMenu();
    const close = (event:MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setOpen(false); };
    const reposition = () => positionMenu();
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("resize", reposition); window.removeEventListener("scroll", reposition, true); };
  }, [open]);
  return <div className={`status-picker ${compact ? "compact" : ""}`} ref={pickerRef}>
    <button type="button" className={`status-picker-trigger ${statusClass(value)}`} role="combobox" aria-controls={menuId} aria-expanded={open} onClick={() => setOpen(current => !current)}><span className="status-color-dot"/>{value}<span className="picker-chevron" aria-hidden="true"/></button>
    {open && <div id={menuId} className="status-picker-menu" style={{top:menuPosition.top, left:menuPosition.left, minWidth:menuPosition.width}} role="listbox">{statuses.map(status => <button type="button" role="option" aria-selected={status === value} className={`status-picker-option ${statusClass(status)}`} key={status} onClick={() => { onChange(status); setOpen(false); }}><span className="status-color-dot"/>{status}</button>)}</div>}
  </div>;
}export default function Home() {
  const [view, setView] = useState<View>("applications");
  const [apps, setApps] = useState<Application[]>([]);
  const [filter, setFilter] = useState("All applications");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All sources");
  const [salaryFilter, setSalaryFilter] = useState("All salaries");
  const [pageSize, setPageSize] = useState(25);
  const [customRowsMode, setCustomRowsMode] = useState(false);
  const [customPageSize, setCustomPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState("Alex");
  const [defaultLocation, setDefaultLocation] = useState("Remote");
  const [defaultSource, setDefaultSource] = useState("");
  const [defaultDateMode, setDefaultDateMode] = useState<DefaultDateMode>("none");
  const [defaultCustomDate, setDefaultCustomDate] = useState("");
  const [dateLocale, setDateLocale] = useState("en-US");
  const [theme, setTheme] = useState<Theme>("default");
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [historyFor, setHistoryFor] = useState<Application | null>(null);
  const [detailsFor, setDetailsFor] = useState<Application | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [insightYear, setInsightYear] = useState("all");
  const [todayLabel, setTodayLabel] = useState("TODAY");
  const [greeting, setGreeting] = useState("Good morning");
  const [hydrated, setHydrated] = useState(false);
  const paginationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedName = window.localStorage.getItem("applyly.displayName");
    const savedLocation = window.localStorage.getItem("applyly.defaultLocation");
    const savedSource = window.localStorage.getItem("applyly.defaultSource") ?? "";
    const savedDateMode = window.localStorage.getItem("applyly.defaultDateMode") as DefaultDateMode | null;
    const savedCustomDate = window.localStorage.getItem("applyly.defaultCustomDate") ?? "";
    const savedPageSize = Number(window.localStorage.getItem("applyly.pageSize"));
    const savedTheme = window.localStorage.getItem("applyly.theme") as Theme | null;
    if (Number.isInteger(savedPageSize) && savedPageSize >= 1 && savedPageSize <= 500) Promise.resolve().then(() => { setPageSize(savedPageSize); setCustomPageSize(savedPageSize); setCustomRowsMode(![10, 25, 50, 100].includes(savedPageSize)); });
    const browserDateLocale = navigator.language || "en-US";
    const loadedDateMode:DefaultDateMode = savedDateMode === "today" || savedDateMode === "custom" ? savedDateMode : "none";
    const now = new Date();
    Promise.resolve().then(() => {
      if (savedName) setDisplayName(savedName);
      if (savedLocation) setDefaultLocation(savedLocation);
      setDefaultSource(savedSource); setDefaultDateMode(loadedDateMode); setDefaultCustomDate(savedCustomDate); setDateLocale(browserDateLocale);
      const loadedTheme:Theme = savedTheme === "applyly-dark" || savedTheme === "dusk-stone" || savedTheme === "warm-taupe" || savedTheme === "indigo-paper" || savedTheme === "harbor-blue" || savedTheme === "berry-noir" || savedTheme === "greenwood" || savedTheme === "earth-sage" ? savedTheme : "default";
      setTheme(loadedTheme); document.documentElement.dataset.theme = loadedTheme === "default" ? "" : loadedTheme;
      setForm(current => current.company || current.role ? current : {...current, location:savedLocation || "Remote", source:savedSource, appliedDate:defaultAppliedDate(loadedDateMode, savedCustomDate)});
      setTodayLabel(now.toLocaleDateString(browserDateLocale, {weekday:"long", year:"numeric", month:"long", day:"numeric"}).toUpperCase());
      setGreeting(now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening");
      setHydrated(true);
    });
    const controller = new AbortController();
    fetch("/api/applications", { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Unable to load applications")))
      .then(data => setApps(data.applications ?? []))
      .catch(error => { if (error.name !== "AbortError") setError("Could not load your applications. Please refresh and try again."); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (view !== "applications" && view !== "insights") return;
    const controller = new AbortController();
    const analyticsUrl = view === "insights" && insightYear !== "all" ? `/api/applications/analytics?year=${encodeURIComponent(insightYear)}` : "/api/applications/analytics";
    fetch(analyticsUrl, { signal: controller.signal }).then(response => response.ok ? response.json() : Promise.reject(new Error())).then(data => setAnalytics(data)).catch(error => { if (error.name !== "AbortError") setError("Insights data could not be loaded."); });
    return () => controller.abort();
  }, [view, apps, insightYear]);
const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return apps.filter(app => {
      const searchable = [app.company, app.role, app.status, app.location, app.appliedDate, formatStoredDate(app.appliedDate, dateLocale), app.source, app.salary, app.contactEmail, app.nextStep, app.notes].filter(Boolean).join(" ").toLowerCase();
      return (filter === "All applications" || app.status === filter) &&
        (sourceFilter === "All sources" || app.source === sourceFilter) &&
        (salaryFilter === "All salaries" || (salaryFilter === "Has salary" ? Boolean(app.salary?.trim()) : !app.salary?.trim())) &&
        (!query || searchable.includes(query));
    });
  }, [apps, filter, search, sourceFilter, salaryFilter, dateLocale]);
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedApplications = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const placeholderRows = totalPages > 1 ? Math.max(0, pageSize - pagedApplications.length) : 0;
  const counts = useMemo(() => statuses.map(status => ({ status, count: apps.filter(app => app.status === status).length })), [apps]);
  const active = apps.filter(app => !["Rejected", "Withdrawn"].includes(app.status)).length;
  const response = analytics?.responseRate ?? (apps.length ? Math.round((apps.filter(app => ["Contact", "Phone screen", "Interview", "Offer"].includes(app.status)).length / apps.length) * 100) : 0);


  function handlePageSizeChange(nextSize:number) {
    setCustomRowsMode(false);
    setPageSize(nextSize);
    setPage(1);
    window.localStorage.setItem("applyly.pageSize", String(nextSize));
    requestAnimationFrame(() => paginationRef.current?.scrollIntoView({block:"nearest", behavior:"smooth"}));
  }

  function applyCustomPageSize() {
    const nextSize = Math.min(500, Math.max(1, Math.floor(customPageSize) || 1));
    setCustomPageSize(nextSize);
    setCustomRowsMode(true);
    setPageSize(nextSize);
    setPage(1);
    window.localStorage.setItem("applyly.pageSize", String(nextSize));
    requestAnimationFrame(() => paginationRef.current?.scrollIntoView({block:"nearest", behavior:"smooth"}));
  }

  function resetApplicationForm(location = defaultLocation, source = defaultSource, dateMode = defaultDateMode, customDate = defaultCustomDate) {
    setForm({...emptyForm(), location:location.trim() || "Remote", source, appliedDate:defaultAppliedDate(dateMode, customDate)});
    setError("");
  }

  async function add(event:FormEvent) {
    event.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;
    if (!form.appliedDate) { setError("Choose an applied date or use Today."); return; }
    setSaving(true); setError("");
    const submitted = {...form}; const optimistic = {...submitted, id:Date.now()};
    setApps(current => [optimistic, ...current]); resetApplicationForm();
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
  function selectTheme(nextTheme:Theme) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme === "default" ? "" : nextTheme;
  }

  function saveSettings(event:FormEvent) {
    event.preventDefault();
    if (defaultDateMode === "custom" && !defaultCustomDate) { setError("Choose a default date or select None or Today."); return; }
    window.localStorage.setItem("applyly.displayName", displayName.trim() || "Alex");
    const savedLocation = defaultLocation.trim() || "Remote";
    window.localStorage.setItem("applyly.defaultLocation", savedLocation);
    window.localStorage.setItem("applyly.defaultSource", defaultSource);
    window.localStorage.setItem("applyly.defaultDateMode", defaultDateMode);
    window.localStorage.setItem("applyly.defaultCustomDate", defaultCustomDate);
    window.localStorage.setItem("applyly.theme", theme);
    resetApplicationForm(savedLocation, defaultSource, defaultDateMode, defaultCustomDate);
    const now = new Date(); setTodayLabel(now.toLocaleDateString(dateLocale, {weekday:"long", year:"numeric", month:"long", day:"numeric"}).toUpperCase());
    setSettingsSaved(true); window.setTimeout(() => setSettingsSaved(false), 2400);
  }

  async function clearApplications() {
    if (!apps.length || !window.confirm("Delete every application and its status history? This cannot be undone. Export a JSON backup first if you may need this data later.")) return;
    const previous = apps; setApps([]);
    try {
      const response = await fetch("/api/applications/bulk-delete", { method:"DELETE" });
      if (!response.ok) throw new Error();
    } catch { setApps(previous); setError("Some applications could not be deleted."); }
  }
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">apply<span>ly</span></div>
      <nav className="nav" aria-label="Primary navigation">
        <button className={view === "applications" ? "active" : ""} aria-current={view === "applications" ? "page" : undefined} aria-label="Applications" data-label="Applications" title="Applications" onClick={() => { setView("applications"); resetApplicationForm(); }}><span className="nav-mark applications-mark" aria-hidden="true"/><span>Applications</span></button>
        <button className={view === "insights" ? "active" : ""} aria-current={view === "insights" ? "page" : undefined} aria-label="Insights" data-label="Insights" title="Insights" onClick={() => setView("insights")}><span className="nav-mark insights-mark" aria-hidden="true"/><span>Insights</span></button>
        <button className={view === "settings" ? "active" : ""} aria-current={view === "settings" ? "page" : undefined} aria-label="Settings" data-label="Settings" title="Settings" onClick={() => setView("settings")}><span className="nav-mark settings-mark" aria-hidden="true"/><span>Settings</span></button><button className={view === "data" ? "active" : ""} aria-current={view === "data" ? "page" : undefined} aria-label="Data" data-label="Data" title="Data" onClick={() => setView("data")}><span className="nav-mark data-mark" aria-hidden="true"/><span>Data</span></button>
      </nav>
    </aside>
    <main id="main-content" className="content">
      <header className="topbar"><div><p className="eyebrow">{todayLabel}</p><h1>{view === "applications" ? (hydrated ? `${greeting}, ${displayName}.` : "Welcome back.") : view === "insights" ? "Your search at a glance." : view === "data" ? "Keep your data portable." : "Make Applyly yours."}</h1><p className="sub">{view === "applications" ? "Here's the pulse of your job search." : view === "insights" ? "Patterns and progress across your applications." : view === "data" ? "Export a backup or restore your application history." : "Update your preferences and manage your data."}</p></div></header>
      {error && <div className="notice error">{error}<button onClick={() => setError("")} aria-label="Dismiss">Dismiss</button></div>}
      {view === "applications" && <>
        <section className="stats"><div className="stat"><div className="stat-label">Total applications</div><strong>{apps.length}</strong><span className="trend">All time</span></div><div className="stat"><div className="stat-label">Active pipeline</div><strong>{active}</strong><span className="trend">Keep the momentum</span></div><div className="stat"><div className="stat-label">Response rate</div><strong>{response}%</strong><span className="trend">Reached a response stage</span></div><div className="stat"><div className="stat-label">Interviews</div><strong>{apps.filter(app => app.status === "Interview").length}</strong><span className="trend">In your pipeline</span></div></section>
        <div className="grid"><section className="card application-table-card"><div className="card-head"><div><h2>Application pipeline</h2><p className="sub">Move each opportunity forward.</p></div><div className="filter"><input className="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search company, role, location, date, source or salary..."/><select aria-label="Filter by status" value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }}><option>All applications</option>{statuses.map(status => <option key={status}>{status}</option>)}</select><select aria-label="Filter by source" value={sourceFilter} onChange={event => { setSourceFilter(event.target.value); setPage(1); }}><option>All sources</option>{applicationSources.map(source => <option key={source}>{source}</option>)}</select><select aria-label="Filter by salary" value={salaryFilter} onChange={event => { setSalaryFilter(event.target.value); setPage(1); }}><option>All salaries</option><option>Has salary</option><option>No salary</option></select></div></div><div className="pipeline">{counts.map(({status,count}) => <div className={`stage ${statusClass(status)}`} key={status}><span className="dot"/><label>{status}</label><strong>{count}</strong></div>)}</div><div className="table-wrap"><table className="table"><thead><tr><th>ROLE & COMPANY</th><th>STATUS</th><th>APPLIED</th><th>LOCATION</th><th>ACTIONS</th></tr></thead><tbody>{loading ? <tr><td colSpan={5}><div className="empty">Loading applications...</div></td></tr> : visible.length ? <>{pagedApplications.map(app => <tr key={app.id}><td><div className="company">{app.url ? <a className="application-link" href={app.url} target="_blank" rel="noreferrer">{app.company} <span className="url-icon" aria-hidden="true"/></a> : app.company}</div><div className="role">{app.role}</div></td><td><StatusPicker value={app.status} onChange={status => changeStatus(app.id, status)} compact /></td><td>{formatStoredDate(app.appliedDate, dateLocale)}</td><td>{app.location}</td><td className="actions-cell"><button className="row-action" title="View application details" onClick={() => openDetails(app)}>Details</button><button className="row-action history-action" title="View status history" onClick={() => openHistory(app)}>History</button><button className="row-action delete-action" title="Delete application" onClick={() => removeApplication(app.id)}>Delete</button></td></tr>)}{Array.from({length: placeholderRows}, (_, index) => <tr className="table-placeholder" aria-hidden="true" key={`placeholder-${index}`}><td colSpan={5}><div className="company">&nbsp;</div><div className="role">&nbsp;</div></td></tr>)}</> : <tr><td colSpan={5}><div className="empty">No applications match this view.</div></td></tr>}</tbody></table></div>{!loading && visible.length > 0 && <div className="table-pagination" ref={paginationRef}><span>{visible.length} result{visible.length === 1 ? "" : "s"} · Page {currentPage} of {totalPages}</span><div><label>Rows <select value={customRowsMode ? "custom" : pageSize} onChange={event => event.target.value === "custom" ? (setCustomRowsMode(true), setCustomPageSize(pageSize)) : handlePageSizeChange(Number(event.target.value))}>{[10,25,50,100].map(size => <option key={size} value={size}>{size}</option>)}<option value="custom">Custom</option></select>{customRowsMode && <input className="rows-custom-input" aria-label="Custom rows per page" type="number" min="1" max="500" value={customPageSize} onChange={event => setCustomPageSize(Number(event.target.value))} onBlur={applyCustomPageSize} onKeyDown={event => { if (event.key === "Enter") applyCustomPageSize(); }}/>}</label><button className="secondary-button" type="button" disabled={currentPage === 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</button><button className="secondary-button" type="button" disabled={currentPage === totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))}>Next</button></div></div>}</section><aside className="card side-card"><div className="side-card-head"><h2>Add an application</h2><button type="button" className="form-reset-button" onClick={() => resetApplicationForm()} aria-label="Reset form to saved defaults" title="Reset form to saved defaults"><svg className="refresh-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.65 6.35A8 8 0 1 0 19.73 14H17.65a6 6 0 1 1-1.41-6.24L13 11h7V4z"/></svg></button></div><div className="tip"><strong>Small steps, steady progress.</strong>Capture the details while they&apos;re fresh, then keep your pipeline moving.</div><form onSubmit={add}><div className="field"><label htmlFor="company">COMPANY</label><input id="company" placeholder="e.g. Stripe" value={form.company} onChange={event => setForm({...form, company:event.target.value})}/></div><div className="field"><label htmlFor="role">ROLE</label><input id="role" placeholder="e.g. Product Designer" value={form.role} onChange={event => setForm({...form, role:event.target.value})}/></div><div className="field"><label htmlFor="status">STATUS</label><StatusPicker value={form.status} onChange={status => setForm({...form, status})} /></div><div className="field"><div className="date-label"><label htmlFor="appliedDate">APPLIED DATE</label><button type="button" className="today-button" onClick={() => setForm({...form, appliedDate:todayIso()})}>Today</button></div><input id="appliedDate" type="date" value={form.appliedDate} onChange={event => setForm({...form, appliedDate:event.target.value})} required/></div><div className="field"><label htmlFor="location">LOCATION</label><input id="location" placeholder="Remote or city" value={form.location} onChange={event => setForm({...form, location:event.target.value})}/></div><div className="field"><label htmlFor="salary">SALARY <span style={{fontWeight:400}}>(optional)</span></label><input id="salary" placeholder="e.g. €60,000 or $80/hr" value={form.salary} onChange={event => setForm({...form, salary:event.target.value})}/></div>
<div className="field"><label htmlFor="contactEmail">CONTACT EMAIL</label><input id="contactEmail" type="email" placeholder="recruiter@company.com" value={form.contactEmail} onChange={event => setForm({...form, contactEmail:event.target.value})}/></div><div className="field"><label htmlFor="source">SOURCE</label><select id="source" value={form.source} onChange={event => setForm({...form, source:event.target.value})}><option value="">Select source</option>{applicationSources.map(source => <option key={source}>{source}</option>)}</select></div><div className="field"><label htmlFor="nextStep">NEXT STEP</label><input id="nextStep" placeholder="e.g. Complete take-home test" value={form.nextStep} onChange={event => setForm({...form, nextStep:event.target.value})}/></div><div className="field"><label htmlFor="nextActionDate">NEXT ACTION DATE</label><input id="nextActionDate" type="date" value={form.nextActionDate} onChange={event => setForm({...form, nextActionDate:event.target.value})}/></div><div className="field"><label htmlFor="url">APPLICATION LINK</label><input id="url" type="url" placeholder="https://company.com/jobs/..." value={form.url} onChange={event => setForm({...form, url:event.target.value})}/></div><div className="field"><label htmlFor="notes">NOTES <span style={{fontWeight:400}}>(optional)</span></label><textarea id="notes" placeholder="Next step, contact, or a reminder..." value={form.notes} onChange={event => setForm({...form, notes:event.target.value})}/></div><button className="primary full" disabled={saving}>{saving ? "Saving..." : "Save application"}</button></form></aside></div>
      </>}
      {view === "insights" && <InsightsPanel apps={apps} analytics={analytics} selectedYear={insightYear} onSelectYear={setInsightYear} dateLocale={dateLocale}/>}
      {view === "data" && <DataTransferPanel applicationsCount={apps.length} onImported={applications => setApps(applications)} onClear={clearApplications}/>}
      {view === "settings" && <section className="settings-layout"><form className="card settings-card" onSubmit={saveSettings}><div className="card-head"><div><h2>Preferences</h2><p className="sub">These settings are stored in this browser.</p></div></div><div className="settings-body"><div className="field"><label htmlFor="displayName">YOUR NAME</label><input id="displayName" value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Alex"/></div><div className="field"><label htmlFor="defaultLocation">DEFAULT LOCATION</label><input id="defaultLocation" value={defaultLocation} onChange={event => setDefaultLocation(event.target.value)} placeholder="Remote"/></div><div className="field"><label htmlFor="theme">THEME</label><select id="theme" value={theme} onChange={event => selectTheme(event.target.value as Theme)}><option value="default">Applyly Light</option><option value="applyly-dark">Applyly Dark</option><option value="dusk-stone">Dusk &amp; Stone</option><option value="warm-taupe">Warm Taupe</option><option value="indigo-paper">Indigo Paper</option><option value="harbor-blue">Harbor Blue</option><option value="berry-noir">Berry Noir</option><option value="greenwood">Greenwood</option><option value="earth-sage">Earth &amp; Sage</option></select><span className="theme-help">Choose a visual theme. Your applications and data stay unchanged.</span></div><div className="field"><label htmlFor="defaultSource">DEFAULT SOURCE</label><select id="defaultSource" value={defaultSource} onChange={event => setDefaultSource(event.target.value)}><option value="">No default</option>{applicationSources.map(source => <option key={source}>{source}</option>)}</select></div><div className="field"><label htmlFor="defaultDateMode">DEFAULT APPLIED DATE</label><select id="defaultDateMode" value={defaultDateMode} onChange={event => setDefaultDateMode(event.target.value as DefaultDateMode)}><option value="none">None (leave blank)</option><option value="today">Today (device-local)</option><option value="custom">A specific date</option></select></div>{defaultDateMode === "custom" && <div className="field"><label htmlFor="defaultCustomDate">DEFAULT DATE</label><input id="defaultCustomDate" type="date" value={defaultCustomDate} onChange={event => setDefaultCustomDate(event.target.value)} required/></div>}<button className="primary" type="submit">Save preferences</button>{settingsSaved && <div className="notice success">Preferences saved.</div>}</div></form></section>}
      {detailsFor && <ApplicationDetailsModal dateLocale={dateLocale} application={detailsFor} onClose={() => setDetailsFor(null)} onSaved={updated => { setApps(current => current.map(app => app.id === updated.id ? updated : app)); setDetailsFor(updated); }}/>}
      {historyFor && <div className="modal-backdrop" onClick={() => setHistoryFor(null)}><section className="history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title" onClick={event => event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">STATUS TIMELINE</p><h2 id="history-title">{historyFor.company}</h2><p className="sub">{historyFor.role}</p></div><button className="modal-close" onClick={() => setHistoryFor(null)} aria-label="Close">Close</button></div><div className="timeline">{historyEntries.length ? historyEntries.map((entry, index) => <div className="timeline-item" key={entry.id}><span className={`timeline-dot ${statusClass(entry.status)}`}/><div><strong>{entry.status}</strong><p>{entry.note ?? "Status updated"}</p>{index > 0 && <button className="timeline-undo" onClick={() => undoHistory(entry)}>Undo this change</button>}</div><time>{formatTimelineTimestamp(entry.changedAt, dateLocale)}</time></div>) : <div className="empty">Loading status history...</div>}</div></section></div>}    </main>
  </div>;
}

