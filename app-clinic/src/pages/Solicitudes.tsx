import styles from './Solicitudes.module.css'

export default function Solicitudes() {
  const SCOPES = [
    { id: 'basic_data',           label: 'Datos básicos',     desc: 'Nombre, especie, raza, edad, color.' },
    { id: 'vaccines',             label: 'Vacunas',           desc: 'Historial de vacunación.' },
    { id: 'medical_history',      label: 'Historial médico',  desc: 'Consultas y diagnósticos anteriores.' },
    { id: 'shared_consultations', label: 'Consultas propias', desc: 'Las consultas registradas por esta clínica.' },
    { id: 'authorized_documents', label: 'Documentos',        desc: 'Documentos compartidos por el propietario.' },
  ]

  return (
    <div className={styles.page}>
      {/* Empty state */}
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>🔔</span>
        <h2 className={styles.emptyTitle}>Sin solicitudes</h2>
        <p className={styles.emptyDesc}>
          Las solicitudes de acceso enviadas al propietario de una mascota
          aparecerán aquí, junto con su estado.
        </p>
      </div>

      {/* How it works */}
      <section className={styles.howSection}>
        <h2 className={styles.howTitle}>¿Cómo funciona?</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <span className={styles.stepNum}>1</span>
            <div>
              <strong>Identificar la mascota</strong>
              <p>Buscá la mascota por VET-ID en la sección Pacientes.</p>
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>2</span>
            <div>
              <strong>Solicitar acceso</strong>
              <p>
                Elegís qué información necesitás y le enviás la solicitud al
                propietario.
              </p>
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>3</span>
            <div>
              <strong>El propietario decide</strong>
              <p>
                El propietario aprueba o rechaza desde su app Vetra. Si aprueba,
                accedés a la información autorizada.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Scope reference */}
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

      <p className={styles.notice}>
        El sistema de solicitudes requiere que el módulo de autorización esté
        activado en Vetra Core. Disponible en la siguiente fase.
      </p>
    </div>
  )
}
