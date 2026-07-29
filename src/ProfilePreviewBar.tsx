import { ShieldCheck } from "lucide-react";

export type ProfilePreviewRole = "Projectmanager" | "Calculator" | "Werfleider" | "Klant";

export default function ProfilePreviewBar({ value, onChange }: { value?: ProfilePreviewRole; onChange: (role?: ProfilePreviewRole) => void }) {
  return <section className={`profile-preview-bar${value ? " active" : ""}`} aria-live="polite">
    <span className="profile-preview-icon"><ShieldCheck size={18}/></span>
    <span className="profile-preview-copy"><small>Beheerder · profielvoorbeeld</small><strong>{value || "Administrator"}</strong><span>Alle acties zijn uitgeschakeld.</span></span>
    <label><span>Bekijk als</span><select aria-label="Profiel kiezen" value={value ?? ""} onChange={(event) => onChange(event.target.value as ProfilePreviewRole || undefined)}><option value="">Administrator</option><option value="Projectmanager">Projectleider</option><option value="Calculator">Calculator</option><option value="Werfleider">Werfleider</option><option value="Klant">Klantportaal</option></select></label>
    {value && <button type="button" className="secondary" onClick={() => onChange(undefined)}><ShieldCheck size={15}/>Beheerder</button>}
  </section>;
}
