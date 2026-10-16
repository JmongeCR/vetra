import styles from './Stub.module.css'

export default function ConsultasStub() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <span className={styles.icon}>📋</span>
        <h2 className={styles.title}>Consultas</h2>
        <p className={styles.desc}>
          Registrá consultas clínicas: motivo de visita, examen físico, diagnóstico,
          tratamiento y observaciones. Cada consulta queda vinculada al expediente
          de la mascota y al profesional que la atendió.
        </p>
        <span className={styles.badge}>Próxima fase</span>
      </div>
      <div className={styles.features}>
        {[
          'Fecha, hora y profesional',
          'Motivo y síntomas',
          'Diagnóstico y tratamiento',
          'Observaciones y seguimiento',
          'Adjuntar documentos',
        ].map((f) => (
          <div key={f} className={styles.feature}>
            <span className={styles.check}>○</span>
            {f}
          </div>
        ))}
      </div>
    </div>
  )
}
