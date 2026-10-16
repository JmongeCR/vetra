import styles from './Stub.module.css'

export default function ExpedientesStub() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <span className={styles.icon}>📁</span>
        <h2 className={styles.title}>Expedientes clínicos</h2>
        <p className={styles.desc}>
          El expediente de cada paciente es exclusivo de esta clínica. Incluye
          antecedentes, alergias, condiciones crónicas, historial de vacunas y todas
          las consultas registradas. Ninguna otra clínica puede acceder sin
          autorización del propietario.
        </p>
        <span className={styles.badge}>Próxima fase</span>
      </div>
      <div className={styles.features}>
        {[
          'Antecedentes y alergias',
          'Historial de vacunas',
          'Todas las consultas',
          'Documentos adjuntos',
          'Aislado por clínica',
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
