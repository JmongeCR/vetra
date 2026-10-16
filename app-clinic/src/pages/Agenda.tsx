import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listAppointments, createAppointment, updateAppointment, updateAppointmentStatus,
  listStaff,
  STATUS_LABELS, STATUS_COLORS,
  type Appointment, type AppointmentStatus, type ClinicStaff,
} from '../services/appointmentsDb'
import { listPatients, type ClinicPatient } from '../services/patientsDb'
import { useClinicAuthContext } from '../contexts/clinicAuthContext'
import styles from './Agenda.module.css'

// ── Calendar helpers ──────────────────────────────────────────────────────────

const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
const HOUR_PX = 52
const GRID_START = 7 * 60

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function calcTop(isoStr: string): number {
  const d = new Date(isoStr)
  const minutes = d.getHours() * 60 + d.getMinutes()
  return Math.max(0, (minutes - GRID_START) * (HOUR_PX / 60))
}

function calcHeight(startIso: string, endIso: string): number {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const mins = (end.getTime() - start.getTime()) / 60000
  return Math.max(20, mins * (HOUR_PX / 60))
}

function fmtTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

// ── Appointment form ──────────────────────────────────────────────────────────

interface ApptFormState {
  date: string
  startTime: string
  endTime: string
  title: string
  patientId: string
  staffId: string
  reason: string
  notes: string
  status: AppointmentStatus
}

function defaultForm(date?: string, hour?: number): ApptFormState {
  const d = date ?? toLocalDateStr(new Date())
  const h = hour ?? 9
  return {
    date: d,
    startTime: `${String(h).padStart(2, '0')}:00`,
    endTime: `${String(h + 1).padStart(2, '0')}:00`,
    title: '', patientId: '', staffId: '', reason: '', notes: '', status: 'scheduled',
  }
}

function apptToForm(a: Appointment): ApptFormState {
  const start = new Date(a.starts_at)
  const end = new Date(a.ends_at)
  return {
    date: toLocalDateStr(start),
    startTime: start.toTimeString().slice(0, 5),
    endTime: end.toTimeString().slice(0, 5),
    title: a.title, patientId: a.patient_id ?? '', staffId: a.staff_id ?? '',
    reason: a.reason ?? '', notes: a.notes ?? '', status: a.status,
  }
}

interface ApptFormProps {
  form: ApptFormState
  setForm: (f: ApptFormState) => void
  patients: ClinicPatient[]
  staff: ClinicStaff[]
  onClose: () => void
  onSubmit: (e: React.FormEvent) => Promise<void>
  saving: boolean
  error: string
  editing: boolean
  onCancel?: () => void
}

function AppointmentForm({
  form, setForm, patients, staff, onClose, onSubmit, saving, error, editing, onCancel,
}: ApptFormProps) {
  function set(k: keyof ApptFormState, v: string) { setForm({ ...form, [k]: v }) }

  return (
    <div className={styles.panelOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <aside className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>{editing ? 'Editar cita' : 'Nueva cita'}</h2>
          <button className={styles.panelClose} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={e => void onSubmit(e)} className={styles.panelForm} noValidate>
          <div className={styles.panelSection}>
            <h3 className={styles.panelSectionTitle}>Información</h3>
            <div className={styles.panelField}>
              <label>Título *</label>
              <input className={styles.panelInput} value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Ej: Consulta general, Vacunación…" maxLength={100} />
            </div>
            <div className={styles.panelGrid}>
              <div className={styles.panelField}>
                <label>Fecha</label>
                <input type="date" className={styles.panelInput} value={form.date}
                  onChange={e => set('date', e.target.value)} />
              </div>
              <div className={styles.panelField} style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div className={styles.panelField}>
                  <label>Inicio</label>
                  <input type="time" className={styles.panelInput} value={form.startTime}
                    onChange={e => set('startTime', e.target.value)} />
                </div>
                <div className={styles.panelField}>
                  <label>Fin</label>
                  <input type="time" className={styles.panelInput} value={form.endTime}
                    onChange={e => set('endTime', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.panelSection}>
            <h3 className={styles.panelSectionTitle}>Paciente y personal</h3>
            <div className={styles.panelField}>
              <label>Paciente</label>
              <select className={styles.panelInput} value={form.patientId}
                onChange={e => set('patientId', e.target.value)}>
                <option value="">— Sin paciente asignado —</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.owner_name})</option>
                ))}
              </select>
            </div>
            <div className={styles.panelField}>
              <label>Veterinario / Personal</label>
              <select className={styles.panelInput} value={form.staffId}
                onChange={e => set('staffId', e.target.value)}>
                <option value="">— Sin asignar —</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.display_name ?? '(sin nombre)'} · {s.role}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.panelSection}>
            <h3 className={styles.panelSectionTitle}>Detalles</h3>
            <div className={styles.panelField}>
              <label>Motivo</label>
              <input className={styles.panelInput} value={form.reason}
                onChange={e => set('reason', e.target.value)}
                placeholder="Motivo de la cita" maxLength={200} />
            </div>
            {editing && (
              <div className={styles.panelField}>
                <label>Estado</label>
                <select className={styles.panelInput} value={form.status}
                  onChange={e => set('status', e.target.value as AppointmentStatus)}>
                  {(Object.keys(STATUS_LABELS) as AppointmentStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            )}
            <div className={styles.panelField}>
              <label>Notas</label>
              <textarea className={styles.panelTextarea} value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Notas internas" rows={2} />
            </div>
          </div>

          {error && <p className={styles.panelError}>{error}</p>}

          <div className={styles.panelActions}>
            {editing && onCancel && (
              <button type="button" className={styles.btnDanger} onClick={onCancel}>
                Cancelar cita
              </button>
            )}
            <button type="button" className={styles.btnCancel} onClick={onClose}>
              {editing ? 'Cerrar' : 'Cancelar'}
            </button>
            <button type="submit" className={styles.btnSave} disabled={saving}>
              {saving ? 'Guardando…' : (editing ? 'Guardar cambios' : 'Crear cita')}
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}

// ── Week / Day appointment column ─────────────────────────────────────────────

function DayColumn({
  day, appointments, isToday, isFull, onSlotClick, onApptClick,
}: {
  day: Date
  appointments: Appointment[]
  isToday: boolean
  isFull?: boolean
  onSlotClick: (date: string, hour: number) => void
  onApptClick: (a: Appointment) => void
}) {
  const dateStr = toLocalDateStr(day)
  return (
    <div className={`${styles.dayCol} ${isToday ? styles.dayColToday : ''} ${isFull ? styles.dayColFull : ''}`}>
      <div className={styles.dayHeader}>
        <span className={styles.dayName}>{DAY_NAMES[(day.getDay() + 6) % 7]}</span>
        <span className={`${styles.dayNum} ${isToday ? styles.dayNumToday : ''}`}>
          {day.getDate()}
        </span>
      </div>
      <div
        className={styles.dayBody}
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
          const y = e.clientY - rect.top
          const hour = Math.floor(y / HOUR_PX) + 7
          onSlotClick(dateStr, Math.min(17, Math.max(7, hour)))
        }}
      >
        {HOURS.map((_, i) => (
          <div key={i} className={styles.hourLine} style={{ top: `${i * HOUR_PX}px` }} />
        ))}
        {appointments.map(a => {
          const top = calcTop(a.starts_at)
          const height = calcHeight(a.starts_at, a.ends_at)
          const inGrid = top < HOURS.length * HOUR_PX
          if (!inGrid) return null
          return (
            <button
              key={a.id}
              className={styles.apptBlock}
              style={{ top: `${top}px`, height: `${height}px`, backgroundColor: STATUS_COLORS[a.status] }}
              onClick={(e) => { e.stopPropagation(); onApptClick(a) }}
              title={`${fmtTime(a.starts_at)} — ${a.title}`}
            >
              <span className={styles.apptTime}>{fmtTime(a.starts_at)}</span>
              <span className={styles.apptTitle}>{a.title}</span>
              {a.patient_name && <span className={styles.apptPatient}>{a.patient_name}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

type ViewMode = 'week' | 'day' | 'month'

export default function Agenda() {
  const { member } = useClinicAuthContext()
  const navigate = useNavigate()

  const today = new Date()
  const [view, setView] = useState<ViewMode>('week')
  const [weekStart, setWeekStart] = useState(() => getMonday(today))
  const [dayDate, setDayDate] = useState(() => today)
  const [monthDate, setMonthDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients, setPatients] = useState<ClinicPatient[]>([])
  const [staff, setStaff] = useState<ClinicStaff[]>([])
  const [loading, setLoading] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [form, setForm] = useState<ApptFormState>(defaultForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Computed date range for current view
  const { rangeFrom, rangeTo } = (() => {
    if (view === 'week') {
      return { rangeFrom: toLocalDateStr(weekStart) + 'T00:00:00', rangeTo: toLocalDateStr(addDays(weekStart, 6)) + 'T23:59:59' }
    } else if (view === 'day') {
      return { rangeFrom: toLocalDateStr(dayDate) + 'T00:00:00', rangeTo: toLocalDateStr(dayDate) + 'T23:59:59' }
    } else {
      const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
      return { rangeFrom: toLocalDateStr(monthDate) + 'T00:00:00', rangeTo: toLocalDateStr(end) + 'T23:59:59' }
    }
  })()

  const loadAppointments = useCallback(async () => {
    if (!member?.clinicId) return
    setLoading(true)
    const data = await listAppointments(member.clinicId, rangeFrom, rangeTo)
    setAppointments(data)
    setLoading(false)
  }, [member?.clinicId, rangeFrom, rangeTo])

  useEffect(() => { void loadAppointments() }, [loadAppointments])

  useEffect(() => {
    if (!member?.clinicId) return
    void Promise.all([
      listPatients(member.clinicId),
      listStaff(member.clinicId),
    ]).then(([p, s]) => { setPatients(p); setStaff(s) })
  }, [member?.clinicId])

  // Navigation
  function goToToday() {
    setWeekStart(getMonday(today))
    setDayDate(today)
    setMonthDate(new Date(today.getFullYear(), today.getMonth(), 1))
  }
  function goPrev() {
    if (view === 'week') setWeekStart(d => addDays(d, -7))
    else if (view === 'day') setDayDate(d => addDays(d, -1))
    else setMonthDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }
  function goNext() {
    if (view === 'week') setWeekStart(d => addDays(d, 7))
    else if (view === 'day') setDayDate(d => addDays(d, 1))
    else setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }

  function periodLabel(): string {
    if (view === 'week') {
      const end = addDays(weekStart, 6)
      return `${weekStart.getDate()} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`
    } else if (view === 'day') {
      return dayDate.toLocaleDateString('es-CR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    } else {
      return `${MONTH_NAMES[monthDate.getMonth()]} ${monthDate.getFullYear()}`
    }
  }

  function openNewForm(dateStr?: string, hour?: number) {
    setEditing(null)
    setForm(defaultForm(dateStr, hour))
    setFormError('')
    setShowForm(true)
  }

  function openEditForm(a: Appointment) {
    setEditing(a)
    setForm(apptToForm(a))
    setFormError('')
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditing(null) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setFormError('El título es obligatorio.'); return }
    if (!member) { setFormError('Sin sesión activa.'); return }
    if (form.startTime >= form.endTime) { setFormError('La hora de fin debe ser posterior al inicio.'); return }

    setSaving(true); setFormError('')
    const starts_at = new Date(`${form.date}T${form.startTime}`).toISOString()
    const ends_at = new Date(`${form.date}T${form.endTime}`).toISOString()

    if (editing) {
      const res = await updateAppointment(editing.id, {
        patient_id: form.patientId || null,
        staff_id: form.staffId || null,
        title: form.title, reason: form.reason, notes: form.notes,
        starts_at, ends_at,
      })
      if (form.status !== editing.status) {
        await updateAppointmentStatus(editing.id, form.status)
      }
      setSaving(false)
      if (!res.ok) { setFormError(res.error ?? 'Error al guardar'); return }
    } else {
      const res = await createAppointment({
        clinic_id: member.clinicId,
        patient_id: form.patientId || null,
        staff_id: form.staffId || null,
        title: form.title, reason: form.reason, notes: form.notes,
        starts_at, ends_at, created_by: member.id,
      })
      setSaving(false)
      if (!res.ok) { setFormError(res.error); return }
    }
    void loadAppointments()
    closeForm()
  }

  async function handleCancelAppt() {
    if (!editing) return
    const res = await updateAppointmentStatus(editing.id, 'cancelled')
    if (res.ok) { void loadAppointments(); closeForm() }
  }

  function getDayAppointments(day: Date): Appointment[] {
    return appointments.filter(a => isSameDay(new Date(a.starts_at), day))
  }

  // ── Week view ──
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // ── Month view ──
  function buildMonthGrid() {
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = (firstDay.getDay() + 6) % 7 // Monday = 0
    const cells: (Date | null)[] = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  return (
    <div className={styles.page}>
      {showForm && (
        <AppointmentForm
          form={form} setForm={setForm}
          patients={patients} staff={staff}
          onClose={closeForm}
          onSubmit={handleSubmit}
          saving={saving} error={formError}
          editing={!!editing}
          onCancel={editing ? () => void handleCancelAppt() : undefined}
        />
      )}

      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.viewTabs}>
            {(['week', 'day', 'month'] as ViewMode[]).map(v => (
              <button key={v}
                className={`${styles.viewTab} ${view === v ? styles.viewTabActive : ''}`}
                onClick={() => setView(v)}>
                {{ week: 'Semana', day: 'Día', month: 'Mes' }[v]}
              </button>
            ))}
          </div>
          <div className={styles.periodNav}>
            <button className={styles.navBtn} onClick={goPrev}>‹</button>
            <button className={styles.btnToday} onClick={goToToday}>Hoy</button>
            <button className={styles.navBtn} onClick={goNext}>›</button>
          </div>
          <span className={styles.periodLabel}>{periodLabel()}</span>
        </div>
        <button className={styles.btnPrimary} onClick={() => openNewForm()}>
          + Nueva cita
        </button>
      </div>

      {/* ── Views ── */}

      {view === 'week' && (
        <div className={styles.weekGrid}>
          <div className={styles.timeCol}>
            <div className={styles.timeColHeader} />
            <div className={styles.timeBody}>
              {HOURS.map((h, i) => (
                <div key={h} className={styles.timeSlot} style={{ top: `${i * HOUR_PX}px` }}>
                  {i > 0 ? `${h}:00` : ''}
                </div>
              ))}
            </div>
          </div>
          {weekDays.map(day => (
            <DayColumn
              key={day.toISOString()}
              day={day}
              appointments={getDayAppointments(day)}
              isToday={isSameDay(day, today)}
              onSlotClick={openNewForm}
              onApptClick={openEditForm}
            />
          ))}
        </div>
      )}

      {view === 'day' && (
        <div className={styles.weekGrid}>
          <div className={styles.timeCol}>
            <div className={styles.timeColHeader} />
            <div className={styles.timeBody}>
              {HOURS.map((h, i) => (
                <div key={h} className={styles.timeSlot} style={{ top: `${i * HOUR_PX}px` }}>
                  {i > 0 ? `${h}:00` : ''}
                </div>
              ))}
            </div>
          </div>
          <DayColumn
            day={dayDate}
            appointments={getDayAppointments(dayDate)}
            isToday={isSameDay(dayDate, today)}
            isFull
            onSlotClick={openNewForm}
            onApptClick={openEditForm}
          />
        </div>
      )}

      {view === 'month' && (
        <div className={styles.monthGrid}>
          {DAY_NAMES.map(n => (
            <div key={n} className={styles.monthDayName}>{n}</div>
          ))}
          {buildMonthGrid().map((day, idx) => {
            if (!day) return <div key={idx} className={styles.monthCell} />
            const dayAppts = getDayAppointments(day)
            const isToday = isSameDay(day, today)
            return (
              <div
                key={idx}
                className={`${styles.monthCell} ${styles.monthCellActive} ${isToday ? styles.monthCellToday : ''}`}
                onClick={() => { setDayDate(day); setView('day') }}
              >
                <div className={styles.monthDate}>{day.getDate()}</div>
                {dayAppts.slice(0, 3).map(a => (
                  <div
                    key={a.id}
                    className={styles.monthAppt}
                    style={{ backgroundColor: STATUS_COLORS[a.status] }}
                    onClick={e => { e.stopPropagation(); openEditForm(a) }}
                    title={a.title}
                  >
                    {fmtTime(a.starts_at)} {a.title}
                  </div>
                ))}
                {dayAppts.length > 3 && (
                  <div className={styles.monthMore}>+{dayAppts.length - 3}</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {loading && (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
          Cargando citas…
        </p>
      )}
      {!loading && appointments.length === 0 && (
        <div className={styles.emptyNotice}>
          <span className={styles.emptyIcon}>📅</span>
          <p>No hay citas en este período.</p>
          <p><button className={styles.btnPrimary} style={{ marginTop: '0.4rem' }} onClick={() => openNewForm()}>Crear primera cita</button></p>
        </div>
      )}
    </div>
  )
}
