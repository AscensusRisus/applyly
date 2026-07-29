"use client";

import { type ApplicationDetails } from "./application-details";

export type Analytics = {
  totalApplications:number;
  reachedAssessment:number;
  reachedInterview:number;
  reachedOffer:number;
  rejected:number;
  transitions:{applicationToAssessment:number; applicationToInterview:number; applicationToRejected:number; interviewToOffer:number; interviewToRejected:number};
};

const statuses = ["Applied", "Phone screen", "Assessment", "Interview", "Offer", "Rejected"];
const statusClass = (status:string) => status.toLowerCase().replaceAll(" ", "-");
const formatDate = (value:string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month:"short", day:"numeric" });

export default function InsightsPanel({ apps, analytics, selectedYear, onSelectYear }: { apps:ApplicationDetails[]; analytics:Analytics | null; selectedYear:string; onSelectYear:(year:string) => void }) {
  const years = [...new Set(apps.map(app => app.appliedDate.slice(0, 4)).filter(year => /^\d{4}$/.test(year)))].sort((a, b) => Number(b) - Number(a));
  const scopedApps = selectedYear === "all" ? apps : apps.filter(app => app.appliedDate.startsWith(`${selectedYear}-`));
  const counts = statuses.map(status => ({ status, count:scopedApps.filter(app => app.status === status).length }));
  const active = scopedApps.filter(app => app.status !== "Rejected").length;
  const scopeLabel = selectedYear === "all" ? "all time" : selectedYear;
  const activity = selectedYear === "all"
    ? [...years].reverse().map(year => ({ label:year, count:apps.filter(app => app.appliedDate.startsWith(`${year}-`)).length }))
    : Array.from({length:12}, (_, index) => ({ label:new Date(Number(selectedYear), index).toLocaleDateString("en-US", {month:"short"}), count:scopedApps.filter(app => app.appliedDate.slice(5, 7) === String(index + 1).padStart(2, "0")).length }));
  const maxActivity = Math.max(1, ...activity.map(item => item.count));

  return <section className="insights">
    <div className="insights-scope" aria-label="Insights period">
      <button className={selectedYear === "all" ? "active" : ""} onClick={() => onSelectYear("all")}>All time</button>
      {years.map(year => <button key={year} className={selectedYear === year ? "active" : ""} onClick={() => onSelectYear(year)}>{year}</button>)}
    </div>
    <div className="insight-grid"><div className="card insight-card"><p className="eyebrow">PIPELINE HEALTH</p><strong className="insight-number">{active}</strong><p className="sub">active opportunities in {scopeLabel}</p><div className="progress"><span style={{width:`${scopedApps.length ? active / scopedApps.length * 100 : 0}%`}}/></div></div><div className="card insight-card"><p className="eyebrow">TOP STATUS</p><strong className="insight-title">{[...counts].sort((a,b) => b.count - a.count)[0]?.count ? [...counts].sort((a,b) => b.count - a.count)[0]?.status : "No data"}</strong><p className="sub">most common stage in {scopeLabel}</p></div><div className="card insight-card"><p className="eyebrow">NEXT MOVE</p><strong className="insight-title">{scopedApps.find(app => app.status === "Interview")?.company ?? "Keep applying"}</strong><p className="sub">{scopedApps.find(app => app.status === "Interview") ? "has an interview-stage application" : "add an interview to this view"}</p></div></div>
    <section className="card transition-card"><div className="card-head"><div><h2>Conversion funnel</h2><p className="sub">How applications moved through the process in {scopeLabel}.</p></div></div><div className="funnel-grid"><div className="funnel-step"><span>Applications</span><strong>{analytics?.totalApplications ?? scopedApps.length}</strong></div><div className="funnel-arrow" aria-hidden="true"/><div className="funnel-step"><span>Reached assessment</span><strong>{analytics?.reachedAssessment ?? 0}</strong><small>{analytics && analytics.totalApplications ? Math.round(analytics.reachedAssessment / analytics.totalApplications * 100) : 0}% of applications</small></div><div className="funnel-arrow" aria-hidden="true"/><div className="funnel-step"><span>Reached interview</span><strong>{analytics?.reachedInterview ?? 0}</strong><small>{analytics && analytics.totalApplications ? Math.round(analytics.reachedInterview / analytics.totalApplications * 100) : 0}% of applications</small></div><div className="funnel-arrow" aria-hidden="true"/><div className="funnel-step offer-step"><span>Reached offer</span><strong>{analytics?.reachedOffer ?? 0}</strong><small>{analytics && analytics.reachedInterview ? Math.round(analytics.reachedOffer / analytics.reachedInterview * 100) : 0}% of interviews</small></div></div><div className="transition-list"><div><span>Application to Interview</span><strong>{analytics?.transitions.applicationToInterview ?? 0}</strong></div><div><span>Application to Rejected</span><strong>{analytics?.transitions.applicationToRejected ?? 0}</strong></div><div><span>Interview to Offer</span><strong>{analytics?.transitions.interviewToOffer ?? 0}</strong></div><div><span>Interview to Rejected</span><strong>{analytics?.transitions.interviewToRejected ?? 0}</strong></div></div></section>
    <div className="insight-columns"><section className="card chart-card"><div className="card-head"><div><h2>Applications by status</h2><p className="sub">A color-coded view of {scopeLabel}.</p></div></div><div className="stacked-chart"><div className="stacked-meta"><strong>{scopedApps.length}</strong><span>Total applications</span></div><div className="stacked-bar" role="img" aria-label="Applications grouped by status">{counts.map(item => <div key={item.status} className={`stacked-segment ${statusClass(item.status)}`} style={{width:`${scopedApps.length ? item.count / scopedApps.length * 100 : 0}%`}} title={`${item.status}: ${item.count}`}>{item.count > 0 && item.count}</div>)}</div><div className="legend">{counts.map(item => <div className="legend-item" key={item.status}><span className={`legend-swatch ${statusClass(item.status)}`}/><span>{item.status}</span><strong>{item.count}</strong><small>{scopedApps.length ? Math.round(item.count / scopedApps.length * 100) : 0}%</small></div>)}</div></div></section><section className="card chart-card"><div className="card-head"><div><h2>{selectedYear === "all" ? "Applications by year" : `Monthly activity in ${selectedYear}`}</h2><p className="sub">{selectedYear === "all" ? "Every saved application, grouped by its applied year." : "Applications added throughout this year."}</p></div></div><div className="vertical-chart">{activity.map(item => <div className="column" key={item.label}><span>{item.count}</span><div className="column-track"><div className="column-fill" style={{height:`${item.count / maxActivity * 100}%`}}/></div><label>{item.label}</label></div>)}</div></section></div>
    <section className="card table-card"><div className="card-head"><div><h2>{selectedYear === "all" ? "Recent applications" : `${selectedYear} applications`}</h2><p className="sub">{selectedYear === "all" ? "Your latest additions." : `Applications recorded in ${selectedYear}.`}</p></div></div>{scopedApps.length ? <div className="recent-list">{scopedApps.slice(0,5).map(app => <div className="recent-item" key={app.id}><div><strong>{app.company}</strong><span>{app.role}</span></div><div><span className={`status-dot ${statusClass(app.status)}`}/>{app.status}<small>{formatDate(app.appliedDate)}</small></div></div>)}</div> : <div className="empty">No applications were added in {scopeLabel}.</div>}</section>
  </section>;
}
