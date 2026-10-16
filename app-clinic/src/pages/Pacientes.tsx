import { useState } from 'react'
import type { Patient, PatientSpecies, PatientSex } from '../types/patient'
import { SPECIES_LABELS, SEX_LABELS, SPECIES_EMOJI } from '../types/patient'
import styles from './Pacientes.module.css'

// ── Demo data ───────────────────────────────────────────────────────────────
// This is FICTIONAL prototype data. No real patient or owner information.
// These records will be replaced by a real database in Sprint 3 (Vetra Core).

const DEMO_PATIENTS: Patient[] = [
  {
    id: '1a2b3c4d-0001',
    name: 'Max',
    species: 'dog',
    breed: 'Labrador Retriever',
    sex: 'male',
    birthDate: '2020-03-15',
    birthDateEstimated: false,
    ownerName: 'Andrés García',
    ownerPhone: '+506 8800-0001',
    registeredAt: '2024-01-10T08:00:00Z',
    microchip: '941000020000001',
  },
  {
    id: '1a2b3c4d-0002',
    vetId: 'VET-000001',
    name: 'Mia',
    species: 'cat',
    breed: 'Siamés',
    sex: 'female',
    birthDate: '2021-07-22',
    birthDateEstimated: false,
    ownerName: 'Lucía Mora',
    ownerPhone: '+506 8800-0002',
    registeredAt: '2024-02-14T09:30:00Z',
  },
  {
    id: '1a2b3c4d-0003',
    name: 'Rocky',
    species: 'dog',
    breed: 'Bulldog Francés',
    sex: 'male',
    birthDate: '2022-01-05',
    birthDateEstimated: true,
    ownerName: 'Carlos Vega',
    ownerPhone: '+506 8800-0003',
    registeredAt: '2024-03-20T11:00:00Z',
  },
  {
    id: '1a2b3c4d-0004',
    name: 'Luna',
    species: 'rabbit',
    breed: 'Holandés enano',
    sex: 'female',
    birthDate: '2023-05-10',
    ownerName: 'Sofía Jiménez',
    ownerPhone: '+506 8800-0004',
    registeredAt: '2024-04-01T10:00:00Z',
  },
  {
    id: '1a2b3c4d-0005',
    vetId: 'VET-000002',
    name: 'Pisco',
    species: 'bird',
    breed: 'Loro amazónico',
    sex: 'unknown',
    birthDate: '2019-11-30',
    ownerName: 'Diego Rojas',
    ownerPhone: '+506 8800-0005',
    registeredAt: '2024-05-07T14:00:00Z',
  },
]

// ── Registration panel ──────────────────────────────────────────────────────

interface PanelProps {
  onClose: () => void
  onSave: (p: Patient) => void
}

const SPECIES_OPTIONS: PatientSpecies[] = ['dog', 'cat', 'bird', 'rabbit', 'reptile', 'other']
const SEX_OPTIONS: PatientSex[] = ['male', 'female', 'unknown']

function RegistrationPanel({ onClose, onSave }: PanelProps) {
  const [form, setForm] = useState({
    name: '',
    species: 'dog' as PatientSpecies,
    breed: '',
    sex: 'unknown' as PatientSex,
    birthDate: '',
    birthDateEstimated: false,
    microchip: '',
    ownerName: '',
    ownerPhone: '',
    vetId: '',
  })
  const [error, setError] = useState('')

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('El nombre es obligatorio.'); return }
    if (!form.ownerName.trim()) { setError('El responsable es obligatorio.'); return }
    const patient: Patient = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      species: form.species,
      breed: form.breed.trim() || undefined,
      sex: form.sex,
      birthDate: form.birthDate || undefined,
      birthDateEstimated: form.birthDateEstimated,
      microchip: form.microchip.trim() || undefined,
      ownerName: form.ownerName.trim(),
      ownerPhone: form.ownerPhone.trim(),
      vetId: form.vetId.trim() || undefined,
      registeredAt: new Date().toISOString(),
    }
    onSave(patient)
    onClose()
  }

  return (
    <div className={styles.panelOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <aside className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Registrar paciente</h2>
          <button className={styles.panelClose} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className={styles.panelNotice}>
          <strong>⚠️ Prototipo</strong>
          <p>Los datos ingresados son ficticios y solo se guardan en memoria para esta sesión.
          En Sprint 3 se conectará a la base de datos de la clínica.</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.panelForm} noValidate>
          <div className={styles.panelSection}>
            <h3 className={styles.panelSectionTitle}>Paciente</h3>
            <div className={styles.panelGrid}>
              <div className={styles.panelField}>
                <label>Nombre *</label>
                <input className={styles.panelInput} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre del animal" maxLength={60} />
              </div>
              <div className={styles.panelField}>
                <label>Especie *</label>
                <select className={styles.panelInput} value={form.species} onChange={e => set('species', e.target.value as PatientSpecies)}>
                  {SPECIES_OPTIONS.map(s => <option key={s} value={s}>{SPECIES_LABELS[s]}</option>)}
                </select>
              </div>
              <div className={styles.panelField}>
                <label>Raza</label>
                <input className={styles.panelInput} value={form.breed} onChange={e => set('breed', e.target.value)} placeholder="Opcional" maxLength={80} />
              </div>
              <div className={styles.panelField}>
                <label>Sexo</label>
                <select className={styles.panelInput} value={form.sex} onChange={e => set('sex', e.target.value as PatientSex)}>
                  {SEX_OPTIONS.map(s => <option key={s} value={s}>{SEX_LABELS[s]}</option>)}
                </select>
              </div>
              <div className={styles.panelField}>
                <label>Fecha de nacimiento</label>
                <input type="date" className={styles.panelInput} value={form.birthDate} onChange={e => set('birthDate', e.target.value)} max={new Date().toISOString().split('T')[0]} />
              </div>
              <div className={styles.panelField}>
                <label>Microchip</label>
                <input className={styles.panelInput} value={form.microchip} onChange={e => set('microchip', e.target.value)} placeholder="ISO 11784" maxLength={20} />
              </div>
            </div>
          </div>

          <div className={styles.panelSection}>
            <h3 className={styles.panelSectionTitle}>Responsable</h3>
            <div className={styles.panelGrid}>
              <div className={styles.panelField}>
                <label>Nombre *</label>
                <input className={styles.panelInput} value={form.ownerName} onChange={e => set('ownerName', e.target.value)} placeholder="Nombre completo" maxLength={80} />
              </div>
              <div className={styles.panelField}>
                <label>Teléfono</label>
                <input className={styles.panelInput} value={form.ownerPhone} onChange={e => set('ownerPhone', e.target.value)} placeholder="+506 8800-0000" maxLength={20} />
              </div>
            </div>
          </div>

          <div className={styles.panelSection}>
            <h3 className={styles.panelSectionTitle}>Identidad Vetra</h3>
            <div className={styles.panelField}>
              <label>ID Universal (VET-XXXXXX)</label>
              <input className={styles.panelInput} value={form.vetId} onChange={e => set('vetId', e.target.value.toUpperCase())} placeholder="Vincular si ya existe" maxLength={12} />
            </div>
            <p className={styles.panelHint}>
              Si el propietario ya tiene un registro en Vetra, ingresá el ID para vincularlo.
              La verificación automática estará disponible en Sprint 3.
            </p>
          </div>

          {error && <p className={styles.panelError}>{error}</p>}

          <div className={styles.panelActions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnSave}>Registrar paciente</button>
          </div>
        </form>
      </aside>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

type SearchMode = 'mine' | 'vetra'

export default function Pacientes() {
  const [patients, setPatients] = useState<Patient[]>(DEMO_PATIENTS)
  const [query, setQuery] = useState('')
  const [speciesFilter, setSpeciesFilter] = useState<PatientSpecies | ''>('')
  const [searchMode, setSearchMode] = useState<SearchMode>('mine')
  const [showPanel, setShowPanel] = useState(false)

  function handleSave(p: Patient) {
    setPatients(prev => [p, ...prev])
  }

  const filtered = patients.filter((p) => {
    const q = query.toLowerCase()
    if (q) {
      const match =
        p.name.toLowerCase().includes(q) ||
        (p.vetId ?? '').toLowerCase().includes(q) ||
        (p.microchip ?? '').includes(q) ||
        p.ownerName.toLowerCase().includes(q)
      if (!match) return false
    }
    if (speciesFilter && p.species !== speciesFilter) return false
    return true
  })

  return (
    <div className={styles.page}>
      {showPanel && (
        <RegistrationPanel onClose={() => setShowPanel(false)} onSave={handleSave} />
      )}

      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.title}>Pacientes</h1>
          <span className={styles.prototypeBadge}>Prototipo · Datos ficticios</span>
        </div>
        <button className={styles.btnPrimary} onClick={() => setShowPanel(true)}>
          + Registrar paciente
        </button>
      </div>

      {/* ── Search bar + filters ── */}
      <div className={styles.searchBar}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Buscar por nombre, ID, microchip o responsable…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={speciesFilter}
          onChange={(e) => setSpeciesFilter(e.target.value as PatientSpecies | '')}
        >
          <option value="">Todas las especies</option>
          {(Object.entries(SPECIES_LABELS) as [PatientSpecies, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* ── Mode tabs ── */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${searchMode === 'mine' ? styles.tabActive : ''}`}
          onClick={() => setSearchMode('mine')}
        >
          🏥 Mis pacientes
        </button>
        <button
          className={`${styles.tab} ${searchMode === 'vetra' ? styles.tabActive : ''}`}
          onClick={() => setSearchMode('vetra')}
        >
          🔍 Buscar en Vetra
        </button>
      </div>

      {searchMode === 'vetra' && (
        <div className={styles.vetraSearchNotice}>
          <strong>Búsqueda en Vetra</strong>
          <p>
            Esta función permitirá consultar identidades universales VET-XXXXXX registradas
            en Vetra Core, sin acceso automático a expedientes de otras clínicas.
            Disponible en Sprint 3 una vez que Vetra Core API esté implementado.
          </p>
        </div>
      )}

      {searchMode === 'mine' && (
        <>
          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>🐾</span>
              {query || speciesFilter ? (
                <>
                  <p>No se encontraron pacientes con ese criterio.</p>
                  <button className={styles.btnClear} onClick={() => { setQuery(''); setSpeciesFilter('') }}>
                    Limpiar filtros
                  </button>
                </>
              ) : (
                <>
                  <p>No hay pacientes registrados todavía.</p>
                  <button className={styles.btnPrimary} onClick={() => setShowPanel(true)}>
                    Registrar primer paciente
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Especie / Raza</th>
                    <th>Responsable</th>
                    <th>Microchip</th>
                    <th>ID Vetra</th>
                    <th>Ingreso</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className={styles.row}>
                      <td>
                        <div className={styles.patientCell}>
                          <span className={styles.speciesEmoji}>{SPECIES_EMOJI[p.species]}</span>
                          <div>
                            <strong>{p.name}</strong>
                            <span className={styles.sexMeta}>{SEX_LABELS[p.sex]}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {SPECIES_LABELS[p.species]}
                        {p.breed && <span className={styles.breedMeta}> · {p.breed}</span>}
                      </td>
                      <td>
                        <div className={styles.ownerCell}>
                          <span>{p.ownerName}</span>
                          <span className={styles.phoneMeta}>{p.ownerPhone}</span>
                        </div>
                      </td>
                      <td>
                        {p.microchip
                          ? <code className={styles.code}>{p.microchip}</code>
                          : <span className={styles.na}>—</span>}
                      </td>
                      <td>
                        {p.vetId
                          ? <code className={styles.vetId}>{p.vetId}</code>
                          : <span className={styles.na}>—</span>}
                      </td>
                      <td className={styles.dateCell}>
                        {new Date(p.registeredAt).toLocaleDateString('es-CR', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className={styles.count}>
            {filtered.length} paciente{filtered.length !== 1 ? 's' : ''} · datos ficticios
          </p>
        </>
      )}
    </div>
  )
}
