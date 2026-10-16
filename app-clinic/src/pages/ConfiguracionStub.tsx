import styles from './Stub.module.css'

export default function ConfiguracionStub() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <span className={styles.icon}>⚙️</span>
        <h2 className={styles.title}>Configuración</h2>
        <p className={styles.desc}>
          Ajustá los datos de la clínica: nombre, dirección, teléfono, correo y código
          de registro. También podés configurar la integración con Vetra Core para
          el sistema de autorizaciones.
        </p>
        <span className={styles.badge}>Próxima fase</span>
      </div>
      <div className={styles.features}>
        {[
          'Datos de la clínica',
          'Información de contacto',
          'Código de registro',
          'Integración con Vetra Core',
          'Preferencias del sistema',
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
