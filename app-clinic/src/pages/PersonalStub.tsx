import styles from './Stub.module.css'

export default function PersonalStub() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <span className={styles.icon}>👥</span>
        <h2 className={styles.title}>Personal</h2>
        <p className={styles.desc}>
          Administrá el personal de la clínica: veterinarios, recepcionistas y
          administradores. Cada rol tiene permisos diferenciados sobre los expedientes
          y funciones del sistema.
        </p>
        <span className={styles.badge}>Próxima fase</span>
      </div>
      <div className={styles.features}>
        {[
          'Roles: admin, veterinario, recepción',
          'Permisos por módulo',
          'Acceso por clínica',
          'Historial de actividad',
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
