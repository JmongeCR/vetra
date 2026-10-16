import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { SPECIES_LABELS, SEX_LABELS, SPECIES_EMOJI } from '../types/patient'
import { getPatient, type ClinicPatient } from '../services/patientsDb'
import {
  getOrCreateRecord, updateRecord,
  listConsultations, createConsultation,
  listVaccinations, createVaccination,
  listTreatments, createTreatment, updateTreatmentStatus,
  type ClinicalRecord, type Consultation, type Vaccination, type Treatment,
} from '../services/clinicalDb'
import { useClinicAuthContext } from '../contexts/clinicAuthContext'
import styles from './PacienteDetalle.module.css'

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcAge(birthDate: string | null): string | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) years--
  if (years < 1) {
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + monthDiff
    return `${Math.max(0, months)} mes${months !== 1 ? 'es' : ''}`
  }
  return `${years} año${years !== 1 ? 's' : ''}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CR', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── GeneralTab ────────────────────────────────────────────────────────────────

function GeneralTab({ patient }: { patient: ClinicPatient }) {
  const age = calcAge(patient.birth_date)
  return (
    <div className={styles.generalGrid}>
      <div className={styles.infoCard}>
        <p className={styles.infoCardTitle}>Datos del paciente</p>
        <dl className={styles.infoList}>
          <div className={styles.infoRow}><dt>Especie</dt><dd>{SPECIES_LABELS[patient.species]}</dd></div>
          <div className={styles.infoRow}><dt>Raza</dt><dd>{patient.breed ?? '—'}</dd></div>
          <div className={styles.infoRow}><dt>Sexo</dt><dd>{SEX_LABELS[patient.sex]}</dd></div>
          {patient.birth_date && (
            <div className={styles.infoRow}>
              <dt>Nacimiento</dt>
              <dd>
                {new Date(patient.birth_date).toLocaleDateString('es-CR', { year: 'numeric', month: 'short', day: 'numeric' })}
                {patient.birth_date_estimated && ' (aprox.)'}
                {age && <span className={styles.ageTag}>{age}</span>}
              </dd>
            </div>
          )}
          {patient.microchip && (
            <div className={styles.infoRow}><dt>Microchip</dt><dd><code>{patient.microchip}</code></dd></div>
          )}
          {patient.vet_id && (
            <div className={styles.infoRow}>
              <dt>VET-ID</dt>
              <dd className={styles.vetId}><code>{patient.vet_id}</code></dd>
            </div>
          )}
        </dl>
      </div>

      <div className={styles.infoCard}>
        <p className={styles.infoCardTitle}>Responsable</p>
        <dl className={styles.infoList}>
          <div className={styles.infoRow}><dt>Nombre</dt><dd>{patient.owner_name}</dd></div>
          {patient.owner_phone && <div className={styles.infoRow}><dt>Teléfono</dt><dd>{patient.owner_phone}</dd></div>}
          {patient.owner_email && <div className={styles.infoRow}><dt>Correo</dt><dd>{patient.owner_email}</dd></div>}
        </dl>
      </div>

      <div className={styles.infoCard}>
        <p className={styles.infoCardTitle}>Estado del registro</p>
        <dl className={styles.infoList}>
          <div className={styles.infoRow}>
            <dt>Estado</dt>
            <dd><span className={styles.statusBadge}>Activo</span></dd>
          </div>
          <div className={styles.infoRow}><dt>Registrado</dt><dd>{fmtDate(patient.created_at)}</dd></div>
        </dl>
        {patient.notes && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            {patient.notes}
          </p>
        )}
      </div>
    </div>
  )
}

// ── ExpedienteTab ─────────────────────────────────────────────────────────────

function ExpedienteTab({
  record,
  onUpdated,
}: {
  record: ClinicalRecord | null
  onUpdated: (r: ClinicalRecord) => void
}) {
  const [editField, setEditField] = useState<'antecedents' | 'allergies' | 'notes' | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  if (!record) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>📋</span>
        <p className={styles.emptyLabel}>Cargando expediente…</p>
      </div>
    )
  }

  async function saveField() {
    if (!editField || !record) return
    setSaving(true)
    const patch = { [editField]: draft.trim() || null }
    const res = await updateRecord(record.id, patch)
    setSaving(false)
    if (res.ok) {
      onUpdated({ ...record, ...patch } as ClinicalRecord)
      setEditField(null)
    }
  }

  function startEdit(field: typeof editField, current: string | null) {
    setEditField(field)
    setDraft(current ?? '')
  }

  function cancelEdit() { setEditField(null) }

  const FIELDS: { key: 'antecedents' | 'allergies' | 'notes'; label: string }[] = [
    { key: 'antecedents', label: 'Antecedentes' },
    { key: 'allergies',   label: 'Alergias conocidas' },
    { key: 'notes',       label: 'Notas generales' },
  ]

  return (
    <div className={styles.expedienteGrid}>
      {FIELDS.map(({ key, label }) => (
        <div key={key} className={styles.expedienteCard}>
          <p className={styles.expedienteCardTitle}>
            {label}
            {editField !== key && (
              <button className={styles.btnEditSmall} onClick={() => startEdit(key, record[key])}>
                Editar
              </button>
            )}
          </p>
          {editField === key ? (
            <>
              <textarea
                className={styles.expedienteTextarea}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={`Escribí ${label.toLowerCase()}…`}
                rows={4}
                autoFocus
              />
              <div className={styles.expedienteActions}>
                <button className={styles.btnSaveSmall} onClick={() => void saveField()} disabled={saving}>
                  {saving ? '…' : 'Guardar'}
                </button>
                <button className={styles.btnCancelSmall} onClick={cancelEdit}>Cancelar</button>
              </div>
            </>
          ) : record[key] ? (
            <p className={styles.expedienteText}>{record[key]}</p>
          ) : (
            <p className={styles.expedienteEmpty}>Sin datos registrados</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── ConsultationForm ──────────────────────────────────────────────────────────

function ConsultationForm({
  clinicId, patientId, recordId, staffId,
  onClose, onSaved,
}: {
  clinicId: string; patientId: string; recordId: string; staffId: string | null
  onClose: () => void; onSaved: (c: Consultation) => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    visit_date: today, reason: '', anamnesis: '', physical_exam: '',
    weight: '', temp: '', hr: '', rr: '', diagnosis: '', treatment_plan: '', observations: '',
    follow_up_date: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.reason.trim()) { setError('El motivo de la consulta es obligatorio.'); return }
    setSaving(true); setError('')
    const res = await createConsultation({
      clinic_id: clinicId, patient_id: patientId, record_id: recordId,
      staff_id: staffId || null,
      visit_date: form.visit_date,
      reason: form.reason,
      anamnesis: form.anamnesis || undefined,
      physical_exam: form.physical_exam || undefined,
      weight_kg: form.weight ? parseFloat(form.weight) : null,
      temperature_c: form.temp ? parseFloat(form.temp) : null,
      heart_rate_bpm: form.hr ? parseInt(form.hr) : null,
      respiratory_rate: form.rr ? parseInt(form.rr) : null,
      diagnosis: form.diagnosis || undefined,
      treatment_plan: form.treatment_plan || undefined,
      observations: form.observations || undefined,
      follow_up_date: form.follow_up_date || null,
    })
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    onSaved({
      id: res.id, clinic_id: clinicId, patient_id: patientId, record_id: recordId,
      appointment_id: null, staff_id: staffId, staff_name: null,
      visit_date: form.visit_date, reason: form.reason,
      anamnesis: form.anamnesis || null, physical_exam: form.physical_exam || null,
      weight_kg: form.weight ? parseFloat(form.weight) : null,
      temperature_c: form.temp ? parseFloat(form.temp) : null,
      heart_rate_bpm: form.hr ? parseInt(form.hr) : null,
      respiratory_rate: form.rr ? parseInt(form.rr) : null,
      diagnosis: form.diagnosis || null, treatment_plan: form.treatment_plan || null,
      observations: form.observations || null, follow_up_date: form.follow_up_date || null,
      created_at: new Date().toISOString(),
    })
    onClose()
  }

  return (
    <div className={styles.panelOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <aside className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Nueva consulta</h2>
          <button className={styles.panelClose} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={e => void handleSubmit(e)} className={styles.panelForm} noValidate>
          <div className={styles.panelSection}>
            <h3 className={styles.panelSectionTitle}>Información general</h3>
            <div className={styles.panelGrid}>
              <div className={styles.panelField}>
                <label>Fecha de visita</label>
                <input type="date" className={styles.panelInput} value={form.visit_date}
                  onChange={e => set('visit_date', e.target.value)} max={today} />
              </div>
              <div className={styles.panelField} style={{ gridColumn: '1 / -1' }}>
                <label>Motivo *</label>
                <input className={styles.panelInput} value={form.reason}
                  onChange={e => set('reason', e.target.value)}
                  placeholder="Motivo de la consulta" maxLength={200} />
              </div>
              <div className={styles.panelField} style={{ gridColumn: '1 / -1' }}>
                <label>Anamnesis</label>
                <textarea className={styles.panelTextarea} value={form.anamnesis}
                  onChange={e => set('anamnesis', e.target.value)}
                  placeholder="Historia clínica relatada por el propietario" rows={3} />
              </div>
              <div className={styles.panelField} style={{ gridColumn: '1 / -1' }}>
                <label>Exploración física</label>
                <textarea className={styles.panelTextarea} value={form.physical_exam}
                  onChange={e => set('physical_exam', e.target.value)}
                  placeholder="Hallazgos del examen físico" rows={3} />
              </div>
            </div>
          </div>

          <div className={styles.panelSection}>
            <h3 className={styles.panelSectionTitle}>Signos vitales</h3>
            <div className={styles.panelGrid}>
              <div className={styles.panelField}>
                <label>Peso (kg)</label>
                <input type="number" step="0.01" className={styles.panelInput} value={form.weight}
                  onChange={e => set('weight', e.target.value)} placeholder="0.00" />
              </div>
              <div className={styles.panelField}>
                <label>Temperatura (°C)</label>
                <input type="number" step="0.1" className={styles.panelInput} value={form.temp}
                  onChange={e => set('temp', e.target.value)} placeholder="38.5" />
              </div>
              <div className={styles.panelField}>
                <label>FC (lpm)</label>
                <input type="number" className={styles.panelInput} value={form.hr}
                  onChange={e => set('hr', e.target.value)} placeholder="80" />
              </div>
              <div className={styles.panelField}>
                <label>FR (rpm)</label>
                <input type="number" className={styles.panelInput} value={form.rr}
                  onChange={e => set('rr', e.target.value)} placeholder="20" />
              </div>
            </div>
          </div>

          <div className={styles.panelSection}>
            <h3 className={styles.panelSectionTitle}>Diagnóstico y tratamiento</h3>
            <div className={styles.panelField}>
              <label>Diagnóstico</label>
              <textarea className={styles.panelTextarea} value={form.diagnosis}
                onChange={e => set('diagnosis', e.target.value)}
                placeholder="Diagnóstico o diagnósticos diferenciales" rows={2} />
            </div>
            <div className={styles.panelField}>
              <label>Plan de tratamiento</label>
              <textarea className={styles.panelTextarea} value={form.treatment_plan}
                onChange={e => set('treatment_plan', e.target.value)}
                placeholder="Medicamentos, dosis, indicaciones" rows={2} />
            </div>
            <div className={styles.panelField}>
              <label>Observaciones</label>
              <textarea className={styles.panelTextarea} value={form.observations}
                onChange={e => set('observations', e.target.value)}
                placeholder="Notas adicionales" rows={2} />
            </div>
            <div className={styles.panelField}>
              <label>Próxima revisión</label>
              <input type="date" className={styles.panelInput} value={form.follow_up_date}
                onChange={e => set('follow_up_date', e.target.value)}
                min={today} />
            </div>
          </div>

          {error && <p className={styles.panelError}>{error}</p>}
          <div className={styles.panelActions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar consulta'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}

// ── ConsultasTab ──────────────────────────────────────────────────────────────

function ConsultasTab({
  consultations, clinicId, patientId, recordId, staffId, onAdded,
}: {
  consultations: Consultation[]; clinicId: string; patientId: string
  recordId: string | null; staffId: string | null
  onAdded: (c: Consultation) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div>
      {showForm && recordId && (
        <ConsultationForm
          clinicId={clinicId} patientId={patientId} recordId={recordId} staffId={staffId}
          onClose={() => setShowForm(false)}
          onSaved={(c) => { onAdded(c); setShowForm(false) }}
        />
      )}
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Historial de consultas</h3>
        <button className={styles.btnAdd} onClick={() => setShowForm(true)} disabled={!recordId}>
          + Nueva consulta
        </button>
      </div>
      {consultations.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🩺</span>
          <p className={styles.emptyLabel}>Sin consultas registradas</p>
          <p className={styles.emptyNote}>Las consultas se guardan en Supabase al agregarlas.</p>
        </div>
      ) : (
        <div className={styles.cardList}>
          {consultations.map(c => (
            <div key={c.id} className={styles.card}>
              <div className={styles.cardMeta}>
                <span className={styles.cardDate}>
                  {new Date(c.visit_date).toLocaleDateString('es-CR', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
                {c.staff_name && <span className={styles.cardStaff}>· {c.staff_name}</span>}
              </div>
              <p className={styles.cardTitle}>{c.reason}</p>
              {(c.weight_kg || c.temperature_c || c.heart_rate_bpm || c.respiratory_rate) && (
                <div className={styles.vitalsRow}>
                  {c.weight_kg && <span className={styles.vitalChip}>⚖️ {c.weight_kg} kg</span>}
                  {c.temperature_c && <span className={styles.vitalChip}>🌡️ {c.temperature_c} °C</span>}
                  {c.heart_rate_bpm && <span className={styles.vitalChip}>❤️ {c.heart_rate_bpm} lpm</span>}
                  {c.respiratory_rate && <span className={styles.vitalChip}>💨 {c.respiratory_rate} rpm</span>}
                </div>
              )}
              {expanded === c.id ? (
                <>
                  {c.anamnesis && (
                    <div className={styles.cardBodySection}>
                      <p className={styles.cardBodyLabel}>Anamnesis</p>
                      <p className={styles.cardBody}>{c.anamnesis}</p>
                    </div>
                  )}
                  {c.physical_exam && (
                    <div className={styles.cardBodySection}>
                      <p className={styles.cardBodyLabel}>Exploración</p>
                      <p className={styles.cardBody}>{c.physical_exam}</p>
                    </div>
                  )}
                  {c.diagnosis && (
                    <div className={styles.cardBodySection}>
                      <p className={styles.cardBodyLabel}>Diagnóstico</p>
                      <p className={styles.cardBody}>{c.diagnosis}</p>
                    </div>
                  )}
                  {c.treatment_plan && (
                    <div className={styles.cardBodySection}>
                      <p className={styles.cardBodyLabel}>Tratamiento</p>
                      <p className={styles.cardBody}>{c.treatment_plan}</p>
                    </div>
                  )}
                  {c.follow_up_date && (
                    <p className={styles.nextDose} style={{ marginTop: '0.4rem' }}>
                      Próxima revisión: {new Date(c.follow_up_date).toLocaleDateString('es-CR', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                  <button className={styles.btnCancelSmall} style={{ marginTop: '0.5rem' }}
                    onClick={() => setExpanded(null)}>
                    Mostrar menos
                  </button>
                </>
              ) : (
                (c.diagnosis || c.anamnesis || c.treatment_plan) && (
                  <button className={styles.btnCancelSmall} style={{ marginTop: '0.5rem' }}
                    onClick={() => setExpanded(c.id)}>
                    Ver detalle
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── VacunacionTab ─────────────────────────────────────────────────────────────

function VacunacionTab({
  vaccinations, clinicId, patientId, onAdded,
}: {
  vaccinations: Vaccination[]; clinicId: string; patientId: string
  onAdded: (v: Vaccination) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ vaccine_name: '', vaccine_lot: '', administered_date: today, next_dose_date: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.vaccine_name.trim()) { setError('El nombre de la vacuna es obligatorio.'); return }
    setSaving(true); setError('')
    const res = await createVaccination({
      clinic_id: clinicId, patient_id: patientId,
      vaccine_name: form.vaccine_name, vaccine_lot: form.vaccine_lot || undefined,
      administered_date: form.administered_date,
      next_dose_date: form.next_dose_date || undefined,
      notes: form.notes || undefined,
    })
    setSaving(false)
    if (!res.ok) { setError(res.error ?? 'Error al guardar'); return }
    onAdded({
      id: crypto.randomUUID(), clinic_id: clinicId, patient_id: patientId,
      vaccine_name: form.vaccine_name, vaccine_lot: form.vaccine_lot || null,
      administered_date: form.administered_date, next_dose_date: form.next_dose_date || null,
      notes: form.notes || null, created_at: new Date().toISOString(),
    })
    setShowForm(false)
    setForm({ vaccine_name: '', vaccine_lot: '', administered_date: today, next_dose_date: '', notes: '' })
  }

  return (
    <div>
      {showForm && (
        <div className={styles.panelOverlay} onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <aside className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Registrar vacuna</h2>
              <button className={styles.panelClose} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={e => void handleSubmit(e)} className={styles.panelForm} noValidate>
              <div className={styles.panelGrid}>
                <div className={styles.panelField} style={{ gridColumn: '1 / -1' }}>
                  <label>Vacuna *</label>
                  <input className={styles.panelInput} value={form.vaccine_name}
                    onChange={e => set('vaccine_name', e.target.value)} placeholder="Ej: Quíntuple, Rabia" maxLength={100} />
                </div>
                <div className={styles.panelField}>
                  <label>Lote</label>
                  <input className={styles.panelInput} value={form.vaccine_lot}
                    onChange={e => set('vaccine_lot', e.target.value)} placeholder="Número de lote" maxLength={40} />
                </div>
                <div className={styles.panelField}>
                  <label>Fecha de aplicación</label>
                  <input type="date" className={styles.panelInput} value={form.administered_date}
                    onChange={e => set('administered_date', e.target.value)} max={today} />
                </div>
                <div className={styles.panelField}>
                  <label>Próxima dosis</label>
                  <input type="date" className={styles.panelInput} value={form.next_dose_date}
                    onChange={e => set('next_dose_date', e.target.value)} min={today} />
                </div>
                <div className={styles.panelField} style={{ gridColumn: '1 / -1' }}>
                  <label>Notas</label>
                  <textarea className={styles.panelTextarea} value={form.notes}
                    onChange={e => set('notes', e.target.value)} placeholder="Observaciones" rows={2} />
                </div>
              </div>
              {error && <p className={styles.panelError}>{error}</p>}
              <div className={styles.panelActions}>
                <button type="button" className={styles.btnCancel} onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className={styles.btnSave} disabled={saving}>
                  {saving ? 'Guardando…' : 'Registrar vacuna'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Vacunación</h3>
        <button className={styles.btnAdd} onClick={() => setShowForm(true)}>+ Registrar vacuna</button>
      </div>
      {vaccinations.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>💉</span>
          <p className={styles.emptyLabel}>Sin vacunas registradas</p>
          <p className={styles.emptyNote}>Las vacunas se guardan en Supabase al agregarlas.</p>
        </div>
      ) : (
        <div className={styles.cardList}>
          {vaccinations.map(v => (
            <div key={v.id} className={styles.card}>
              <div className={styles.cardMeta}>
                <span className={styles.cardDate}>
                  {new Date(v.administered_date).toLocaleDateString('es-CR', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
                {v.vaccine_lot && <span className={styles.cardStaff}>· Lote: {v.vaccine_lot}</span>}
              </div>
              <p className={styles.cardTitle}>{v.vaccine_name}</p>
              {v.next_dose_date && (
                <p className={styles.nextDose}>
                  Próxima dosis: {new Date(v.next_dose_date).toLocaleDateString('es-CR', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
              {v.notes && <p className={styles.cardBody}>{v.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── TratamientosTab ───────────────────────────────────────────────────────────

const STATUS_CHIP_CLASS: Record<string, string> = {
  active: styles.statusActive,
  completed: styles.statusDone,
  suspended: styles.statusSuspended,
}
const STATUS_LABELS_TR: Record<string, string> = {
  active: 'Activo', completed: 'Completado', suspended: 'Suspendido',
}

function TratamientosTab({
  treatments, clinicId, patientId, onAdded, onStatusChange,
}: {
  treatments: Treatment[]; clinicId: string; patientId: string
  onAdded: (t: Treatment) => void
  onStatusChange: (id: string, status: Treatment['status']) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ medication: '', dosage: '', frequency: '', start_date: today, end_date: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.medication.trim()) { setError('El medicamento es obligatorio.'); return }
    setSaving(true); setError('')
    const res = await createTreatment({
      clinic_id: clinicId, patient_id: patientId,
      medication: form.medication, dosage: form.dosage || undefined,
      frequency: form.frequency || undefined, start_date: form.start_date,
      end_date: form.end_date || undefined, notes: form.notes || undefined,
    })
    setSaving(false)
    if (!res.ok) { setError(res.error ?? 'Error al guardar'); return }
    onAdded({
      id: crypto.randomUUID(), clinic_id: clinicId, patient_id: patientId, consultation_id: null,
      medication: form.medication, dosage: form.dosage || null, frequency: form.frequency || null,
      start_date: form.start_date, end_date: form.end_date || null, status: 'active',
      notes: form.notes || null, created_at: new Date().toISOString(),
    })
    setShowForm(false)
    setForm({ medication: '', dosage: '', frequency: '', start_date: today, end_date: '', notes: '' })
  }

  async function handleStatusChange(t: Treatment, status: Treatment['status']) {
    const res = await updateTreatmentStatus(t.id, status)
    if (res.ok) onStatusChange(t.id, status)
  }

  return (
    <div>
      {showForm && (
        <div className={styles.panelOverlay} onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <aside className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Nuevo tratamiento</h2>
              <button className={styles.panelClose} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={e => void handleSubmit(e)} className={styles.panelForm} noValidate>
              <div className={styles.panelGrid}>
                <div className={styles.panelField} style={{ gridColumn: '1 / -1' }}>
                  <label>Medicamento *</label>
                  <input className={styles.panelInput} value={form.medication}
                    onChange={e => set('medication', e.target.value)} placeholder="Nombre del medicamento" maxLength={100} />
                </div>
                <div className={styles.panelField}>
                  <label>Dosis</label>
                  <input className={styles.panelInput} value={form.dosage}
                    onChange={e => set('dosage', e.target.value)} placeholder="Ej: 5 mg/kg" maxLength={60} />
                </div>
                <div className={styles.panelField}>
                  <label>Frecuencia</label>
                  <input className={styles.panelInput} value={form.frequency}
                    onChange={e => set('frequency', e.target.value)} placeholder="Ej: cada 12 h" maxLength={60} />
                </div>
                <div className={styles.panelField}>
                  <label>Inicio</label>
                  <input type="date" className={styles.panelInput} value={form.start_date}
                    onChange={e => set('start_date', e.target.value)} />
                </div>
                <div className={styles.panelField}>
                  <label>Fin (opcional)</label>
                  <input type="date" className={styles.panelInput} value={form.end_date}
                    onChange={e => set('end_date', e.target.value)} min={form.start_date} />
                </div>
                <div className={styles.panelField} style={{ gridColumn: '1 / -1' }}>
                  <label>Notas</label>
                  <textarea className={styles.panelTextarea} value={form.notes}
                    onChange={e => set('notes', e.target.value)} placeholder="Indicaciones adicionales" rows={2} />
                </div>
              </div>
              {error && <p className={styles.panelError}>{error}</p>}
              <div className={styles.panelActions}>
                <button type="button" className={styles.btnCancel} onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className={styles.btnSave} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar tratamiento'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Tratamientos</h3>
        <button className={styles.btnAdd} onClick={() => setShowForm(true)}>+ Nuevo tratamiento</button>
      </div>
      {treatments.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>💊</span>
          <p className={styles.emptyLabel}>Sin tratamientos registrados</p>
          <p className={styles.emptyNote}>Los tratamientos se guardan en Supabase al agregarlos.</p>
        </div>
      ) : (
        <div className={styles.cardList}>
          {treatments.map(t => (
            <div key={t.id} className={styles.card}>
              <div className={styles.cardMeta}>
                <span className={`${styles.statusChip} ${STATUS_CHIP_CLASS[t.status] ?? ''}`}>
                  {STATUS_LABELS_TR[t.status]}
                </span>
                <span className={styles.cardDate}>
                  Inicio: {new Date(t.start_date).toLocaleDateString('es-CR', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {t.end_date && (
                  <span className={styles.cardDate}>
                    Fin: {new Date(t.end_date).toLocaleDateString('es-CR', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </div>
              <p className={styles.cardTitle}>{t.medication}</p>
              {(t.dosage || t.frequency) && (
                <p className={styles.cardBody}>
                  {t.dosage}{t.dosage && t.frequency ? ' · ' : ''}{t.frequency}
                </p>
              )}
              {t.notes && <p className={styles.cardBody}>{t.notes}</p>}
              {t.status === 'active' && (
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                  <button className={styles.btnCancelSmall}
                    onClick={() => void handleStatusChange(t, 'completed')}>
                    Marcar completado
                  </button>
                  <button className={styles.btnCancelSmall}
                    onClick={() => void handleStatusChange(t, 'suspended')}>
                    Suspender
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

type TabId = 'general' | 'expediente' | 'consultas' | 'vacunacion' | 'tratamientos' | 'documentos'

const TABS: { id: TabId; label: string }[] = [
  { id: 'general',      label: 'Datos generales' },
  { id: 'expediente',   label: 'Expediente' },
  { id: 'consultas',    label: 'Consultas' },
  { id: 'vacunacion',   label: 'Vacunación' },
  { id: 'tratamientos', label: 'Tratamientos' },
  { id: 'documentos',   label: 'Documentos' },
]

export default function PacienteDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { member } = useClinicAuthContext()

  const [patient, setPatient]             = useState<ClinicPatient | null>(null)
  const [record, setRecord]               = useState<ClinicalRecord | null>(null)
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [vaccinations, setVaccinations]   = useState<Vaccination[]>([])
  const [treatments, setTreatments]       = useState<Treatment[]>([])
  const [loading, setLoading]             = useState(true)
  const [notFound, setNotFound]           = useState(false)
  const [activeTab, setActiveTab]         = useState<TabId>('general')

  useEffect(() => {
    if (!id) return
    void (async () => {
      const p = await getPatient(id)
      if (!p) { setNotFound(true); setLoading(false); return }
      setPatient(p)
      if (member?.clinicId) {
        const [rec, cons, vacc, treat] = await Promise.all([
          getOrCreateRecord(member.clinicId, id),
          listConsultations(id),
          listVaccinations(id),
          listTreatments(id),
        ])
        setRecord(rec)
        setConsultations(cons)
        setVaccinations(vacc)
        setTreatments(treat)
      }
      setLoading(false)
    })()
  }, [id, member?.clinicId])

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <p>Cargando ficha del paciente…</p>
      </div>
    )
  }

  if (notFound || !patient) {
    return (
      <div className={styles.notFound}>
        <span className={styles.notFoundIcon}>🔍</span>
        <h2>Paciente no encontrado</h2>
        <p>Este paciente no existe o no pertenece a tu clínica.</p>
        <button className={styles.btnBack} onClick={() => navigate('/pacientes')}>
          ← Volver a Pacientes
        </button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/pacientes')}>
          ← Pacientes
        </button>
        <div className={styles.headerInfo}>
          <span className={styles.speciesIcon}>{SPECIES_EMOJI[patient.species]}</span>
          <div>
            <h1 className={styles.patientName}>{patient.name}</h1>
            <p className={styles.patientMeta}>
              {SPECIES_LABELS[patient.species]}
              {patient.breed ? ` · ${patient.breed}` : ''}
              {' · '}{patient.owner_name}
              {patient.vet_id ? ` · ${patient.vet_id}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'general' && <GeneralTab patient={patient} />}
        {activeTab === 'expediente' && (
          <ExpedienteTab record={record} onUpdated={setRecord} />
        )}
        {activeTab === 'consultas' && (
          <ConsultasTab
            consultations={consultations}
            clinicId={member?.clinicId ?? ''}
            patientId={id ?? ''}
            recordId={record?.id ?? null}
            staffId={member?.id ?? null}
            onAdded={(c) => setConsultations(prev => [c, ...prev])}
          />
        )}
        {activeTab === 'vacunacion' && (
          <VacunacionTab
            vaccinations={vaccinations}
            clinicId={member?.clinicId ?? ''}
            patientId={id ?? ''}
            onAdded={(v) => setVaccinations(prev => [v, ...prev])}
          />
        )}
        {activeTab === 'tratamientos' && (
          <TratamientosTab
            treatments={treatments}
            clinicId={member?.clinicId ?? ''}
            patientId={id ?? ''}
            onAdded={(t) => setTreatments(prev => [t, ...prev])}
            onStatusChange={(tid, status) =>
              setTreatments(prev => prev.map(t => t.id === tid ? { ...t, status } : t))
            }
          />
        )}
        {activeTab === 'documentos' && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>📁</span>
            <p className={styles.emptyLabel}>Documentos no disponibles</p>
            <p className={styles.emptyNote}>Requiere almacenamiento de archivos — próxima fase</p>
          </div>
        )}
      </div>
    </div>
  )
}
