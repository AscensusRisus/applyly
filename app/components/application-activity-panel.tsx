import { type ApplicationDetails } from "./application-details";
import { buildApplicationActivity } from "../lib/application-activity.mjs";

type ActivityApplication = Pick<ApplicationDetails, "appliedDate">;
type Activity = ReturnType<typeof buildApplicationActivity>;

function monthMarkers(weeks: Activity["weeks"]) {
  return weeks.reduce<{ index: number; label: string }[]>((markers, week, index) => {
    const label = new Date(`${week[0].date}T12:00:00`).toLocaleDateString(undefined, { month: "short" });
    if (!markers.length || markers[markers.length - 1].label !== label) markers.push({ index, label });
    return markers;
  }, []);
}

export default function ApplicationActivityPanel({ applications }: { applications: ActivityApplication[] }) {
  const activity = buildApplicationActivity(applications);
  const markers = monthMarkers(activity.weeks);
  const periodLabel = activity.total
    ? `${activity.total} application${activity.total === 1 ? "" : "s"} across ${activity.activeDays} active day${activity.activeDays === 1 ? "" : "s"}`
    : "No applications recorded in the last year";

  return <section className="card activity-card" aria-labelledby="activity-title">
    <div className="activity-head">
      <div><p className="eyebrow">APPLICATION RHYTHM</p><h2 id="activity-title">Your year in applications</h2><p className="sub">Each square is an applied date. More applications make the day brighter.</p></div>
      <div className="activity-summary"><strong>{activity.total}</strong><span>{periodLabel.replace(`${activity.total} `, "")}</span></div>
    </div>
    <div className="activity-scroll">
      <div className="activity-plot">
        <div className="activity-months" aria-hidden="true">{markers.map(marker => <span key={`${marker.label}-${marker.index}`} style={{ gridColumn: marker.index + 1 }}>{marker.label}</span>)}</div>
        <div className="activity-body">
          <div className="activity-weekdays" aria-hidden="true"><span/><span>Mon</span><span/><span>Wed</span><span/><span>Fri</span><span/></div>
          <div className="activity-grid" role="grid" aria-label="Applications by applied date">{activity.weeks.map((week, weekIndex) => <div className="activity-week" role="row" key={`week-${weekIndex}`}>{week.map(day => <span className={`activity-day level-${day.level}${day.isFuture ? " is-future" : ""}`} data-date={day.date} data-level={day.level} role="gridcell" aria-label={day.isFuture ? `${day.label}, outside the current period` : `${day.count} application${day.count === 1 ? "" : "s"} on ${day.label}`} title={day.isFuture ? undefined : `${day.count} application${day.count === 1 ? "" : "s"} · ${day.label}`} key={day.date}/>)}</div>)}</div>
        </div>
        <div className="activity-footer"><span>Less</span>{[0, 1, 2, 3, 4].map(level => <span className={`activity-legend level-${level}`} key={level}/>)}<span>More</span>{activity.busiest && <span className="activity-busiest">Busiest: {activity.busiest.label} · {activity.busiest.count}</span>}</div>
      </div>
    </div>
  </section>;
}
