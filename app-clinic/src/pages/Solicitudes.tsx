import { useState, useEffect } from 'react'
import { fetchClinicAccessRequests, fetchClinicConsents, type ClinicAccessRequest, type ClinicConsent } from '../services/clinicDb'
import { useClinicAuthContext } from '../contexts/clinicAuthContext'
import styles from './Solicitudes.module.css'

const SCOPE_LABELS: Record<string, string> = {
  basic_data:           'Datos básicos',
  vaccines:             'Vacunas',
  medical_history:      'Historial médico',
  shared_consultations: 'Historial de otras clínicas',
  authorized_documents: 'Documentos',
}

const STATUS_LABEL: Record<string, string> = {
  pending:  'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  expired:  'Vencido',
  active:   'Activo',
  revoked:  'Revocado',
}

function StatusPill({ status }: { status: string }) {
  const color: Record<string, string> = {
    pending:  '#b45309',
    approved: '#15803d',
    rejected: '#b91c1c',
    expired:  '#a09990',
    active:   '#15803d',
    revoked:  '#a09990',
  }
  return (
    <span style={{
      fontSize: '0.72rem',
      fontWeight: 700,
      padding: '0.15rem 0.55rem',
      borderRadius: '99px',
      color: color[status] ?? '#a09990',
      background: `${color[status] ?? '#a09990'}18`,
      whiteSpace: 'nowrap',
    }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const SCOPES = [
  { id: 'basic_data',           label: 'Datos básicos',     desc: 'Nombre, especie, raza, edad, color.' },
  { id: 'vaccines',             label: 'Vacunas',           desc: 'Historial de vacunación.' },
  { id: 'medical_history',      label: 'Historial médico',  desc: 'Consultas y diagnósticos anteriores.' },
  { id: 'shared_consultations', label: 'Historial de otras clínicas', desc: 'Permite ver el historial clínico de otras veterinarias que atendieron a esta mascota.' },
  { id: 'authorized_documents', label: 'Documentos',        desc: 'Documentos compartidos por el propietario.' },
]

export default function Solicitudes() {
  const { member } = useClinicAuthContext()
  const [requests, setRequests] = useState<ClinicAccessRequest[]>([])
  const [consents, setConsents] = useState<ClinicConsent[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'requests' | 'consents'>('requests')

  useEffect(() => {
    if (!member) return
    setLoading(true)
    Promise.all([
      fetchClinicAccessRequests(),
      fetchClinicConsents(),
    ]).then(([reqs, cons]) => {
      setRequests(reqs)
      setConsents(cons)
      setLoading(false)
    })
  }, [member])

  const pending  = requests.filter((r) => r.status === 'pending')
  const resolved = requests.filter((r) => r.status !== 'pending')

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-CR', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  if (!member) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🔔</span>
          <h2 className={styles.emptyTitle}>Autenticación requerida</h2>
          <p className={styles.emptyDesc}>
            Iniciá sesión como personal de clínica para ver las solicitudes de acceso.
          </p>
        </div>

        <section className={styles.howSection}>
          <h2 className={styles.howTitle}>¿Cómo funciona?</h2>
          <div className={styles.steps}>
            {[
              ['Identificar la mascota', 'Buscá la mascota por VET-ID en la sección Pacientes.'],
              ['Solicitar acceso', 'Elegís qué información necesitás y le enviás la solicitud al propietario.'],
              ['El propietario decide', 'El propietario aprueba o rechaza desde su app Vetra. Si aprueba, accedés a la información autorizada.'],
            ].map(([title, desc], i) => (
              <div key={i} className={styles.step}>
                <span className={styles.stepNum}>{i + 1}</span>
                <div><strong>{title}</strong><p>{desc}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.scopeSection}>
          <h2 className={styles.howTitle}>Tipos de acceso</h2>
          <div className={styles.scopeGrid}>
            {SCOPES.map((s) => (
              <div key={s.id} className={styles.scopeCard}>
                <strong className={styles.scopeLabel}>{s.label}</strong>
                <p className={styles.scopeDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'requests' ? styles.tabActive : ''}`}
          onClick={() => setTab('requests')}
        >
          Solicitudes {requests.length > 0 && `(${requests.length})`}
        </button>
        <button
          className={`${styles.tab} ${tab === 'consents' ? styles.tabActive : ''}`}
          onClick={() => setTab('consents')}
        >
          Accesos activos {consents.length > 0 && `(${consents.length})`}
        </button>
      </div>

      {loading ? (
        <p className={styles.notice}>Cargando…</p>
      ) : tab === 'requests' ? (
        <>
          {requests.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>🔔</span>
              <h2 className={styles.emptyTitle}>Sin solicitudes</h2>
              <p className={styles.emptyDesc}>
                Las solicitudes enviadas al propietario de una mascota aparecerán aquí.
                Buscá una mascota por VET-ID en Pacientes para iniciar una.
              </p>
            </div>
          ) : (
            <div className={styles.requestList}>
              {pending.length > 0 && <p className={styles.groupLabel}>Pendientes ({pending.length})</p>}
              {[...pending, ...resolved].map((req) => (
                <div key={req.id} className={styles.requestCard}>
                  <div className={styles.requestTop}>
                    <div>
                      <span className={styles.requestPetName}>{req.pet_name ?? req.pet_id}</span>
                      {req.pet_vet_id && <code className={styles.requestVetId}>{req.pet_vet_id}</code>}
                    </div>
                    <StatusPill status={req.status} />
                  </div>
                  <div className={styles.requestScopes}>
                    {req.scopes.map((s) => (
                      <span key={s} className={styles.scopeTag}>{SCOPE_LABELS[s] ?? s}</span>
                    ))}
                  </div>
                  <p className={styles.requestDate}>Solicitado: {formatDate(req.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {consents.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>🔓</span>
              <h2 className={styles.emptyTitle}>Sin accesos activos</h2>
              <p className={styles.emptyDesc}>
                Los accesos aprobados por propietarios aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className={styles.requestList}>
              {consents.map((c) => (
                <div key={c.id} className={styles.requestCard}>
                  <div className={styles.requestTop}>
                    <div>
                      <span className={styles.requestPetName}>{c.pet_name ?? c.pet_id}</span>
                      {c.pet_vet_id && <code className={styles.requestVetId}>{c.pet_vet_id}</code>}
                    </div>
                    <StatusPill status={c.status} />
                  </div>
                  <div className={styles.requestScopes}>
                    {c.scopes.map((s) => (
                      <span key={s} className={styles.scopeTag}>{SCOPE_LABELS[s] ?? s}</span>
                    ))}
                  </div>
                  <p className={styles.requestDate}>Aprobado: {formatDate(c.granted_at)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
