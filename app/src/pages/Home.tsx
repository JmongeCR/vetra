import { useWallet } from "../hooks/useWallet"
import styles from "./Home.module.css"

const Home = () => {
	const { address } = useWallet()

	return (
		<div className={styles.Home}>
			<section className={styles.hero}>
				<div className={styles.heroContent}>
					<div className={styles.badge}>Identidad digital veterinaria</div>
					<h1 className={styles.heroTitle}>
						Una identidad,<br />
						<span className={styles.heroAccent}>toda una vida.</span>
					</h1>
					<p className={styles.heroSubtitle}>
						Cada mascota merece un historial médico seguro, verificable y accesible
						en cualquier momento. Vetra conecta a propietarios y veterinarias
						mediante una identidad digital única y permanente.
					</p>
					<div className={styles.heroActions}>
						{address ? (
							<>
								<a href="/mascotas" className={styles.btnPrimary}>
									Mis mascotas
								</a>
								<a href="/pasaporte" className={styles.btnSecondary}>
									Ver pasaporte
								</a>
							</>
						) : (
							<>
								<span className={styles.btnHint}>
									Iniciá sesión para comenzar
								</span>
							</>
						)}
					</div>
				</div>
				<div className={styles.heroVisual}>
					<div className={styles.petCard}>
						<div className={styles.petCardHeader}>
							<div className={styles.petAvatar}>🐾</div>
							<div>
								<div className={styles.petName}>Luna</div>
								<div className={styles.petBreed}>Golden Retriever · 4 años</div>
							</div>
							<div className={styles.petIdBadge}>VET-000124</div>
						</div>
						<div className={styles.petCardBody}>
							<div className={styles.petStat}>
								<span className={styles.petStatLabel}>Última consulta</span>
								<span className={styles.petStatValue}>14 oct 2026</span>
							</div>
							<div className={styles.petStat}>
								<span className={styles.petStatLabel}>Vacunas al día</span>
								<span className={styles.petStatValueOk}>✓ Al día</span>
							</div>
							<div className={styles.petStat}>
								<span className={styles.petStatLabel}>Clínicas registradas</span>
								<span className={styles.petStatValue}>2 veterinarias</span>
							</div>
						</div>
						<div className={styles.petCardFooter}>
							<div className={styles.qrPlaceholder}>
								<div className={styles.qrGrid}>
									{Array.from({ length: 25 }).map((_, i) => (
										<div
											key={i}
											className={styles.qrCell}
											style={{ opacity: Math.random() > 0.4 ? 1 : 0.15 }}
										/>
									))}
								</div>
							</div>
							<span className={styles.petCardFooterText}>Pasaporte digital</span>
						</div>
					</div>
				</div>
			</section>

			<section className={styles.features}>
				<h2 className={styles.sectionTitle}>Todo en un solo lugar</h2>
				<div className={styles.featureGrid}>
					<div className={styles.featureCard}>
						<div className={styles.featureIcon}>🆔</div>
						<h3>Identidad universal</h3>
						<p>
							Cada mascota recibe un identificador único y permanente
							que la acompaña toda la vida, sin importar la veterinaria.
						</p>
					</div>
					<div className={styles.featureCard}>
						<div className={styles.featureIcon}>📋</div>
						<h3>Historial consolidado</h3>
						<p>
							Consultá el historial médico completo de tu mascota,
							unificado de todas las clínicas autorizadas.
						</p>
					</div>
					<div className={styles.featureCard}>
						<div className={styles.featureIcon}>💉</div>
						<h3>Vacunas y certificados</h3>
						<p>
							Seguí las vacunas al día y descargá certificados verificables
							en cualquier momento.
						</p>
					</div>
					<div className={styles.featureCard}>
						<div className={styles.featureIcon}>📅</div>
						<h3>Citas veterinarias</h3>
						<p>
							Solicitá citas con tus veterinarias favoritas y recibí
							recordatorios de controles y vacunaciones.
						</p>
					</div>
					<div className={styles.featureCard}>
						<div className={styles.featureIcon}>🔒</div>
						<h3>Control de acceso</h3>
						<p>
							Vos decidís qué clínicas pueden ver el historial de tu mascota.
							Tus datos, bajo tu control.
						</p>
					</div>
					<div className={styles.featureCard}>
						<div className={styles.featureIcon}>📱</div>
						<h3>Pasaporte digital</h3>
						<p>
							Compartí el código QR de tu mascota para identificarla al
							instante en cualquier veterinaria.
						</p>
					</div>
				</div>
			</section>

			<section className={styles.cta}>
				<div className={styles.ctaContent}>
					<h2>Empezá hoy</h2>
					<p>
						Registrá a tu mascota y llevá su historial médico siempre con vos.
					</p>
					<p className={styles.ctaNote}>
						Iniciá sesión con tu correo electrónico — no necesitás extensiones
						ni configuración adicional.
					</p>
				</div>
			</section>
		</div>
	)
}

export default Home
