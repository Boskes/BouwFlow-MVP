import { RotateCcw, ShieldCheck, UserRoundCog } from "lucide-react";
import type { CompanyUser } from "./domain";

const externalRoles = new Set(["Klant", "Onderaannemer", "Leverancier"]);

const roleLabel = (user: CompanyUser) => {
  if (user.role === "Klant") return "Klantportaal";
  if (user.role === "Onderaannemer") return "Onderaannemersportaal";
  if (user.role === "Leverancier") return "Leveranciersportaal";
  if (user.role === "Werfleider") return "Werfportaal · Werfleider";
  return user.role;
};

export default function ProfilePreviewBar({
  users,
  value,
  administratorName,
  busy,
  onChange,
}: {
  users: CompanyUser[];
  value?: string;
  administratorName: string;
  busy?: boolean;
  onChange: (userId?: string) => void;
}) {
  const selected = users.find((user) => user.id === value);
  const internalUsers = users.filter((user) => !externalRoles.has(user.role));
  const portalUsers = users.filter((user) => externalRoles.has(user.role));

  return <section className={`profile-preview-bar${selected ? " active" : ""}`} aria-live="polite">
    <span className="profile-preview-icon">{busy ? <RotateCcw className="spin" size={18}/> : selected ? <UserRoundCog size={18}/> : <ShieldCheck size={18}/>}</span>
    <span className="profile-preview-copy">
      <small>Administrator · beveiligde testsessie</small>
      <strong>{selected ? `${selected.displayName} · ${roleLabel(selected)}` : `${administratorName} · Administrator`}</strong>
      <span>{selected ? "Acties en gegevensbereik worden door de API als deze demogebruiker afgedwongen." : "Kies een demogebruiker om de volledige flow met echte rolrechten te testen."}</span>
    </span>
    <label>
      <span>Test als gebruiker</span>
      <select aria-label="Demogebruiker kiezen" value={value ?? ""} disabled={busy} onChange={(event) => onChange(event.target.value || undefined)}>
        <option value="">Administrator</option>
        <optgroup label="Interne profielen">
          {internalUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName} · {roleLabel(user)}</option>)}
        </optgroup>
        <optgroup label="Externe portalen">
          {portalUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName} · {roleLabel(user)}</option>)}
        </optgroup>
      </select>
    </label>
    {selected && <button type="button" className="secondary" disabled={busy} onClick={() => onChange(undefined)}><ShieldCheck size={15}/>Terug als administrator</button>}
  </section>;
}
