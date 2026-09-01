"use client";

import { useState } from "react";
import { type ApplicationDetails } from "./application-details";
import { formatStoredDate } from "../lib/date-format";

export type Analytics = {
  totalApplications:number;
  reachedContact:number;
  responseRate:number;
  reachedAssessment:number;
  reachedInterview:number;
  reachedOffer:number;
  rejected:number;
  transitions:{applicationToAssessment:number; applicationToInterview:number; applicationToRejected:number; interviewToOffer:number; interviewToRejected:number};
};

const statuses = ["Applied", "Contact", "Phone screen", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn", "Expired"];
const trendLabels = ["Total applications", ...statuses];
const statusColors:Record<string,string> = {
  "Total applications":"#26312b",
  Applied:"#917cef",
  Contact:"#249a90",
  "Phone screen":"#428bd3",
  Assessment:"#c56ed2",
  Interview:"#e2a43b",
  Offer:"#36a66a",
  Rejected:"#d75c66",
  Withdrawn:"#89918d",
  Expired:"#af4e58",
};
const statusClass = (status:string) => status.toLowerCase().replaceAll(" ", "-");

export default function InsightsPanel({ apps, analytics, selectedYear, onSelectYear, dateLocale }: { apps:ApplicationDetails[]; analytics:Analytics | null; selectedYear:string; onSelectYear:(year:string) => void; dateLocale:string }) {
  const [visibleStatuses, setVisibleStatuses] = useState(trendLabels);
  const years = [...new Set(apps.map(app => app.appliedDate.slice(0, 4)).filter(year => /^\d{4}$/.test(year)))].sort((a, b) => Number(b) - Number(a));
  const scopedApps = selectedYear === "all" ? apps : apps.filter(app => app.appliedDate.startsWith(`${selectedYear}-`));
  const counts = statuses.map(status => ({ status, count:scopedApps.filter(app => app.status === status).length }));
  const active = scopedApps.filter(app => !["Rejected", "Withdrawn", "Expired"].includes(app.status)).length;
  const healthPercent = scopedApps.length ? Math.round(active / scopedApps.length * 100) : 0;
  let statusCursor = 0;
  const donutGradient = scopedApps.length ? `conic-gradient(${counts.map(item => { const start = statusCursor; statusCursor += item.count / scopedApps.length * 100; return `${statusColors[item.status]} ${start}% ${statusCursor}%`; }).join(",")})` : "#eef0ed";
  const scopeLabel = selectedYear === "all" ? "all time" : selectedYear;

  const usesYearBuckets = selectedYear === "all" && years.length > 1;
  const trendYear = selectedYear === "all" ? years[0] ?? "" : selectedYear;
  const trendBuckets = usesYearBuckets
    ? [...years].reverse().map(year => ({ label:year, matches:(app:ApplicationDetails) => app.appliedDate.startsWith(`${year}-`) }))
    : Array.from({length:12}, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return {
        label:new Date(2024, index).toLocaleDateString(dateLocale, {month:"short"}),
        matches:(app:ApplicationDetails) => app.appliedDate.startsWith(`${trendYear}-${month}`),
      };
    });
  const statusTrendSeries = statuses.map(status => ({
    status,
    color:statusColors[status],
    values:trendBuckets.map(bucket => scopedApps.filter(app => app.status === status && bucket.matches(app)).length),
  }));
  const totalSeries = { status:"Total applications", color:statusColors["Total applications"], values:trendBuckets.map(bucket => scopedApps.filter(app => bucket.matches(app)).length) };
  const trendSeries = [totalSeries, ...statusTrendSeries];
  const visibleSeries = trendSeries.filter(series => visibleStatuses.includes(series.status) && series.values.some(value => value > 0));
  const maxTrendValue = Math.max(1, ...visibleSeries.flatMap(series => series.values));
  const trendStep = Math.max(1, Math.ceil(maxTrendValue / 4));
  const trendMaximum = trendStep * 4;
  const trendTicks = Array.from({length:5}, (_, index) => trendMaximum - index * trendStep);
  const chartLeft = 48;
  const chartRight = 694;
  const chartTop = 18;
  const chartBottom = 246;
  const pointX = (index:number) => trendBuckets.length === 1 ? (chartLeft + chartRight) / 2 : chartLeft + index * (chartRight - chartLeft) / (trendBuckets.length - 1);
  const pointY = (value:number) => chartBottom - value / trendMaximum * (chartBottom - chartTop);
  const busiestBucket = trendBuckets.map((bucket, index) => ({ label:bucket.label, count:totalSeries.values[index] })).sort((a,b) => b.count - a.count)[0];

  function toggleStatus(status:string) {
    setVisibleStatuses(current => current.includes(status) ? current.filter(item => item !== status) : [...current, status]);
  }

  return <section className="insights">
    <div className="insights-scope" aria-label="Insights period">
      <button className={selectedYear === "all" ? "active" : ""} onClick={() => onSelectYear("all")}>All time</button>
      {years.map(year => <button key={year} className={selectedYear === year ? "active" : ""} onClick={() => onSelectYear(year)}>{year}</button>)}
    </div>

    <div className="insight-grid">
      <div className="card insight-card"><p className="eyebrow">PIPELINE HEALTH</p><strong className="insight-number">{healthPercent}%</strong><p className="sub">{active} of {scopedApps.length} applications remain active in {scopeLabel}</p><div className="progress"><span style={{width:`${scopedApps.length ? active / scopedApps.length * 100 : 0}%`}}/></div></div>
      <div className="card insight-card"><p className="eyebrow">TOP STATUS</p><strong className="insight-title">{[...counts].sort((a,b) => b.count - a.count)[0]?.count ? [...counts].sort((a,b) => b.count - a.count)[0]?.status : "No data"}</strong><p className="sub">most common stage in {scopeLabel}</p></div>
      <div className="card insight-card"><p className="eyebrow">NEXT MOVE</p><strong className="insight-title">{scopedApps.find(app => app.status === "Interview")?.company ?? "Keep applying"}</strong><p className="sub">{scopedApps.find(app => app.status === "Interview") ? "has an interview-stage application" : "add an interview to this view"}</p></div>
    </div>

    <section className="card transition-card">
      <div className="card-head"><div><h2>Conversion funnel</h2><p className="sub">How applications moved through the process in {scopeLabel}.</p></div></div>
      <div className="funnel-grid"><div className="funnel-step"><span>Applications</span><strong>{analytics?.totalApplications ?? scopedApps.length}</strong></div><div className="funnel-arrow" aria-hidden="true"/><div className="funnel-step"><span>Reached assessment</span><strong>{analytics?.reachedAssessment ?? 0}</strong><small>{analytics && analytics.totalApplications ? Math.round(analytics.reachedAssessment / analytics.totalApplications * 100) : 0}% of applications</small></div><div className="funnel-arrow" aria-hidden="true"/><div className="funnel-step"><span>Reached interview</span><strong>{analytics?.reachedInterview ?? 0}</strong><small>{analytics && analytics.totalApplications ? Math.round(analytics.reachedInterview / analytics.totalApplications * 100) : 0}% of applications</small></div><div className="funnel-arrow" aria-hidden="true"/><div className="funnel-step offer-step"><span>Reached offer</span><strong>{analytics?.reachedOffer ?? 0}</strong><small>{analytics && analytics.reachedInterview ? Math.round(analytics.reachedOffer / analytics.reachedInterview * 100) : 0}% of interviews</small></div></div>
      <div className="transition-list"><div><span>Application to Interview</span><strong>{analytics?.transitions.applicationToInterview ?? 0}</strong></div><div><span>Application to Rejected</span><strong>{analytics?.transitions.applicationToRejected ?? 0}</strong></div><div><span>Interview to Offer</span><strong>{analytics?.transitions.interviewToOffer ?? 0}</strong></div><div><span>Interview to Rejected</span><strong>{analytics?.transitions.interviewToRejected ?? 0}</strong></div></div>
    </section>

    <div className="insight-columns trend-layout">
      <section className="card chart-card status-card">
        <div className="card-head"><div><h2>Applications by status</h2><p className="sub">A color-coded view of {scopeLabel}.</p></div></div>
        <div className="stacked-chart"><div className="status-overview"><div className="status-donut" style={{background:donutGradient}}><span><strong>{scopedApps.length}</strong>Total</span></div><p><strong>{healthPercent}% pipeline health</strong><span>Active applications compared with rejected outcomes.</span></p></div><div className="stacked-meta"><strong>{scopedApps.length}</strong><span>Total applications</span></div><div className="stacked-bar" role="img" aria-label="Applications grouped by status">{counts.map(item => <div key={item.status} className={`stacked-segment ${statusClass(item.status)}`} style={{width:`${scopedApps.length ? item.count / scopedApps.length * 100 : 0}%`}} title={`${item.status}: ${item.count}`}>{item.count > 0 && item.count}</div>)}</div><div className="legend">{counts.map(item => <div className="legend-item" key={item.status}><span className={`legend-swatch ${statusClass(item.status)}`}/><span>{item.status}</span><strong>{item.count}</strong><small>{scopedApps.length ? Math.round(item.count / scopedApps.length * 100) : 0}%</small></div>)}</div></div>
      </section>

      <section className="card chart-card trend-card">
        <div className="card-head trend-head"><div><h2>Status trend</h2><p className="sub">Current application statuses grouped by {usesYearBuckets ? "applied year" : "applied month"}.</p></div>{busiestBucket?.count ? <div className="trend-highlight"><strong>{busiestBucket.count}</strong><span>in {busiestBucket.label}</span></div> : null}</div>
        <div className="trend-body">
          <div className="trend-toggles" aria-label="Visible status lines">{trendSeries.map(series => { const total=series.values.reduce((sum,value) => sum + value,0); return <button key={series.status} type="button" aria-pressed={visibleStatuses.includes(series.status) && total > 0} className={visibleStatuses.includes(series.status) && total > 0 ? "active" : ""} disabled={!total} onClick={() => toggleStatus(series.status)}><span style={{background:series.color}}/>{series.status}<strong>{total}</strong></button>; })}</div>
          <div className="trend-chart-wrap">
            <svg className="trend-chart" viewBox="0 0 720 286" role="img" aria-label={`Application status trends for ${scopeLabel}`}>
              {trendTicks.map(tick => { const y=pointY(tick); return <g key={tick}><line className="trend-grid-line" x1={chartLeft} x2={chartRight} y1={y} y2={y}/><text className="trend-axis-label" x={chartLeft - 12} y={y + 3} textAnchor="end">{tick}</text></g>; })}
              <line className="trend-axis" x1={chartLeft} x2={chartLeft} y1={chartTop} y2={chartBottom}/>
              <line className="trend-axis" x1={chartLeft} x2={chartRight} y1={chartBottom} y2={chartBottom}/>
              {trendBuckets.map((bucket,index) => <text className="trend-axis-label trend-x-label" key={bucket.label} x={pointX(index)} y={chartBottom + 25} textAnchor="middle">{bucket.label}</text>)}
              {visibleSeries.map(series => {
                const points=series.values.map((value,index) => `${pointX(index)},${pointY(value)}`).join(" ");
                return <g key={series.status}><polyline className={`trend-line ${series.status === "Total applications" ? "total-line" : ""}`} points={points} stroke={series.color}/>{series.values.map((value,index) => value > 0 ? <circle className="trend-point" key={`${series.status}-${trendBuckets[index].label}`} cx={pointX(index)} cy={pointY(value)} r={series.status === "Total applications" ? "4.5" : "4"} fill={series.color}><title>{series.status} · {trendBuckets[index].label}: {value}</title></circle> : null)}</g>;
              })}
            </svg>
            {!scopedApps.length && <div className="trend-empty">Add applications to see status trends.</div>}
          </div>
          <p className="trend-note">Each line uses the application’s current status and its applied date. Select a status above to show or hide it.</p>
        </div>
      </section>
    </div>

    <section className="card table-card"><div className="card-head"><div><h2>{selectedYear === "all" ? "Recent applications" : `${selectedYear} applications`}</h2><p className="sub">{selectedYear === "all" ? "Your latest additions." : `Applications recorded in ${selectedYear}.`}</p></div></div>{scopedApps.length ? <div className="recent-list">{scopedApps.slice(0,5).map(app => <div className="recent-item" key={app.id}><div><strong>{app.company}</strong><span>{app.role}</span></div><div><span className={`status-dot ${statusClass(app.status)}`}/>{app.status}<small>{formatStoredDate(app.appliedDate, dateLocale)}</small></div></div>)}</div> : <div className="empty">No applications were added in {scopeLabel}.</div>}</section>
  </section>;
}