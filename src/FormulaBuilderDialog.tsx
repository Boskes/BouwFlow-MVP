import { type FormEvent, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, GripVertical, Percent, Plus, Sigma, SlidersHorizontal, Trash2, X } from 'lucide-react'
import {
  boqFormulaFieldLabels,
  boqPriceBreakdown,
  createId,
  effectiveBoqValues,
  type BoqFormula,
  type BoqFormulaField,
  type BoqFormulaOperator,
  type BoqFormulaTarget,
  type BoqFormulaToken,
  type BoqItem,
  type BoqPostType,
} from './domain'

const number = (value: number) => new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 3 }).format(value)
const money = (value: number) => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(value)

interface FormulaBuilderDialogProps {
  item: BoqItem
  initialTarget: BoqFormulaTarget
  onApply: (patch: Pick<BoqItem, 'variables' | 'formulas'>) => void | Promise<unknown>
  onClose: () => void
}

interface BoqItemAdvancedDialogProps {
  item: BoqItem
  onSave: (patch: Partial<BoqItem>) => void | Promise<unknown>
  onFormula: (target: BoqFormulaTarget, item: BoqItem) => void
  onClose: () => void
}

export function BoqItemAdvancedDialog({ item, onSave, onFormula, onClose }: BoqItemAdvancedDialogProps) {
  const [tab, setTab] = useState<'Basis' | 'Variabelen & formules' | 'Markups & markdowns'>('Basis')
  const [form, setForm] = useState({
    postType: item.postType ?? 'Meetstaatpost' as BoqPostType,
    quantityType: item.quantityType ?? 'Vermoedelijk' as NonNullable<BoqItem['quantityType']>,
    wastePct: item.wastePct ?? 0,
    itemRiskPct: item.itemRiskPct ?? 0,
    markupPct: item.markupPct ?? 0,
    notes: item.notes ?? '',
    variables: [...(item.variables ?? [])],
    formulas: { ...(item.formulas ?? {}) },
    priceAdjustments: [...(item.priceAdjustments ?? [])],
  })
  const previewItem = { ...item, ...form }
  const breakdown = boqPriceBreakdown(previewItem)
  const formulaTargets: BoqFormulaTarget[] = ['quantity', 'labor', 'material', 'equipment', 'subcontracting', 'wastePct', 'itemRiskPct', 'markupPct']
  const save = () => onSave(form)
  const openFormula = (target: BoqFormulaTarget) => {
    const updated = { ...item, ...form }
    void save()
    onFormula(target, updated)
  }
  const addVariable = () => setForm(current => ({ ...current, variables: [...current.variables, { id: createId(), name: `Variabele ${current.variables.length + 1}`, value: 1, unit: '' }] }))
  const addAdjustment = (type: 'Markup' | 'Markdown') => setForm(current => ({ ...current, priceAdjustments: [...current.priceAdjustments, { id: createId(), label: type === 'Markup' ? 'Nieuwe opslag' : 'Nieuwe korting', type, basis: 'Directe kost' as const, percentage: 0, active: true }] }))
  const submit = (event: FormEvent) => { event.preventDefault(); void save(); onClose() }

  return <div className="modal-backdrop"><form className="modal boq-advanced-dialog" onSubmit={submit}>
    <div className="modal-head"><div><p className="eyebrow">Geavanceerde postcalculatie</p><h2>{item.code} · {item.description}</h2></div><button type="button" className="icon-button" aria-label="Sluiten" onClick={onClose}><X size={20}/></button></div>
    <nav className="boq-advanced-tabs">{(['Basis', 'Variabelen & formules', 'Markups & markdowns'] as const).map(value => <button type="button" key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{value === 'Basis' ? <SlidersHorizontal size={15}/> : value === 'Variabelen & formules' ? <Sigma size={15}/> : <Percent size={15}/>} {value}</button>)}</nav>
    <div className="boq-advanced-body">
      {tab === 'Basis' && <div className="advanced-item-content">
        <label>Posttype<select value={form.postType} onChange={event => setForm({ ...form, postType: event.target.value as BoqPostType })}>{['Meetstaatpost', 'Samengestelde post', 'Percentagepost', 'Stelpost', 'Optiepost', 'Tekstregel', 'Subtotaal'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Hoeveelheidstype<select value={form.quantityType} onChange={event => setForm({ ...form, quantityType: event.target.value as NonNullable<BoqItem['quantityType']> })}>{['Forfaitair', 'Vermoedelijk', 'Verrekenbaar', 'Optioneel'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Materiaalverlies (%)<input type="number" min="0" step="0.1" value={form.wastePct} onChange={event => setForm({ ...form, wastePct: Number(event.target.value) })}/></label>
        <label>Postrisico (%)<input type="number" min="0" step="0.1" value={form.itemRiskPct} onChange={event => setForm({ ...form, itemRiskPct: Number(event.target.value) })}/></label>
        <label>Historische postopslag (%)<input type="number" min="-100" step="0.1" value={form.markupPct} onChange={event => setForm({ ...form, markupPct: Number(event.target.value) })}/></label>
        <label className="full">Calculatienota<textarea rows={5} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Aannames, uitsluitingen, normen en prijsonderbouwing"/></label>
        <div className="post-type-help full"><strong>{form.postType}</strong><span>{form.postType === 'Tekstregel' ? 'Informatieve regel zonder financieel effect.' : form.postType === 'Subtotaal' ? 'Presentatieregel; wordt niet dubbel in het calculatietotaal opgenomen.' : form.postType === 'Percentagepost' ? 'Geschikt voor formules op basis van andere kostvelden of parameters.' : form.postType === 'Samengestelde post' ? 'Opbouw uit meerdere kostcomponenten, variabelen en formules.' : 'Volwaardige prijsdragende calculatiepost.'}</span></div>
      </div>}
      {tab === 'Variabelen & formules' && <div className="boq-formula-overview">
        <section><header><div><strong>Invoervariabelen</strong><span>Herbruikbare maten, aantallen, prestaties of tarieven voor deze post.</span></div><button type="button" className="secondary" onClick={addVariable}><Plus size={14}/>Variabele</button></header><div className="boq-variable-list">{form.variables.map(variable => <article key={variable.id}><input aria-label="Variabelenaam" value={variable.name} onChange={event => setForm({ ...form, variables: form.variables.map(entry => entry.id === variable.id ? { ...entry, name: event.target.value } : entry) })}/><input aria-label={`Waarde ${variable.name}`} type="number" step="any" value={variable.value} onChange={event => setForm({ ...form, variables: form.variables.map(entry => entry.id === variable.id ? { ...entry, value: Number(event.target.value) } : entry) })}/><input aria-label={`Eenheid ${variable.name}`} placeholder="eenheid" value={variable.unit} onChange={event => setForm({ ...form, variables: form.variables.map(entry => entry.id === variable.id ? { ...entry, unit: event.target.value } : entry) })}/><button type="button" className="icon-button danger" aria-label={`Variabele ${variable.name} verwijderen`} onClick={() => setForm({ ...form, variables: form.variables.filter(entry => entry.id !== variable.id) })}><Trash2 size={14}/></button></article>)}{!form.variables.length && <div className="dossier-empty">Voeg bijvoorbeeld lengte, breedte, diepte, aantal of uurprestatie toe.</div>}</div></section>
        <section><header><div><strong>Berekende velden</strong><span>Kies een veld en bouw de formule visueel op.</span></div></header><div className="formula-target-grid">{formulaTargets.map(target => { const formula = form.formulas[target]; const result = effectiveBoqValues(previewItem); return <article key={target} className={result.errors[target] ? 'invalid' : ''}><span><Sigma size={15}/><strong>{boqFormulaFieldLabels[target]}</strong><small>{formula ? formula.label : 'Handmatige waarde'}</small></span><b>{['quantity', 'wastePct', 'itemRiskPct', 'markupPct'].includes(target) ? number(result.values[target]) : money(result.values[target])}</b><button type="button" className="secondary" onClick={() => openFormula(target)}>{formula ? 'Formule wijzigen' : 'Formule maken'}</button>{formula && <button type="button" className="icon-button danger" aria-label={`Formule ${boqFormulaFieldLabels[target]} verwijderen`} onClick={() => { const formulas = { ...form.formulas }; delete formulas[target]; setForm({ ...form, formulas }) }}><Trash2 size={13}/></button>}</article> })}</div></section>
      </div>}
      {tab === 'Markups & markdowns' && <div className="adjustment-workspace">
        <header><div><strong>Prijsaanpassingen in volgorde</strong><span>Elke regel is zichtbaar in de prijsopbouw en kan tijdelijk worden uitgeschakeld.</span></div><span><button type="button" className="secondary" onClick={() => addAdjustment('Markup')}><Plus size={14}/>Markup</button><button type="button" className="secondary" onClick={() => addAdjustment('Markdown')}><Plus size={14}/>Markdown</button></span></header>
        <div className="adjustment-list">{form.priceAdjustments.map((rule, index) => <article key={rule.id} className={rule.active ? '' : 'inactive'}><i>{index + 1}</i><label>Naam<input value={rule.label} onChange={event => setForm({ ...form, priceAdjustments: form.priceAdjustments.map(entry => entry.id === rule.id ? { ...entry, label: event.target.value } : entry) })}/></label><label>Type<select value={rule.type} onChange={event => setForm({ ...form, priceAdjustments: form.priceAdjustments.map(entry => entry.id === rule.id ? { ...entry, type: event.target.value as typeof rule.type } : entry) })}><option>Markup</option><option>Markdown</option></select></label><label>Basis<select value={rule.basis} onChange={event => setForm({ ...form, priceAdjustments: form.priceAdjustments.map(entry => entry.id === rule.id ? { ...entry, basis: event.target.value as typeof rule.basis } : entry) })}>{['Directe kost', 'Arbeid', 'Materiaal', 'Materieel', 'Onderaanneming'].map(value => <option key={value}>{value}</option>)}</select></label><label>Percentage<input type="number" min="0" step="0.01" value={rule.percentage} onChange={event => setForm({ ...form, priceAdjustments: form.priceAdjustments.map(entry => entry.id === rule.id ? { ...entry, percentage: Number(event.target.value) } : entry) })}/></label><label className="adjustment-active"><input type="checkbox" checked={rule.active} onChange={event => setForm({ ...form, priceAdjustments: form.priceAdjustments.map(entry => entry.id === rule.id ? { ...entry, active: event.target.checked } : entry) })}/>Actief</label><button type="button" className="icon-button danger" aria-label={`Prijsregel ${rule.label} verwijderen`} onClick={() => setForm({ ...form, priceAdjustments: form.priceAdjustments.filter(entry => entry.id !== rule.id) })}><Trash2 size={14}/></button></article>)}{!form.priceAdjustments.length && <div className="dossier-empty">Nog geen gelaagde markups of markdowns.</div>}</div>
        <div className="price-waterfall"><span>Basis<strong>{money(breakdown.base)}</strong></span>{breakdown.riskAmount !== 0 && <span>Risico<strong>{money(breakdown.riskAmount)}</strong></span>}{breakdown.adjustments.map(rule => <span key={rule.id} className={rule.amount < 0 ? 'negative' : 'positive'}>{rule.label}<strong>{rule.amount < 0 ? '−' : '+'}{money(Math.abs(rule.amount))}</strong></span>)}<span className="total">Eenheidskost<strong>{money(breakdown.total)}</strong></span></div>
      </div>}
    </div>
    <div className="modal-actions"><span className="modal-note">Formules en prijsregels worden mee opgenomen in versies, kopieën en de audittrail.</span><button type="button" className="secondary" onClick={onClose}>Annuleren</button><button className="primary">Postinstellingen opslaan</button></div>
  </form></div>
}

export default function FormulaBuilderDialog({ item, initialTarget, onApply, onClose }: FormulaBuilderDialogProps) {
  const targets: BoqFormulaTarget[] = ['quantity', 'labor', 'material', 'equipment', 'subcontracting', 'wastePct', 'itemRiskPct', 'markupPct']
  const [target, setTarget] = useState(initialTarget)
  const [tokens, setTokens] = useState<BoqFormulaToken[]>(item.formulas?.[initialTarget]?.tokens ?? [])
  const [label, setLabel] = useState(item.formulas?.[initialTarget]?.label ?? `${boqFormulaFieldLabels[initialTarget]} berekenen`)
  const [variables, setVariables] = useState([...(item.variables ?? [])])
  const [constant, setConstant] = useState(1)

  const addToken = (token: { kind: 'field'; field: BoqFormulaField } | { kind: 'variable'; variableId: string } | { kind: 'number'; value: number } | { kind: 'operator'; operator: BoqFormulaOperator }) => {
    setTokens(current => [...current, { ...token, id: createId() } as BoqFormulaToken])
  }
  const switchTarget = (value: BoqFormulaTarget) => {
    setTarget(value)
    setTokens(item.formulas?.[value]?.tokens ?? [])
    setLabel(item.formulas?.[value]?.label ?? `${boqFormulaFieldLabels[value]} berekenen`)
  }
  const addDragged = (value: string) => {
    const [kind, id] = value.split(':')
    if (kind === 'field') addToken({ kind: 'field', field: id as BoqFormulaField })
    if (kind === 'variable') addToken({ kind: 'variable', variableId: id })
  }
  const tokenLabel = (token: BoqFormulaToken) => token.kind === 'field'
    ? boqFormulaFieldLabels[token.field]
    : token.kind === 'variable'
      ? (variables.find(variable => variable.id === token.variableId)?.name ?? 'Onbekend veld')
      : token.kind === 'number'
        ? number(token.value)
        : token.operator
  const candidateFormula: BoqFormula = {
    id: item.formulas?.[target]?.id ?? createId(),
    label,
    tokens,
    updatedAt: new Date().toISOString(),
  }
  const candidate = { ...item, variables, formulas: { ...(item.formulas ?? {}), [target]: candidateFormula } }
  const result = effectiveBoqValues(candidate)
  const error = result.errors[target]
  const output = result.values[target]
  const fields = (Object.keys(boqFormulaFieldLabels) as BoqFormulaField[]).filter(field => field !== target)

  const applyTemplate = (type: 'oppervlakte' | 'volume' | 'arbeid') => {
    const definitions: Array<[string, number, string]> = type === 'oppervlakte'
      ? [['Lengte', 1, 'm'], ['Breedte', 1, 'm']]
      : type === 'volume'
        ? [['Lengte', 1, 'm'], ['Breedte', 1, 'm'], ['Diepte', 1, 'm']]
        : [['Hoeveelheid werk', 1, item.unit], ['Uurprestatie', 1, `${item.unit}/u`], ['Uurtarief', 55, '€/u']]
    const next = definitions.map(([name, value, unit]) => ({ id: createId(), name, value, unit }))
    setVariables(current => [...current, ...next])
    const built: BoqFormulaToken[] = []
    next.forEach((variable, index) => {
      if (index) built.push({ id: createId(), kind: 'operator', operator: type === 'arbeid' && index === 1 ? '/' : '*' })
      built.push({ id: createId(), kind: 'variable', variableId: variable.id })
    })
    setTokens(built)
    setLabel(type === 'oppervlakte' ? 'Oppervlakte uit lengte en breedte' : type === 'volume' ? 'Volume uit lengte, breedte en diepte' : 'Arbeidskost uit hoeveelheid, prestatie en tarief')
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (error || !tokens.length) return
    void onApply({ variables, formulas: { ...(item.formulas ?? {}), [target]: candidateFormula } })
    onClose()
  }

  return <div className="modal-backdrop formula-builder-backdrop">
    <form className="modal formula-builder-dialog" onSubmit={submit}>
      <div className="modal-head">
        <div><p className="eyebrow">Visuele formulebouwer</p><h2>{item.code} · {boqFormulaFieldLabels[target]}</h2><span>Sleep velden naar het formulevlak of klik om ze toe te voegen.</span></div>
        <button type="button" className="icon-button" aria-label="Sluiten" onClick={onClose}><X size={20}/></button>
      </div>
      <div className="formula-builder-toolbar">
        <label>Berekend veld<select value={target} onChange={event => switchTarget(event.target.value as BoqFormulaTarget)}>{targets.map(field => <option key={field} value={field}>{boqFormulaFieldLabels[field]}</option>)}</select></label>
        <label className="formula-name">Formulenaam<input value={label} onChange={event => setLabel(event.target.value)}/></label>
        <div className="formula-templates"><span>Snel starten</span><button type="button" onClick={() => applyTemplate('oppervlakte')}>Oppervlakte</button><button type="button" onClick={() => applyTemplate('volume')}>Volume</button><button type="button" onClick={() => applyTemplate('arbeid')}>Arbeidskost</button></div>
      </div>
      <div className="formula-builder-layout">
        <aside className="formula-palette">
          <section><h3>Postvelden</h3><p>Actuele of reeds berekende waarden uit deze post.</p><div>{fields.map(field => <button draggable type="button" key={field} onDragStart={event => event.dataTransfer.setData('text/plain', `field:${field}`)} onClick={() => addToken({ kind: 'field', field })}><GripVertical size={13}/><span><strong>{boqFormulaFieldLabels[field]}</strong><small>{field === 'baseUnitCost' ? money(boqPriceBreakdown(item).base) : number(effectiveBoqValues(item).values[field])}</small></span><Plus size={13}/></button>)}</div></section>
          <section><h3>Invoervariabelen</h3><p>Maten en parameters die alleen voor deze post gelden.</p><div>{variables.map(variable => <button draggable type="button" key={variable.id} onDragStart={event => event.dataTransfer.setData('text/plain', `variable:${variable.id}`)} onClick={() => addToken({ kind: 'variable', variableId: variable.id })}><GripVertical size={13}/><span><strong>{variable.name}</strong><small>{number(variable.value)} {variable.unit}</small></span><Plus size={13}/></button>)}</div><button type="button" className="formula-add-variable" onClick={() => setVariables(current => [...current, { id: createId(), name: `Variabele ${current.length + 1}`, value: 1, unit: '' }])}><Plus size={13}/>Nieuwe variabele</button></section>
        </aside>
        <main className="formula-canvas-area">
          <div className="formula-operator-bar"><span>Operatoren</span>{(['+', '-', '*', '/', '%', '^', '(', ')'] as BoqFormulaOperator[]).map(operator => <button type="button" key={operator} onClick={() => addToken({ kind: 'operator', operator })}>{operator === '*' ? '×' : operator === '/' ? '÷' : operator}</button>)}<label>Getal<input type="number" step="any" value={constant} onChange={event => setConstant(Number(event.target.value))}/><button type="button" onClick={() => addToken({ kind: 'number', value: constant })}><Plus size={12}/></button></label></div>
          <div className={`formula-canvas ${error ? 'invalid' : ''}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addDragged(event.dataTransfer.getData('text/plain')) }}>
            {tokens.map((token, index) => <span className={`formula-token ${token.kind}`} key={token.id}><b>{tokenLabel(token)}</b><i><button type="button" disabled={index === 0} aria-label="Token naar links" onClick={() => setTokens(current => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next })}><ArrowUp size={10}/></button><button type="button" disabled={index === tokens.length - 1} aria-label="Token naar rechts" onClick={() => setTokens(current => { const next = [...current]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next })}><ArrowDown size={10}/></button><button type="button" aria-label="Token verwijderen" onClick={() => setTokens(current => current.filter(entry => entry.id !== token.id))}><X size={10}/></button></i></span>)}
            {!tokens.length && <div className="formula-drop-hint"><Sigma size={30}/><strong>Sleep hier je eerste veld</strong><span>Daarna plaats je operatoren en extra velden ertussen.</span></div>}
          </div>
          <div className={`formula-live-result ${error ? 'invalid' : 'valid'}`}>{error ? <><AlertTriangle size={18}/><span><strong>Formule nog niet geldig</strong><small>{error}</small></span></> : <><CheckCircle2 size={18}/><span><strong>Live resultaat</strong><small>{boqFormulaFieldLabels[target]}</small></span><b>{['quantity', 'wastePct', 'itemRiskPct', 'markupPct'].includes(target) ? number(output) : money(output)}</b></>}</div>
          <div className="formula-explanation"><strong>Zo wordt dit berekend</strong><code>{tokens.map(token => tokenLabel(token)).join(' ') || 'Nog geen formule'}</code></div>
        </main>
        <aside className="formula-variable-editor"><h3>Waarden testen</h3><p>Pas waarden aan en zie het resultaat onmiddellijk wijzigen.</p>{variables.map(variable => <label key={variable.id}><span>{variable.name}<small>{variable.unit}</small></span><input type="number" step="any" value={variable.value} onChange={event => setVariables(current => current.map(entry => entry.id === variable.id ? { ...entry, value: Number(event.target.value) } : entry))}/></label>)}</aside>
      </div>
      <div className="modal-actions"><span className="modal-note">Formules worden zonder scripts uitgevoerd; deling door nul en cirkelverwijzingen worden automatisch geblokkeerd.</span><button type="button" className="secondary" onClick={() => setTokens([])}>Formule wissen</button><button type="button" className="secondary" onClick={onClose}>Annuleren</button><button className="primary" disabled={Boolean(error) || !tokens.length}><Sigma size={14}/>Formule toepassen</button></div>
    </form>
  </div>
}
