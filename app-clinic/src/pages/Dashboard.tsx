import { Link } from 'react-router-dom'
import styles from './Dashboard.module.css'
import { useClinicAuthContext } from '../contexts/clinicAuthContext'

const VERIFICATION_STATUS: Record<string, { label: string; color: string }> = {
  pending_verification: { label: 'Pendiente de verificación', color: '#b45309' },
  verified:             { label: 'Verificada',                color: '#15803d' },
  suspended:            { label: 'Suspendida',                color: '#b91c1c' },
}

function ClinicCard() {
  const { member } = useClinicAuthContext()
  if (!member) return null

  const status = VERIFICATION_STATUS[member.verificationStatus] ?? VERIFICATION_STATUS.pending_verification

  return (
    <div className={styles.clinicCard}>
      <div className={styles.clinicCardLeft}>
        <span className={styles.clinicCardIcon}>🏥</span>
        <div>
          <strong className={styles.clinicCardName}>{member.clinicName}</strong>
          <span className={styles.clinicCardRole}>{member.role}</span>
        </div>
      </div>
      <span
        className={styles.verificationBadge}
        style={{ color: status.color, borderColor: status.color, background: `${status.color}14` }}
      >
        {status.label}
      </span>
    </div>
  )
}

export default function Dashboard() {
  const QUICK_LINKS = [
    { icon: '🐾', label: 'Registrar paciente', to: '/pacientes', action: 'new' },
    { icon: '🔍', label: 'Buscar por VET-ID',  to: '/pacientes', action: 'search' },
    { icon: '🔔', label: 'Ver solicitudes',     to: '/solicitudes' },
    { icon: '📋', label: 'Nueva consulta',      to: '/consultas' },
  ]

  const SECTIONS = [
    {
      icon: '🐾',
      title: 'Pacientes',
      desc: 'Buscar por VET-ID, ver identidad Vetra, registrar nuevos pacientes de la clínica.',
      to: '/pacientes',
    },
    {
      icon: '🔔',
      title: 'Solicitudes de acceso',
      desc: 'Pedí autorización al propietario para acceder al historial de una mascota.',
      to: '/solicitudes',
    },
    {
      icon: '📋',
      title: 'Consultas',
      desc: 'Registrá consultas: motivo, diagnóstico, tratamiento y observaciones.',
      to: '/consultas',
    },
    {
      icon: '📁',
      title: 'Expedientes',
      desc: 'Historial clínico completo, exclusivo por clínica. Vacunas, antecedentes, alergias.',
      to: '/expedientes',
    },
  ]

  return (
    <div className={styles.page}>
      <ClinicCard />

      {/* Quick access */}
      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Acceso rápido</h2>
        <div className={styles.quickGrid}>
          {QUICK_LINKS.map((q) => (
            <Link key={q.label} to={q.to} className={styles.quickCard}>
              <span className={styles.quickIcon}>{q.icon}</span>
              <span className={styles.quickLabel}>{q.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Module overview */}
      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Módulos</h2>
        <div className={styles.moduleGrid}>
          {SECTIONS.map((s) => (
            <Link key={s.title} to={s.to} className={styles.moduleCard}>
              <span className={styles.moduleIcon}>{s.icon}</span>
              <div>
                <strong className={styles.moduleTitle}>{s.title}</strong>
                <p className={styles.moduleDesc}>{s.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Identity note */}
      <div className={styles.vetraNote}>
        <span className={styles.vetraIcon}>⬡</span>
        <div>
          <strong>Identidad Vetra (VET-ID)</strong>
          <p>
            Identificá pacientes usando su código universal VET-XXXXXX. Con la
            autorización del propietario, accedés a su historial de forma segura.
          </p>
        </div>
      </div>
    </div>
  )
}
