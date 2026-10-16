import { useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import type { Patient } from '../types/patient'
import { SPECIES_LABELS, SEX_LABELS, SPECIES_EMOJI } from '../types/patient'
import styles from './PacienteDetalle.module.css'

type Tab = 'general' | 'expediente' | 'consultas' | 'vacunacion' | 'tratamientos' | 'documentos'

const TABS: { id: Tab; label: string }[] = [
  { id: 'general',       label: 'Datos generales' },
  { id: 'expediente',    label: 'Expediente' },
  { id: 'consultas',     label: 'Consultas' },
  { id: 'vacunacion',    label: 'Vacunación' },
  { id: 'tratamientos',  label: 'Tratamientos' },
  { id: 'documentos',    label: 'Documentos' },
]

function EmptyTab({ icon, label, note }: { icon: string; label: string; note?: string }) {
  return (
    <div className={styles.emptyTab}>
      <span className={styles.emptyTabIcon}>{icon}</span>
      <p className={styles.emptyTabLabel}>{label}</p>
      {note && <span className={styles.emptyTabNote}>{note}</span>}
    </div>
  )
}

function GeneralTab({ patient }: { patient: Patient }) {
  const age = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null

  return (
    <div className={styles.generalGrid}>
      <div className={styles.infoCard}>
        <h3 className={styles.infoCardTitle}>Paciente</h3>
        <dl className={styles.infoList}>
          <div className={styles.infoRow}>
            <dt>Nombre</dt>
            <dd>{patient.name}</dd>
          </div>
          <div className={styles.infoRow}>
            <dt>Especie</dt>
            <dd>{SPECIES_EMOJI[patient.species]} {SPECIES_LABELS[patient.species]}</dd>
          </div>
          {patient.breed && (
            <div className={styles.infoRow}>
              <dt>Raza</dt>
              <dd>{patient.breed}</dd>
            </div>
          )}
          <div className={styles.infoRow}>
            <dt>Sexo</dt>
            <dd>{SEX_LABELS[patient.sex]}</dd>
          </div>
          {patient.birthDate && (
            <div className={styles.infoRow}>
              <dt>Nacimiento</dt>
              <dd>
                {new Date(patient.birthDate + 'T12:00:00').toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' })}
                {patient.birthDateEstimated && <span className={styles.estimated}> (estimado)</span>}
                {age !== null && <span className={styles.ageTag}>{age} año{age !== 1 ? 's' : ''}</span>}
              </dd>
            </div>
          )}
          {patient.microchip && (
            <div className={styles.infoRow}>
              <dt>Microchip</dt>
              <dd><code>{patient.microchip}</code></dd>
            </div>
          )}
          {patient.vetId && (
            <div className={styles.infoRow}>
              <dt>VET-ID</dt>
              <dd><code className={styles.vetId}>{patient.vetId}</code></dd>
            </div>
          )}
        </dl>
      </div>

      <div className={styles.infoCard}>
        <h3 className={styles.infoCardTitle}>Responsable</h3>
        <dl className={styles.infoList}>
          <div className={styles.infoRow}>
            <dt>Nombre</dt>
            <dd>{patient.ownerName}</dd>
          </div>
          {patient.ownerPhone && (
            <div className={styles.infoRow}>
              <dt>Teléfono</dt>
              <dd>{patient.ownerPhone}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className={styles.infoCard}>
        <h3 className={styles.infoCardTitle}>Registro</h3>
        <dl className={styles.infoList}>
          <div className={styles.infoRow}>
            <dt>Ingreso</dt>
            <dd>{new Date(patient.registeredAt).toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' })}</dd>
          </div>
          <div className={styles.infoRow}>
            <dt>Estado</dt>
            <dd><span className={styles.statusBadge}>Activo</span></dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

export default function PacienteDetalle() {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('general')

  const patient = location.state?.patient as Patient | undefined

  if (!patient) {
    return (
      <div className={styles.notFound}>
        <span className={styles.notFoundIcon}>🐾</span>
        <h2>Paciente no encontrado</h2>
        <p>El paciente puede haber sido eliminado o la sesión expiró.</p>
        <button className={styles.btnBack} onClick={() => navigate('/pacientes')}>
          ← Volver a Pacientes
        </button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/pacientes')}>
          ← Pacientes
        </button>
        <div className={styles.headerInfo}>
          <span className={styles.speciesIcon}>{SPECIES_EMOJI[patient.species]}</span>
          <div>
            <h1 className={styles.patientName}>{patient.name}</h1>
            <span className={styles.patientMeta}>
              {SPECIES_LABELS[patient.species]}
              {patient.breed ? ` · ${patient.breed}` : ''}
              {patient.vetId ? ` · ${patient.vetId}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
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

      {/* ── Tab content ── */}
      <div className={styles.tabContent}>
        {activeTab === 'general'      && <GeneralTab patient={patient} />}
        {activeTab === 'expediente'   && <EmptyTab icon="📁" label="Sin expediente registrado" note="Próxima fase — requiere Vetra Core" />}
        {activeTab === 'consultas'    && <EmptyTab icon="📋" label="Sin consultas registradas" note="Próxima fase — requiere Vetra Core" />}
        {activeTab === 'vacunacion'   && <EmptyTab icon="💉" label="Sin vacunas registradas" note="Próxima fase — requiere Vetra Core" />}
        {activeTab === 'tratamientos' && <EmptyTab icon="💊" label="Sin tratamientos registrados" note="Próxima fase — requiere Vetra Core" />}
        {activeTab === 'documentos'   && <EmptyTab icon="📄" label="Sin documentos adjuntos" note="Próxima fase — requiere Vetra Core" />}
      </div>
    </div>
  )
}
