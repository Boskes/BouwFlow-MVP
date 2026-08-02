import type { Pool } from 'pg'

export const initialMigration = `
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  data_revision bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS data_revision bigint NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS users (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  entra_object_id text,
  display_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, entra_object_id)
);

CREATE TABLE IF NOT EXISTS organizations (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('Overheid', 'Privaat', 'Nutsbedrijf')),
  contact_name text NOT NULL,
  email text NOT NULL,
  vat_number text NOT NULL DEFAULT '',
  address_line text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  country_code text NOT NULL DEFAULT 'BE',
  peppol_endpoint_id text NOT NULL DEFAULT '',
  peppol_scheme_id text NOT NULL DEFAULT '0208',
  roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  activities jsonb NOT NULL DEFAULT '[]'::jsonb,
  relations jsonb NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (tenant_id, id)
);

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS vat_number text NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address_line text NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS postal_code text NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'BE';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS peppol_endpoint_id text NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS peppol_scheme_id text NOT NULL DEFAULT '0208';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS roles jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contacts jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS addresses jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS activities jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS relations jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS opportunities (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  project_number text NOT NULL,
  title text NOT NULL,
  organization_id uuid NOT NULL,
  location text NOT NULL,
  deadline date NOT NULL,
  estimated_value numeric(15,2) NOT NULL CHECK (estimated_value >= 0),
  probability integer NOT NULL CHECK (probability BETWEEN 0 AND 100),
  stage text NOT NULL,
  recognition text NOT NULL DEFAULT '',
  go_no_go jsonb,
  tender jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, project_number),
  FOREIGN KEY (tenant_id, organization_id) REFERENCES organizations(tenant_id, id)
);

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS go_no_go jsonb;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS tender jsonb;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS legal_entity_id uuid;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS branch_id uuid;

CREATE TABLE IF NOT EXISTS calculations (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  number text NOT NULL,
  opportunity_id uuid NOT NULL,
  status text NOT NULL,
  overhead_pct numeric(6,2) NOT NULL DEFAULT 0,
  risk_pct numeric(6,2) NOT NULL DEFAULT 0,
  margin_pct numeric(6,2) NOT NULL DEFAULT 0 CHECK (margin_pct >= 0 AND margin_pct < 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, number),
  UNIQUE (tenant_id, opportunity_id),
  FOREIGN KEY (tenant_id, opportunity_id) REFERENCES opportunities(tenant_id, id)
);

ALTER TABLE calculations ADD COLUMN IF NOT EXISTS site_overhead_pct numeric(6,2) NOT NULL DEFAULT 0;
ALTER TABLE calculations ADD COLUMN IF NOT EXISTS escalation_pct numeric(6,2) NOT NULL DEFAULT 0;
ALTER TABLE calculations ADD COLUMN IF NOT EXISTS discount_pct numeric(6,2) NOT NULL DEFAULT 0;
ALTER TABLE calculations ADD COLUMN IF NOT EXISTS rounding_step numeric(15,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS boq_chapters (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  calculation_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, calculation_id, code),
  FOREIGN KEY (tenant_id, calculation_id) REFERENCES calculations(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cost_library_items (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  library_version_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('labor', 'material', 'equipment', 'subcontracting')),
  unit text NOT NULL,
  unit_cost numeric(15,4) NOT NULL CHECK (unit_cost >= 0),
  source text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, library_version_id, code)
);

CREATE TABLE IF NOT EXISTS cost_libraries (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  legal_entity_id uuid,
  branch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, name)
);

ALTER TABLE cost_libraries ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE cost_libraries ADD COLUMN IF NOT EXISTS legal_entity_id uuid;
ALTER TABLE cost_libraries ADD COLUMN IF NOT EXISTS branch_id uuid;

CREATE TABLE IF NOT EXISTS unit_definitions (
  tenant_id uuid NOT NULL REFERENCES tenants(id), id uuid NOT NULL, code text NOT NULL, name text NOT NULL,
  category text NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,code)
);
CREATE TABLE IF NOT EXISTS unit_conversions (
  tenant_id uuid NOT NULL, id uuid NOT NULL, from_unit_id uuid NOT NULL, to_unit_id uuid NOT NULL,
  factor numeric(18,8) NOT NULL CHECK (factor > 0), created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,from_unit_id,to_unit_id),
  FOREIGN KEY (tenant_id,from_unit_id) REFERENCES unit_definitions(tenant_id,id),
  FOREIGN KEY (tenant_id,to_unit_id) REFERENCES unit_definitions(tenant_id,id)
);

INSERT INTO unit_definitions (tenant_id,id,code,name,category) SELECT id,'00000000-0000-4000-8000-000000000201','st','Stuk','Aantal' FROM tenants ON CONFLICT (tenant_id,id) DO NOTHING;
INSERT INTO unit_definitions (tenant_id,id,code,name,category) SELECT id,'00000000-0000-4000-8000-000000000202','GP','Globale prijs','Globaal' FROM tenants ON CONFLICT (tenant_id,id) DO NOTHING;
INSERT INTO unit_definitions (tenant_id,id,code,name,category) SELECT id,'00000000-0000-4000-8000-000000000203','m','Meter','Lengte' FROM tenants ON CONFLICT (tenant_id,id) DO NOTHING;
INSERT INTO unit_definitions (tenant_id,id,code,name,category) SELECT id,'00000000-0000-4000-8000-000000000204','km','Kilometer','Lengte' FROM tenants ON CONFLICT (tenant_id,id) DO NOTHING;
INSERT INTO unit_definitions (tenant_id,id,code,name,category) SELECT id,'00000000-0000-4000-8000-000000000205','m²','Vierkante meter','Oppervlakte' FROM tenants ON CONFLICT (tenant_id,id) DO NOTHING;
INSERT INTO unit_definitions (tenant_id,id,code,name,category) SELECT id,'00000000-0000-4000-8000-000000000206','m³','Kubieke meter','Volume' FROM tenants ON CONFLICT (tenant_id,id) DO NOTHING;
INSERT INTO unit_definitions (tenant_id,id,code,name,category) SELECT id,'00000000-0000-4000-8000-000000000207','kg','Kilogram','Massa' FROM tenants ON CONFLICT (tenant_id,id) DO NOTHING;
INSERT INTO unit_definitions (tenant_id,id,code,name,category) SELECT id,'00000000-0000-4000-8000-000000000208','ton','Ton','Massa' FROM tenants ON CONFLICT (tenant_id,id) DO NOTHING;
INSERT INTO unit_definitions (tenant_id,id,code,name,category) SELECT id,'00000000-0000-4000-8000-000000000209','uur','Uur','Tijd' FROM tenants ON CONFLICT (tenant_id,id) DO NOTHING;
INSERT INTO unit_definitions (tenant_id,id,code,name,category) SELECT id,'00000000-0000-4000-8000-000000000210','dag','Werkdag','Tijd' FROM tenants ON CONFLICT (tenant_id,id) DO NOTHING;
INSERT INTO unit_conversions (tenant_id,id,from_unit_id,to_unit_id,factor) SELECT id,'00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000204','00000000-0000-4000-8000-000000000203',1000 FROM tenants ON CONFLICT (tenant_id,id) DO NOTHING;
INSERT INTO unit_conversions (tenant_id,id,from_unit_id,to_unit_id,factor) SELECT id,'00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000208','00000000-0000-4000-8000-000000000207',1000 FROM tenants ON CONFLICT (tenant_id,id) DO NOTHING;
INSERT INTO unit_conversions (tenant_id,id,from_unit_id,to_unit_id,factor) SELECT id,'00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000210','00000000-0000-4000-8000-000000000209',8 FROM tenants ON CONFLICT (tenant_id,id) DO NOTHING;

CREATE TABLE IF NOT EXISTS cost_library_versions (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  library_id uuid NOT NULL,
  version integer NOT NULL,
  label text NOT NULL,
  status text NOT NULL CHECK (status IN ('Concept','Gepubliceerd','Gearchiveerd')),
  effective_from date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, library_id, version),
  FOREIGN KEY (tenant_id, library_id) REFERENCES cost_libraries(tenant_id, id) ON DELETE CASCADE
);

ALTER TABLE cost_library_items DROP CONSTRAINT IF EXISTS cost_library_items_tenant_id_code_key;
ALTER TABLE cost_library_items ADD COLUMN IF NOT EXISTS library_version_id uuid;

INSERT INTO cost_libraries (tenant_id,id,name,description)
SELECT id,'00000000-0000-4000-8000-000000000101','Centrale kostendatabank','Gevalideerde normen, leveranciersprijzen en historische kostprijzen.' FROM tenants
ON CONFLICT (tenant_id,id) DO NOTHING;

INSERT INTO cost_library_versions (tenant_id,id,library_id,version,label,status,effective_from)
SELECT id,'00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000101',1,'Basisprijzen','Gepubliceerd',CAST('2026-01-01' AS date) FROM tenants
ON CONFLICT (tenant_id,id) DO NOTHING;

UPDATE cost_library_items SET library_version_id='00000000-0000-4000-8000-000000000102' WHERE library_version_id IS NULL;

CREATE TABLE IF NOT EXISTS boq_items (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  calculation_id uuid NOT NULL,
  chapter_id uuid,
  code text NOT NULL,
  description text NOT NULL,
  quantity numeric(15,3) NOT NULL CHECK (quantity >= 0),
  unit text NOT NULL,
  labor numeric(15,4) NOT NULL DEFAULT 0,
  material numeric(15,4) NOT NULL DEFAULT 0,
  equipment numeric(15,4) NOT NULL DEFAULT 0,
  subcontracting numeric(15,4) NOT NULL DEFAULT 0,
  cost_applications jsonb NOT NULL DEFAULT '{}',
  advanced jsonb NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, calculation_id) REFERENCES calculations(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, chapter_id) REFERENCES boq_chapters(tenant_id, id)
);

-- Houd ook databases uit eerdere BouwFlow-versies vooruit compatibel.
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS chapter_id uuid;
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS cost_applications jsonb NOT NULL DEFAULT '{}';
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS advanced jsonb NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS calculation_versions (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  calculation_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  label text NOT NULL,
  reason text NOT NULL DEFAULT '',
  snapshot jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, calculation_id, version),
  FOREIGN KEY (tenant_id, calculation_id) REFERENCES calculations(tenant_id, id),
  FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS calculation_scenarios (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  calculation_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  labor_adjustment_pct numeric(7,2) NOT NULL DEFAULT 0,
  material_adjustment_pct numeric(7,2) NOT NULL DEFAULT 0,
  equipment_adjustment_pct numeric(7,2) NOT NULL DEFAULT 0,
  subcontracting_adjustment_pct numeric(7,2) NOT NULL DEFAULT 0,
  overhead_pct numeric(6,2) NOT NULL DEFAULT 0,
  risk_pct numeric(6,2) NOT NULL DEFAULT 0,
  margin_pct numeric(6,2) NOT NULL DEFAULT 0 CHECK (margin_pct >= 0 AND margin_pct < 100),
  is_selected boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, calculation_id, name),
  FOREIGN KEY (tenant_id, calculation_id) REFERENCES calculations(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quotes (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  number text NOT NULL,
  calculation_id uuid NOT NULL,
  scenario_id uuid,
  version integer NOT NULL CHECK (version > 0),
  total numeric(15,2) NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  snapshot jsonb NOT NULL DEFAULT '{}',
  workflow jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, number),
  UNIQUE (tenant_id, calculation_id, version),
  FOREIGN KEY (tenant_id, calculation_id) REFERENCES calculations(tenant_id, id),
  FOREIGN KEY (tenant_id, scenario_id) REFERENCES calculation_scenarios(tenant_id, id)
);

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS scenario_id uuid;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS content jsonb NOT NULL DEFAULT '{}';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS snapshot jsonb NOT NULL DEFAULT '{}';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS workflow jsonb;

CREATE TABLE IF NOT EXISTS legal_entities (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  name text NOT NULL,
  vat_number text NOT NULL,
  country text NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  active boolean NOT NULL DEFAULT true,
  invoice_prefix text NOT NULL DEFAULT 'VF',
  next_invoice_number integer NOT NULL DEFAULT 1,
  default_vat_pct numeric(7,4) NOT NULL DEFAULT 21,
  iban text NOT NULL DEFAULT '',
  bic text NOT NULL DEFAULT '',
  payment_terms_days integer NOT NULL DEFAULT 30,
  address_line text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  country_code text NOT NULL DEFAULT 'BE',
  peppol_endpoint_id text NOT NULL DEFAULT '',
  peppol_scheme_id text NOT NULL DEFAULT '0208',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, vat_number)
);

ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS invoice_prefix text NOT NULL DEFAULT 'VF';
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS next_invoice_number integer NOT NULL DEFAULT 1;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS default_vat_pct numeric(7,4) NOT NULL DEFAULT 21;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS iban text NOT NULL DEFAULT '';
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS bic text NOT NULL DEFAULT '';
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS payment_terms_days integer NOT NULL DEFAULT 30;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS address_line text NOT NULL DEFAULT '';
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS postal_code text NOT NULL DEFAULT '';
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '';
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'BE';
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS peppol_endpoint_id text NOT NULL DEFAULT '';
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS peppol_scheme_id text NOT NULL DEFAULT '0208';

ALTER TABLE users ADD COLUMN IF NOT EXISTS all_legal_entities boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Actief';
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subcontractor_id uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS supplier_id uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS all_projects boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS user_legal_entity_access (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id, legal_entity_id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS company_branches (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  country text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, legal_entity_id, name),
  FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS projects (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  number text NOT NULL,
  name text NOT NULL,
  organization_id uuid NOT NULL,
  legal_entity_id uuid,
  branch_id uuid,
  source_calculation_id uuid NOT NULL,
  contract_value numeric(15,2) NOT NULL,
  cost_budget numeric(15,2) NOT NULL,
  margin_pct numeric(6,2) NOT NULL,
  progress numeric(6,2) NOT NULL DEFAULT 0,
  status text NOT NULL,
  handover jsonb NOT NULL DEFAULT '{}',
  work_packages jsonb NOT NULL DEFAULT '[]',
  planning jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, number),
  UNIQUE (tenant_id, source_calculation_id),
  FOREIGN KEY (tenant_id, organization_id) REFERENCES organizations(tenant_id, id),
  FOREIGN KEY (tenant_id, source_calculation_id) REFERENCES calculations(tenant_id, id),
  FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities(tenant_id, id),
  FOREIGN KEY (tenant_id, branch_id) REFERENCES company_branches(tenant_id, id)
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS handover jsonb NOT NULL DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS work_packages jsonb NOT NULL DEFAULT '[]';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS planning jsonb NOT NULL DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS legal_entity_id uuid;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS branch_id uuid;

CREATE TABLE IF NOT EXISTS daily_reports (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  project_id uuid NOT NULL,
  report_date date NOT NULL,
  work_package_id uuid,
  weather text NOT NULL,
  temperature numeric(5,2) NOT NULL,
  activities text NOT NULL DEFAULT '',
  labor_entries jsonb NOT NULL DEFAULT '[]',
  subcontractors jsonb NOT NULL DEFAULT '[]',
  materials jsonb NOT NULL DEFAULT '[]',
  machines jsonb NOT NULL DEFAULT '[]',
  deliveries text NOT NULL DEFAULT '',
  delays text NOT NULL DEFAULT '',
  problems text NOT NULL DEFAULT '',
  visitors text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Concept',
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  signed_by text,
  signed_at timestamptz,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, project_id, report_date),
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS site_photos (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  project_id uuid NOT NULL,
  daily_report_id uuid NOT NULL,
  work_package_id uuid,
  storage_key text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  caption text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  taken_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, storage_key),
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id),
  FOREIGN KEY (tenant_id, daily_report_id) REFERENCES daily_reports(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS documents (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  project_id uuid NOT NULL,
  legal_entity_id uuid,
  sales_invoice_id uuid,
  peppol_acceptance_run_id uuid,
  title text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'Concept',
  immutable boolean NOT NULL DEFAULT false,
  current_version_id uuid NOT NULL,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id)
);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS legal_entity_id uuid;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sales_invoice_id uuid;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS peppol_acceptance_run_id uuid;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS immutable boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS document_versions (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  document_id uuid NOT NULL,
  revision integer NOT NULL,
  revision_label text NOT NULL,
  storage_key text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  content_digest text,
  notes text NOT NULL DEFAULT '',
  uploaded_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, document_id, revision),
  UNIQUE (tenant_id, storage_key),
  FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, id)
);

ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS content_digest text;

CREATE TABLE IF NOT EXISTS document_recipients (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  document_id uuid NOT NULL,
  version_id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, version_id, email),
  FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, id),
  FOREIGN KEY (tenant_id, version_id) REFERENCES document_versions(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS document_record_links (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  document_id uuid NOT NULL,
  link_type text NOT NULL,
  record_id text NOT NULL,
  label text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, document_id, link_type, record_id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS qhse_certificates (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  project_id uuid NOT NULL,
  holder_type text NOT NULL,
  holder_id uuid,
  holder_name text NOT NULL,
  certificate_type text NOT NULL,
  certificate_number text NOT NULL,
  issued_on date,
  expires_on date NOT NULL,
  document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, project_id, certificate_number),
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, id)
);

ALTER TABLE qhse_certificates ADD COLUMN IF NOT EXISTS holder_id uuid;

CREATE TABLE IF NOT EXISTS qhse_inspections (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  project_id uuid NOT NULL,
  inspection_date date NOT NULL,
  inspection_type text NOT NULL,
  inspector text NOT NULL,
  location text NOT NULL,
  notes text NOT NULL DEFAULT '',
  findings jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'Open',
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS change_orders (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  number text NOT NULL,
  project_id uuid NOT NULL,
  daily_report_id uuid,
  work_package_id uuid,
  change_date date NOT NULL,
  cause text NOT NULL,
  description text NOT NULL,
  initiator text NOT NULL,
  responsible_party text NOT NULL,
  schedule_impact_days integer NOT NULL DEFAULT 0,
  costs jsonb NOT NULL DEFAULT '{}',
  total numeric(16,2) NOT NULL DEFAULT 0,
  photo_ids jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'Vastgesteld',
  created_at timestamptz NOT NULL DEFAULT now(),
  calculated_at timestamptz,
  submitted_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  executed_at timestamptz,
  ready_for_invoice_at timestamptz,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, number),
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id),
  FOREIGN KEY (tenant_id, daily_report_id) REFERENCES daily_reports(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS progress_statements (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  number text NOT NULL,
  project_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  lines jsonb NOT NULL DEFAULT '[]',
  change_order_ids jsonb NOT NULL DEFAULT '[]',
  work_amount numeric(16,2) NOT NULL DEFAULT 0,
  change_order_amount numeric(16,2) NOT NULL DEFAULT 0,
  price_revision_amount numeric(16,2) NOT NULL DEFAULT 0,
  gross_amount numeric(16,2) NOT NULL DEFAULT 0,
  retention_pct numeric(7,4) NOT NULL DEFAULT 0,
  retention_amount numeric(16,2) NOT NULL DEFAULT 0,
  net_amount numeric(16,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Concept',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  invoice_id uuid,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, number),
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id)
);

ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS progress_statement_id uuid;

CREATE TABLE IF NOT EXISTS sales_invoices (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  number text NOT NULL,
  legal_entity_id uuid,
  project_id uuid NOT NULL,
  progress_statement_id uuid NOT NULL,
  invoice_date date NOT NULL,
  due_date date NOT NULL,
  subtotal numeric(16,2) NOT NULL,
  vat_pct numeric(7,4) NOT NULL,
  vat_amount numeric(16,2) NOT NULL,
  total numeric(16,2) NOT NULL,
  status text NOT NULL DEFAULT 'Concept',
  issued_at timestamptz,
  issued_by text,
  paid_at date,
  paid_amount numeric(16,2),
  payment_reference text,
  lines jsonb NOT NULL DEFAULT '[]',
  receipts jsonb NOT NULL DEFAULT '[]',
  match_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, number),
  UNIQUE (tenant_id, progress_statement_id),
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id),
  FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities(tenant_id, id),
  FOREIGN KEY (tenant_id, progress_statement_id) REFERENCES progress_statements(tenant_id, id)
);

ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS issued_at timestamptz;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS issued_by text;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS paid_at date;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS paid_amount numeric(16,2);
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS legal_entity_id uuid;

CREATE TABLE IF NOT EXISTS peppol_validation_reports (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('Geslaagd', 'Afgekeurd', 'Fout')),
  source text NOT NULL CHECK (source IN ('Preflight', 'Extern')),
  engine text NOT NULL,
  profile text NOT NULL,
  network_ready boolean NOT NULL DEFAULT false,
  document_digest text NOT NULL DEFAULT '',
  issues jsonb NOT NULL DEFAULT '[]',
  validated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, invoice_id) REFERENCES sales_invoices(tenant_id, id) ON DELETE CASCADE
);

ALTER TABLE peppol_validation_reports ADD COLUMN IF NOT EXISTS document_digest text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS peppol_deliveries (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  validation_report_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('In wachtrij', 'Geaccepteerd', 'Afgeleverd', 'Geweigerd', 'Fout')),
  provider text NOT NULL,
  provider_reference text,
  idempotency_key text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  message text NOT NULL DEFAULT '',
  events jsonb NOT NULL DEFAULT '[]',
  requested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, invoice_id) REFERENCES sales_invoices(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, validation_report_id) REFERENCES peppol_validation_reports(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS peppol_acceptance_runs (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('In uitvoering', 'In opvolging', 'Geslaagd', 'Mislukt')),
  document_digest text NOT NULL,
  validation_report_id uuid,
  delivery_id uuid,
  steps jsonb NOT NULL DEFAULT '[]',
  started_by uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  released_by text,
  released_at timestamptz,
  release_notes text,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, invoice_id) REFERENCES sales_invoices(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, validation_report_id) REFERENCES peppol_validation_reports(tenant_id, id),
  FOREIGN KEY (tenant_id, delivery_id) REFERENCES peppol_deliveries(tenant_id, id),
  FOREIGN KEY (tenant_id, started_by) REFERENCES users(tenant_id, id)
);

ALTER TABLE peppol_acceptance_runs ADD COLUMN IF NOT EXISTS released_by text;
ALTER TABLE peppol_acceptance_runs ADD COLUMN IF NOT EXISTS released_at timestamptz;
ALTER TABLE peppol_acceptance_runs ADD COLUMN IF NOT EXISTS release_notes text;

CREATE TABLE IF NOT EXISTS peppol_alerts (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  delivery_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('Verzending mislukt', 'Geweigerd', 'Geen statusupdate')),
  severity text NOT NULL CHECK (severity IN ('Hoog', 'Kritiek')),
  status text NOT NULL CHECK (status IN ('Open', 'In behandeling', 'Opgelost')),
  message text NOT NULL,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, delivery_id, type),
  FOREIGN KEY (tenant_id, delivery_id) REFERENCES peppol_deliveries(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, invoice_id) REFERENCES sales_invoices(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, acknowledged_by) REFERENCES users(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS peppol_notification_outbox (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  alert_id uuid NOT NULL,
  event_key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('E-mail', 'Teams')),
  kind text NOT NULL CHECK (kind IN ('Nieuwe waarschuwing', 'SLA-escalatie', 'Testmelding')),
  destination text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL CHECK (status IN ('In wachtrij', 'Verzonden', 'Mislukt', 'Geannuleerd')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, event_key),
  FOREIGN KEY (tenant_id, alert_id) REFERENCES peppol_alerts(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS peppol_notification_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  email_recipients jsonb NOT NULL DEFAULT '[]',
  teams_targets jsonb NOT NULL DEFAULT '[]',
  critical_sla_minutes integer NOT NULL DEFAULT 15 CHECK (critical_sla_minutes BETWEEN 1 AND 1440),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intercompany_charges (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  number text NOT NULL,
  from_legal_entity_id uuid NOT NULL,
  to_legal_entity_id uuid NOT NULL,
  project_id uuid,
  description text NOT NULL,
  base_amount numeric(16,2) NOT NULL,
  markup_pct numeric(7,4) NOT NULL DEFAULT 0,
  total_amount numeric(16,2) NOT NULL,
  status text NOT NULL DEFAULT 'Concept',
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  posted_at timestamptz,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, number),
  FOREIGN KEY (tenant_id, from_legal_entity_id) REFERENCES legal_entities(tenant_id, id),
  FOREIGN KEY (tenant_id, to_legal_entity_id) REFERENCES legal_entities(tenant_id, id),
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS project_costs (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  project_id uuid NOT NULL,
  work_package_id uuid,
  cost_date date NOT NULL,
  type text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  supplier text NOT NULL DEFAULT '',
  amount numeric(16,2) NOT NULL,
  reference text NOT NULL DEFAULT '',
  recognition text NOT NULL DEFAULT 'Boeking',
  source_document_id uuid,
  status text NOT NULL,
  source_commitment_id uuid,
  settled_by_entry_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id),
  FOREIGN KEY (tenant_id, source_commitment_id) REFERENCES project_costs(tenant_id, id),
  FOREIGN KEY (tenant_id, settled_by_entry_id) REFERENCES project_costs(tenant_id, id)
);

ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS recognition text NOT NULL DEFAULT 'Boeking';
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS source_document_id uuid;

CREATE TABLE IF NOT EXISTS project_forecasts (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  project_id uuid NOT NULL,
  version integer NOT NULL,
  lines jsonb NOT NULL DEFAULT '[]',
  actual_costs numeric(16,2) NOT NULL,
  open_commitments numeric(16,2) NOT NULL,
  remaining_cost numeric(16,2) NOT NULL,
  estimate_at_completion numeric(16,2) NOT NULL,
  expected_revenue numeric(16,2) NOT NULL,
  expected_margin numeric(16,2) NOT NULL,
  expected_margin_pct numeric(9,4) NOT NULL,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Concept',
  created_by text NOT NULL DEFAULT '',
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, project_id, version),
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id)
);

ALTER TABLE project_forecasts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Concept';
ALTER TABLE project_forecasts ADD COLUMN IF NOT EXISTS created_by text NOT NULL DEFAULT '';
ALTER TABLE project_forecasts ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE project_forecasts ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE TABLE IF NOT EXISTS suppliers (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  organization_id uuid,
  name text NOT NULL,
  vat_number text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  payment_terms text NOT NULL DEFAULT '',
  rating numeric(4,2) NOT NULL DEFAULT 0,
  framework_agreements jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, name),
  FOREIGN KEY (tenant_id, organization_id) REFERENCES organizations(tenant_id, id)
);

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS framework_agreements jsonb NOT NULL DEFAULT '[]';
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_tenant_organization_unique ON suppliers(tenant_id, organization_id) WHERE organization_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS procurement_requests (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  number text NOT NULL,
  project_id uuid NOT NULL,
  work_package_id uuid,
  invited_supplier_ids jsonb NOT NULL DEFAULT '[]',
  category text NOT NULL DEFAULT 'material',
  requested_by text NOT NULL,
  needed_by date NOT NULL,
  description text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'Behoefte',
  quotes jsonb NOT NULL DEFAULT '[]',
  selected_quote_id uuid,
  purchase_order_id uuid,
  approval jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, number),
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id)
);

ALTER TABLE procurement_requests ADD COLUMN IF NOT EXISTS invited_supplier_ids jsonb NOT NULL DEFAULT '[]';
ALTER TABLE procurement_requests ADD COLUMN IF NOT EXISTS approval jsonb;

CREATE TABLE IF NOT EXISTS purchase_orders (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  number text NOT NULL,
  procurement_request_id uuid NOT NULL,
  project_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  framework_agreement_id uuid,
  order_date date NOT NULL,
  expected_delivery_date date NOT NULL,
  amount numeric(16,2) NOT NULL,
  status text NOT NULL DEFAULT 'Besteld',
  commitment_cost_id uuid NOT NULL,
  received_at date,
  delivery_reference text,
  received_by text,
  receipt_notes text,
  invoice_number text,
  invoice_date date,
  invoice_due_date date,
  invoice_amount numeric(16,2),
  actual_cost_id uuid,
  paid_at date,
  paid_amount numeric(16,2),
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, number),
  UNIQUE (tenant_id, procurement_request_id),
  FOREIGN KEY (tenant_id, procurement_request_id) REFERENCES procurement_requests(tenant_id, id),
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES suppliers(tenant_id, id),
  FOREIGN KEY (tenant_id, commitment_cost_id) REFERENCES project_costs(tenant_id, id),
  FOREIGN KEY (tenant_id, actual_cost_id) REFERENCES project_costs(tenant_id, id)
);

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS invoice_due_date date;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS framework_agreement_id uuid;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS paid_at date;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS paid_amount numeric(16,2);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS lines jsonb NOT NULL DEFAULT '[]';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS receipts jsonb NOT NULL DEFAULT '[]';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS match_result jsonb;

CREATE TABLE IF NOT EXISTS audit_log (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS user_preferences (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL,
  preference_key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id, preference_key),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS mailbox_messages (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  provider_message_id text NOT NULL,
  internet_message_id text,
  conversation_id text,
  correlation_key text,
  direction text NOT NULL CHECK (direction IN ('Inkomend','Uitgaand')),
  from_name text NOT NULL DEFAULT '',
  from_address text NOT NULL DEFAULT '',
  to_recipients jsonb NOT NULL DEFAULT '[]',
  cc_recipients jsonb NOT NULL DEFAULT '[]',
  subject text NOT NULL,
  body_preview text NOT NULL DEFAULT '',
  received_at timestamptz,
  sent_at timestamptz,
  is_read boolean NOT NULL DEFAULT false,
  has_attachments boolean NOT NULL DEFAULT false,
  web_link text,
  organization_id uuid,
  opportunity_id uuid,
  project_id uuid,
  synchronized_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,provider_message_id),
  FOREIGN KEY (tenant_id,organization_id) REFERENCES organizations(tenant_id,id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id,opportunity_id) REFERENCES opportunities(tenant_id,id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id,project_id) REFERENCES projects(tenant_id,id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mailbox_correlation ON mailbox_messages(tenant_id,correlation_key) WHERE correlation_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mailbox_tenant_date ON mailbox_messages(tenant_id,COALESCE(received_at,sent_at) DESC);

CREATE TABLE IF NOT EXISTS mailbox_sync_state (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  mailbox text NOT NULL,
  last_synchronized_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_stage ON opportunities(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_calculations_tenant_opportunity ON calculations(tenant_id, opportunity_id);
CREATE INDEX IF NOT EXISTS idx_boq_items_tenant_calculation ON boq_items(tenant_id, calculation_id);
CREATE INDEX IF NOT EXISTS idx_boq_items_tenant_chapter ON boq_items(tenant_id, chapter_id);
CREATE INDEX IF NOT EXISTS idx_boq_chapters_tenant_calculation ON boq_chapters(tenant_id, calculation_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cost_library_tenant_category ON cost_library_items(tenant_id, category, code);
CREATE INDEX IF NOT EXISTS idx_calculation_versions_tenant_calculation ON calculation_versions(tenant_id, calculation_id, version);
CREATE INDEX IF NOT EXISTS idx_daily_reports_tenant_project_date ON daily_reports(tenant_id, project_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_site_photos_tenant_report ON site_photos(tenant_id, daily_report_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_project ON documents(tenant_id, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_entities_tenant_active ON legal_entities(tenant_id, active, name);
CREATE INDEX IF NOT EXISTS idx_company_branches_tenant_entity ON company_branches(tenant_id, legal_entity_id, name);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_entity ON projects(tenant_id, legal_entity_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_user_entity_access_user ON user_legal_entity_access(tenant_id, user_id, legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_tenant_document ON document_versions(tenant_id, document_id, revision DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_peppol_acceptance_run ON documents(tenant_id, peppol_acceptance_run_id) WHERE peppol_acceptance_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_recipients_tenant_version ON document_recipients(tenant_id, version_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_qhse_certificates_tenant_project_expiry ON qhse_certificates(tenant_id, project_id, expires_on);
CREATE INDEX IF NOT EXISTS idx_qhse_inspections_tenant_project_date ON qhse_inspections(tenant_id, project_id, inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_change_orders_tenant_project ON change_orders(tenant_id, project_id, change_date DESC);
CREATE INDEX IF NOT EXISTS idx_progress_statements_tenant_project ON progress_statements(tenant_id, project_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_tenant_project ON sales_invoices(tenant_id, project_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_peppol_validation_invoice ON peppol_validation_reports(tenant_id, invoice_id, validated_at DESC);
CREATE INDEX IF NOT EXISTS idx_peppol_delivery_invoice ON peppol_deliveries(tenant_id, invoice_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_peppol_acceptance_invoice ON peppol_acceptance_runs(tenant_id, invoice_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_peppol_alert_status ON peppol_alerts(tenant_id, status, severity, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_peppol_notification_due ON peppol_notification_outbox(status, next_attempt_at, attempts);
CREATE INDEX IF NOT EXISTS idx_intercompany_tenant_entities ON intercompany_charges(tenant_id, from_legal_entity_id, to_legal_entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_costs_tenant_project ON project_costs(tenant_id, project_id, cost_date DESC);
CREATE INDEX IF NOT EXISTS idx_project_forecasts_tenant_project ON project_forecasts(tenant_id, project_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_name ON suppliers(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_procurement_requests_tenant_project ON procurement_requests(tenant_id, project_id, needed_by);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_project ON purchase_orders(tenant_id, project_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_calculation_scenarios_tenant_calculation ON calculation_scenarios(tenant_id, calculation_id, is_selected);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_entity ON audit_log(tenant_id, entity_type, entity_id, created_at);

CREATE TABLE IF NOT EXISTS api_idempotency (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  idempotency_key uuid NOT NULL,
  method text NOT NULL,
  route text NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'completed')),
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_api_idempotency_created ON api_idempotency(created_at);

CREATE TABLE IF NOT EXISTS operations_state (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id),
  assets jsonb NOT NULL DEFAULT '[]',
  warehouses jsonb NOT NULL DEFAULT '[]',
  inventory_items jsonb NOT NULL DEFAULT '[]',
  stock_movements jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blueprint_state (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id),
  subcontractors jsonb NOT NULL DEFAULT '[]',
  qhse_events jsonb NOT NULL DEFAULT '[]',
  joint_ventures jsonb NOT NULL DEFAULT '[]',
  integration_connections jsonb NOT NULL DEFAULT '[]',
  integration_jobs jsonb NOT NULL DEFAULT '[]',
  ai_analyses jsonb NOT NULL DEFAULT '[]',
  project_contracts jsonb NOT NULL DEFAULT '[]',
  project_closeouts jsonb NOT NULL DEFAULT '[]',
  employees jsonb NOT NULL DEFAULT '[]',
  employee_absences jsonb NOT NULL DEFAULT '[]',
  employee_crews jsonb NOT NULL DEFAULT '[]',
  work_tickets jsonb NOT NULL DEFAULT '[]',
  time_entries jsonb NOT NULL DEFAULT '[]',
  project_claims jsonb NOT NULL DEFAULT '[]',
  workflow_definitions jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE blueprint_state ADD COLUMN IF NOT EXISTS employees jsonb NOT NULL DEFAULT '[]';
ALTER TABLE blueprint_state ADD COLUMN IF NOT EXISTS employee_absences jsonb NOT NULL DEFAULT '[]';
ALTER TABLE blueprint_state ADD COLUMN IF NOT EXISTS employee_crews jsonb NOT NULL DEFAULT '[]';
ALTER TABLE blueprint_state ADD COLUMN IF NOT EXISTS work_tickets jsonb NOT NULL DEFAULT '[]';
ALTER TABLE blueprint_state ADD COLUMN IF NOT EXISTS time_entries jsonb NOT NULL DEFAULT '[]';
ALTER TABLE blueprint_state ADD COLUMN IF NOT EXISTS project_claims jsonb NOT NULL DEFAULT '[]';
ALTER TABLE blueprint_state ADD COLUMN IF NOT EXISTS workflow_definitions jsonb NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS user_project_access (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,user_id,project_id),
  FOREIGN KEY (tenant_id,user_id) REFERENCES users(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,project_id) REFERENCES projects(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_project_access_user ON user_project_access(tenant_id,user_id,project_id);
`

export async function migrate(pool: Pick<Pool, 'connect'>) {
  const client = await pool.connect()
  await client.query('BEGIN')
  try {
    await client.query(initialMigration)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
