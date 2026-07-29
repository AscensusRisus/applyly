"use client";

import { FormEvent, useState } from "react";

export type ApplicationDetails = {
  id:number;
  company:string;
  role:string;
  location:string;
  status:string;
  appliedDate:string;
  salary?:string | null;
  url?:string | null;
  notes?:string | null;
  contactEmail?:string | null;
  source?:string | null;
  nextStep?:string | null;
  nextActionDate?:string | null;
};

type Props = {
  application: ApplicationDetails;
  onClose: () => void;
  onSaved: (application: ApplicationDetails) => void;
};

const value = (input:string | null | undefined) => input ?? "";
const toForm = (application: ApplicationDetails) => ({
  company: application.company,
  role: application.role,
  location: application.location,
  appliedDate: application.appliedDate,
  salary: value(application.salary),
  url: value(application.url),
  notes: value(application.notes),
  contactEmail: value(application.contactEmail),
  source: value(application.source),
  nextStep: value(application.nextStep),
  nextActionDate: value(application.nextActionDate),
});

export default function ApplicationDetailsModal({ application, onClose, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => toForm(application));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form.company.trim() || !form.role.trim()) { setError("Company and role are required."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/applications/${application.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({details: form}) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      onSaved(data.application);
      setEditing(false);
    } catch { setError("Changes could not be saved. Please try again."); }
    finally { setSaving(false); }
  }

  const metadata = [
    ["Applied", application.appliedDate],
    ["Location", application.location],
    ["Source", application.source],
    ["Salary", application.salary],
    ["Next step", application.nextStep],
    ["Next action", application.nextActionDate],
  ].filter(([, item]) => Boolean(item));

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="details-modal" role="dialog" aria-modal="true" aria-labelledby="details-title" onClick={event => event.stopPropagation()}>
      <div className="modal-head">
        <div><p className="eyebrow">APPLICATION DETAILS</p><h2 id="details-title">{application.company}</h2><p className="sub">{application.role}</p></div>
        <button className="modal-close" onClick={onClose} aria-label="Close">Close</button>
      </div>
      {!editing ? <div className="details-body">
        <div className="details-status"><span className={`status-dot ${application.status.toLowerCase().replaceAll(" ", "-")}`}/>{application.status}</div>
        <div className="details-grid">{metadata.map(([label, item]) => <div key={label}><span>{label}</span><strong>{label === "Applied" || label === "Next action" ? new Date(`${item}T12:00:00`).toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"}) : item}</strong></div>)}</div>
        {application.contactEmail && <a className="detail-link" href={`mailto:${application.contactEmail}`}>{application.contactEmail}</a>}
        {application.url && <a className="detail-link" href={application.url} target="_blank" rel="noreferrer">Open application link</a>}
        <section className="notes-panel"><div><p className="eyebrow">NOTES</p><p>{application.notes || "No notes yet."}</p></div><button className="row-action history-action" onClick={() => setEditing(true)}>{application.notes ? "Edit note" : "Add note"}</button></section>
        <button className="primary" onClick={() => setEditing(true)}>Edit details</button>
      </div> : <form className="details-form" onSubmit={save}>
        <div className="details-form-grid"><div className="field"><label htmlFor="detail-company">COMPANY</label><input id="detail-company" value={form.company} onChange={event => setForm({...form, company:event.target.value})}/></div><div className="field"><label htmlFor="detail-role">ROLE</label><input id="detail-role" value={form.role} onChange={event => setForm({...form, role:event.target.value})}/></div><div className="field"><label htmlFor="detail-location">LOCATION</label><input id="detail-location" value={form.location} onChange={event => setForm({...form, location:event.target.value})}/></div><div className="field"><label htmlFor="detail-date">APPLIED DATE</label><input id="detail-date" type="date" value={form.appliedDate} onChange={event => setForm({...form, appliedDate:event.target.value})}/></div><div className="field"><label htmlFor="detail-source">SOURCE</label><select id="detail-source" value={form.source} onChange={event => setForm({...form, source:event.target.value})}><option value="">Select source</option><option>Company website</option><option>LinkedIn</option><option>Email</option><option>Referral</option><option>Recruiter</option><option>Other</option></select></div><div className="field"><label htmlFor="detail-salary">SALARY</label><input id="detail-salary" value={form.salary} onChange={event => setForm({...form, salary:event.target.value})}/></div><div className="field"><label htmlFor="detail-email">CONTACT EMAIL</label><input id="detail-email" type="email" value={form.contactEmail} onChange={event => setForm({...form, contactEmail:event.target.value})}/></div><div className="field"><label htmlFor="detail-next-step">NEXT STEP</label><input id="detail-next-step" value={form.nextStep} onChange={event => setForm({...form, nextStep:event.target.value})}/></div><div className="field"><label htmlFor="detail-next-date">NEXT ACTION DATE</label><input id="detail-next-date" type="date" value={form.nextActionDate} onChange={event => setForm({...form, nextActionDate:event.target.value})}/></div><div className="field"><label htmlFor="detail-url">APPLICATION LINK</label><input id="detail-url" type="url" value={form.url} onChange={event => setForm({...form, url:event.target.value})}/></div></div>
        <div className="field"><div className="date-label"><label htmlFor="detail-notes">NOTES</label>{form.notes && <button type="button" className="today-button" onClick={() => setForm({...form, notes:""})}>Clear note</button>}</div><textarea id="detail-notes" value={form.notes} onChange={event => setForm({...form, notes:event.target.value})}/></div>
        {error && <p className="details-error">{error}</p>}
        <div className="details-actions"><button type="button" className="secondary-button" onClick={() => { setForm(toForm(application)); setEditing(false); }}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button></div>
      </form>}
    </section>
  </div>;
}
