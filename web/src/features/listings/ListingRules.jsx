import { useState } from 'react'
import { apiRequest } from '../../services/api.js'
import { Feedback, Panel } from '../roomlink/Workspace.jsx'
import { costKinds, costMode, costModes, json, money, roomPath, ruleFlags } from './listings.js'

export function ListingTerms({ room }) {
  const { rules, costItems = [] } = room
  return (
    <div className="listing-terms">
      <Panel title="Reglas de convivencia">
        {rules ? <>
          <dl className="listing-facts">
            {Object.entries(ruleFlags).map(([key, label]) => (
              <div key={key}><dt>{label}</dt><dd>{rules[key] ? 'Permitido' : 'No permitido'}</dd></div>
            ))}
            {rules.quietHoursStart && rules.quietHoursEnd && <div><dt>Horas de silencio</dt><dd>{rules.quietHoursStart.slice(0, 5)} a {rules.quietHoursEnd.slice(0, 5)}</dd></div>}
          </dl>
          {rules.visitsPolicy && <p><strong>Visitas</strong> · {rules.visitsPolicy}</p>}
          {rules.commonAreasNotes && <p><strong>Áreas comunes</strong> · {rules.commonAreasNotes}</p>}
          {rules.extraRules && <p>{rules.extraRules}</p>}
        </> : <p className="muted">El anfitrión aún no ha indicado las reglas.</p>}
      </Panel>
      <Panel title="Desglose de costos">
        <dl className="listing-facts">
          <div><dt>Renta mensual</dt><dd>{money(room.monthlyRent)}</dd></div>
          {costItems.map((item) => (
            <div key={item.id}>
              <dt>{item.concept}<small>{costKinds[item.kind]} · {costModes[costMode(item)]}</small></dt>
              <dd>{money(item.amount)}</dd>
            </div>
          ))}
        </dl>
        {!costItems.length && <p className="muted">El anfitrión aún no ha detallado costos adicionales.</p>}
      </Panel>
    </div>
  )
}

export function EditListingTerms({ room, token, onSaved, onEdit }) {
  const [rules, setRules] = useState(room.rules || {})
  const [costs, setCosts] = useState(() => (room.costItems || []).map((item) => ({ ...item, mode: costMode(item) })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function setRule(event) {
    const { name, type, checked, value } = event.target
    setNotice('')
    onEdit()
    setRules((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  function changeCost(id, values) {
    setNotice('')
    onEdit()
    setCosts((current) => current.map((item) => item.id === id ? { ...item, ...values } : item))
  }

  async function save(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    onEdit()
    if (costs.length === 0) {
      setError('Agrega un concepto o registra que no hay cargos adicionales.')
      return
    }
    if (Boolean(rules.quietHoursStart) !== Boolean(rules.quietHoursEnd)) {
      setError('Indica el inicio y el fin de las horas de silencio.')
      return
    }
    setSaving(true)
    const path = roomPath(room.id)
    try {
      await apiRequest(path + '/rules', { token, ...json('PUT', rules) })
    } catch (cause) {
      setError(cause.message)
      setSaving(false)
      return
    }
    try {
      await apiRequest(path + '/costs', { token, ...json('PUT', {
        items: costs.map(({ concept, kind, amount, mode }) => ({
          concept: concept.trim(), kind, amount: Number(amount),
          isIncluded: mode === 'included', isProrated: mode === 'prorated',
        })),
      }) })
      setNotice('Reglas y costos guardados.')
      onSaved()
    } catch (cause) {
      setError('Se guardaron las reglas. Vuelve a guardar para completar los costos. ' + cause.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="listing-form room-stack" onSubmit={save}>
      <fieldset disabled={saving} className="room-panel">
        <legend>Reglas de convivencia</legend>
        <div className="listing-checks">
          {Object.entries(ruleFlags).map(([key, label]) => <label key={key}><input checked={Boolean(rules[key])} name={key} onChange={setRule} type="checkbox" /> Permitir {label.toLowerCase()}</label>)}
        </div>
        <div className="listing-fields">
          <label>Inicio de horas de silencio<input name="quietHoursStart" onChange={setRule} type="time" value={rules.quietHoursStart?.slice(0, 5) || ''} /></label>
          <label>Fin de horas de silencio<input name="quietHoursEnd" onChange={setRule} type="time" value={rules.quietHoursEnd?.slice(0, 5) || ''} /></label>
        </div>
        {[['visitsPolicy', 'Política de visitas'], ['commonAreasNotes', 'Uso de áreas comunes'], ['extraRules', 'Otras reglas']].map(([key, label]) => (
          <label key={key}>{label}<textarea name={key} onChange={setRule} value={rules[key] || ''} /></label>
        ))}
      </fieldset>
      <fieldset disabled={saving} className="room-panel">
        <legend>Desglose de costos</legend>
        <p>Renta mensual · <strong>{money(room.monthlyRent)}</strong></p>
        {costs.map((item, index) => (
          <fieldset className="listing-cost" key={item.id}>
            <legend>Concepto {index + 1}</legend>
            <div className="listing-fields">
              <label>Tipo<select value={item.kind} onChange={(event) => changeCost(item.id, { kind: event.target.value })}>
                {Object.entries(costKinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select></label>
              <label>Nombre del concepto<input required maxLength={160} value={item.concept} onChange={(event) => changeCost(item.id, { concept: event.target.value })} /></label>
              <label>Monto en MXN<input required min="0" max="99999999.99" step="0.01" type="number" value={item.amount} onKeyDown={(event) => { if (['e', 'E', '+', '-'].includes(event.key)) event.preventDefault() }} onChange={(event) => changeCost(item.id, { amount: event.target.value })} /></label>
              <label>Cómo se paga<select value={item.mode} onChange={(event) => changeCost(item.id, { mode: event.target.value })}>
                {Object.entries(costModes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select></label>
            </div>
            <button className="button button-rose" type="button" onClick={() => {
              setNotice('')
              onEdit()
              setCosts((current) => current.filter(({ id }) => id !== item.id))
            }}>Quitar concepto {index + 1}</button>
          </fieldset>
        ))}
        {costs.length === 0 && <button className="button button-subtle" onClick={() => {
          setNotice('')
          onEdit()
          setCosts([{ id: crypto.randomUUID(), kind: 'other', concept: 'Sin cargos adicionales', amount: '0', mode: 'included' }])
        }} type="button">Registrar sin cargos adicionales</button>}
        <button className="button button-subtle" disabled={costs.length >= 20} onClick={() => {
          setNotice('')
          onEdit()
          setCosts((current) => [...current, { id: crypto.randomUUID(), kind: 'service', concept: '', amount: '', mode: 'extra' }])
        }} type="button">Agregar concepto</button>
      </fieldset>
      <Feedback error={error}>{notice}</Feedback>
      <button className="button button-mint" disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar reglas y costos'}</button>
    </form>
  )
}
