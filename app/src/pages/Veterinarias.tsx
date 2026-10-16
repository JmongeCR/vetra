import { Link } from "react-router-dom"
import styles from "./Veterinarias.module.css"

export default function Veterinarias() {
	return (
		<div className={styles.page}>
			<div className={styles.content}>
				<div className={styles.badge}>Próximamente</div>
				<h1 className={styles.title}>Vetra Clinic</h1>
				<p className={styles.desc}>
					Una plataforma diseñada para que las clínicas veterinarias identifiquen
					mascotas mediante QR, accedan a su historial autorizado y se conecten
					con sus propietarios de forma segura.
				</p>
				<div className={styles.features}>
					<div className={styles.feature}>
						<span className={styles.featureIcon}>📷</span>
						<div>
							<strong>Identificación por QR</strong>
							<p>Escaneá el pasaporte digital de cualquier mascota al instante.</p>
						</div>
					</div>
					<div className={styles.feature}>
						<span className={styles.featureIcon}>📋</span>
						<div>
							<strong>Acceso autorizado</strong>
							<p>El propietario aprueba qué información compartir con la clínica.</p>
						</div>
					</div>
					<div className={styles.feature}>
						<span className={styles.featureIcon}>🔗</span>
						<div>
							<strong>Conexión verificada</strong>
							<p>Cada acceso queda registrado en la red Stellar de forma trazable.</p>
						</div>
					</div>
				</div>
				<Link to="/" className={styles.back}>← Volver al inicio</Link>
			</div>
		</div>
	)
}
