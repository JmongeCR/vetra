import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Patient, PatientSpecies, PatientSex } from '../types/patient'
import { SPECIES_LABELS, SEX_LABELS, SPECIES_EMOJI } from '../types/patient'
import { searchPetByVetId, createAccessRequest, type PassportData } from '../services/clinicDb'
import { useClinicAuthContext } from '../contexts/clinicAuthContext'
import { clinicSupabaseConfigured } from '../lib/supabase'
import styles from './Pacientes.module.css'

// ── Vetra search panel ──────────────────────────────────────────────────────

const SCOPE_OPTIONS = [
  { id: 'basic_data',           label: 'Datos básicos' },
  { id: 'vaccines',             label: 'Vacunas' },
  { id: 'medical_history',      label: 'Historial médico' },
  { id: 'shared_consultations', label: 'Consultas propias' },
  { id: 'authorized_documents', label: 'Documentos' },
]

function VetraSearchPanel() {
  const { member } = useClinicAuthContext()
  const [vetId, setVetId] = useState('')
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<PassportData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['basic_data'])
  const [requesting, setRequesting] = useState(false)
  const [requestStatus, setRequestStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [requestError, setRequestError] = useState('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = vetId.trim().toUpperCase()
    if (!q) return
    setSearching(true)
    setResult(null)
    setNotFound(false)
    setRequestStatus('idle')
    const data = await searchPetByVetId(q)
    setSearching(false)
    if (data) setResult(data)
    else setNotFound(true)
  }

  function toggleScope(id: string) {
    setSelectedScopes((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  async function handleRequestAccess() {
    if (!result || !member) return
    if (selectedScopes.length === 0) { setRequestError('Seleccioná al menos un tipo de acceso.'); return }
    setRequesting(true)
    setRequestError('')
    const res = await createAccessRequest({
      petId: result.id,
      clinicId: member.clinicId,
      scopes: selectedScopes,
      message: `Solicitud desde ${member.clinicName}`,
    })
    setRequesting(false)
    if (res.ok) setRequestStatus('sent')
    else { setRequestStatus('error'); setRequestError(res.error ?? 'Error al enviar') }
  }

  if (!clinicSupabaseConfigured) {
    return (
      <div className={styles.vetraSearchNotice}>
        <strong>Supabase no configurado</strong>
        <p>Agregá PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY en las variables de entorno.</p>
      </div>
    )
  }

  return (
    <div className={styles.vetraSearchPanel}>
      <form onSubmit={(e) => void handleSearch(e)} className={styles.vetSearchForm}>
        <input
          className={styles.vetSearchInput}
          value={vetId}
          onChange={(e) => setVetId(e.target.value.toUpperCase())}
          placeholder="VET-XXXXXXXX"
          maxLength={20}
        />
        <button className={styles.btnPrimary} type="submit" disabled={searching}>
          {searching ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {searching && <p className={styles.vetraHint}>Consultando Vetra…</p>}
      {notFound && <p className={styles.vetraHint}>No se encontró ninguna mascota con ese VET-ID.</p>}

      {result && (
        <div className={styles.vetResultCard}>
          <div className={styles.vetResultHeader}>
            <span className={styles.vetResultName}>{result.name}</span>
            <code className={styles.vetIdBadge}>{result.vet_id}</code>
          </div>
          <p className={styles.vetResultMeta}>
            {result.species}{result.breed ? ` · ${result.breed}` : ''} · {result.sex}
            {result.birth_date ? ` · Nac. ${result.birth_date}` : ''}
          </p>
          <p className={styles.vetResultMeta}>
            Stellar: <strong>{result.stellar_status}</strong>
          </p>

          {requestStatus === 'sent' ? (
            <p className={styles.vetraSuccess}>✓ Solicitud enviada. Visible en Solicitudes una vez respondida por el propietario.</p>
          ) : !member ? (
            <p className={styles.vetraHint}>Iniciá sesión como personal de clínica para solicitar acceso.</p>
          ) : (
            <div className={styles.scopeSelector}>
              <p className={styles.scopeSelectorLabel}>Tipos de acceso a solicitar:</p>
              <div className={styles.scopeOptions}>
                {SCOPE_OPTIONS.map((s) => (
                  <label key={s.id} className={styles.scopeOption}>
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(s.id)}
                      onChange={() => toggleScope(s.id)}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
              {requestError && <p className={styles.panelError}>{requestError}</p>}
              <button
                className={styles.btnPrimary}
                onClick={() => void handleRequestAccess()}
                disabled={requesting || selectedScopes.length === 0}
              >
                {requesting ? 'Enviando…' : 'Solicitar acceso al propietario'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Registration panel ──────────────────────────────────────────────────────

interface PanelProps {
  onClose: () => void
  onSave: (p: Patient) => void
}

const SPECIES_OPTIONS: PatientSpecies[] = ['dog', 'cat', 'bird', 'rabbit', 'reptile', 'other']
const SEX_OPTIONS: PatientSex[] = ['male', 'female', 'unknown']

function RegistrationPanel({ onClose, onSave }: PanelProps) {
  const [form, setForm] = useState({
    name: '', species: 'dog' as PatientSpecies, breed: '',
    sex: 'unknown' as PatientSex, birthDate: '', birthDateEstimated: false,
    microchip: '', ownerName: '', ownerPhone: '', vetId: '',
  })
  const [error, setError] = useState('')

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim())      { setError('El nombre es obligatorio.'); return }
    if (!form.ownerName.trim()) { setError('El responsable es obligatorio.'); return }
    onSave({
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
    })
    onClose()
  }

  return (
    <div className={styles.panelOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <aside className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Registrar paciente</h2>
          <button className={styles.panelClose} onClick={onClose} aria-label="Cerrar">✕</button>
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
  const navigate = useNavigate()
  const [patients, setPatients] = useState<Patient[]>([])
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
        <h1 className={styles.title}>Pacientes</h1>
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

      {searchMode === 'vetra' && <VetraSearchPanel />}

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
                  <p>No hay pacientes registrados en esta clínica.</p>
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
                    <th>VET-ID</th>
                    <th>Ingreso</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      className={styles.row}
                      onClick={() => navigate(`/pacientes/${p.id}`, { state: { patient: p } })}
                      style={{ cursor: 'pointer' }}
                    >
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

          {patients.length > 0 && (
            <p className={styles.count}>
              {filtered.length} paciente{filtered.length !== 1 ? 's' : ''}
            </p>
          )}
        </>
      )}
    </div>
  )
}
