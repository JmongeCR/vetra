import { Link } from "react-router-dom"
import { useCavosState } from "../cavos/context"
import { useWallet } from "../hooks/useWallet"
import styles from "./Home.module.css"

const QR_PATTERN = [1,0,1,1,0,0,1,0,1,0,0,1,1,0,1,1,1,0,0,1,1,0,1,0,1]

const Home = () => {
	const { address } = useWallet()
	const cavos = useCavosState()

	return (
		<div className={styles.Home}>

			{/* ── HERO ──────────────────────────────────────────────────────── */}
			<section className={styles.hero}>
				<div className={styles.heroContent}>
					<div className={styles.badge}>Identidad digital veterinaria</div>
					<h1 className={styles.heroTitle}>
						Toda la vida de tu mascota,
						<br />
						<span className={styles.heroAccent}>en un solo lugar.</span>
					</h1>
					<p className={styles.heroSubtitle}>
						Su identidad, su pasaporte digital y su información veterinaria,
						siempre a tu alcance.
					</p>
					<div className={styles.heroActions}>
						{address ? (
							<>
								<Link to="/mascotas/nueva" className={styles.btnPrimary}>
									Registrar mi mascota
								</Link>
								<Link to="/pasaporte" className={styles.btnSecondary}>
									Consultar un pasaporte
								</Link>
							</>
						) : (
							<>
								<button
									onClick={() => cavos?.signIn()}
									className={styles.btnPrimary}
								>
									Registrar mi mascota
								</button>
								<Link to="/pasaporte" className={styles.btnSecondary}>
									Consultar un pasaporte
								</Link>
							</>
						)}
					</div>
				</div>

				<div className={styles.heroVisual}>
					<div className={styles.passportCard}>
						<div className={styles.passportTop}>
							<span className={styles.passportBrand}>⬡ Vetra</span>
							<span className={styles.passportLabel}>Pasaporte Digital</span>
						</div>
						<div className={styles.passportHero}>
							<div className={styles.passportAvatarWrap}>
								<span className={styles.passportEmoji}>🐕</span>
							</div>
							<div className={styles.passportMeta}>
								<div className={styles.passportPetName}>Luna</div>
								<div className={styles.passportPetBreed}>Golden Retriever · Hembra</div>
								<div className={styles.passportVetId}>VET-2Z747NJG</div>
							</div>
						</div>
						<div className={styles.passportRow}>
							<div className={styles.passportField}>
								<span className={styles.passportFieldLabel}>Especie</span>
								<span className={styles.passportFieldValue}>Perro</span>
							</div>
							<div className={styles.passportField}>
								<span className={styles.passportFieldLabel}>Color</span>
								<span className={styles.passportFieldValue}>Dorado</span>
							</div>
							<div className={styles.passportField}>
								<span className={styles.passportFieldLabel}>Desde</span>
								<span className={styles.passportFieldValue}>2021</span>
							</div>
						</div>
						<div className={styles.passportVerified}>
							<span className={styles.passportVerifiedDot} />
							Registrada en Stellar Testnet
						</div>
						<div className={styles.passportBottom}>
							<div className={styles.qrMini}>
								{QR_PATTERN.map((on, i) => (
									<div
										key={i}
										className={styles.qrCell}
										style={{ opacity: on ? 1 : 0.08 }}
									/>
								))}
							</div>
							<div className={styles.passportQrLabel}>Escanear para verificar</div>
						</div>
					</div>
				</div>
			</section>

			{/* ── CÓMO FUNCIONA ─────────────────────────────────────────────── */}
			<section className={styles.howItWorks} id="como-funciona">
				<div className={styles.sectionHeader}>
					<h2 className={styles.sectionTitle}>Cómo funciona</h2>
					<p className={styles.sectionSubtitle}>
						En tres pasos, tu mascota tiene su identidad digital permanente.
					</p>
				</div>
				<div className={styles.stepsGrid}>
					<div className={styles.step}>
						<div className={styles.stepNum}>01</div>
						<div className={styles.stepIcon}>🐾</div>
						<h3 className={styles.stepTitle}>Registrá tu mascota</h3>
						<p className={styles.stepDesc}>
							Ingresá los datos básicos de tu mascota. Vetra le asigna un
							identificador único que la acompaña toda la vida.
						</p>
					</div>
					<div className={styles.stepArrow} aria-hidden="true">→</div>
					<div className={styles.step}>
						<div className={styles.stepNum}>02</div>
						<div className={styles.stepIcon}>🪪</div>
						<h3 className={styles.stepTitle}>Obtené su identidad digital</h3>
						<p className={styles.stepDesc}>
							Se genera su pasaporte digital con código QR, certificado en la
							red Stellar para garantizar su autenticidad.
						</p>
					</div>
					<div className={styles.stepArrow} aria-hidden="true">→</div>
					<div className={styles.step}>
						<div className={styles.stepNum}>03</div>
						<div className={styles.stepIcon}>📤</div>
						<h3 className={styles.stepTitle}>Compartí cuando lo necesités</h3>
						<p className={styles.stepDesc}>
							Mostrá el QR en cualquier veterinaria para que accedan a la
							información que vos autorizás.
						</p>
					</div>
				</div>
			</section>

			{/* ── BENEFICIOS ────────────────────────────────────────────────── */}
			<section className={styles.benefits}>
				<div className={styles.sectionHeader}>
					<h2 className={styles.sectionTitle}>Por qué Vetra</h2>
					<p className={styles.sectionSubtitle}>
						Diseñado para que vos y tu mascota estén siempre conectados.
					</p>
				</div>
				<div className={styles.benefitsGrid}>
					<div className={styles.benefitCard}>
						<div className={styles.benefitIcon}>🆔</div>
						<h3>Identidad digital única</h3>
						<p>Un identificador permanente para cada mascota, válido en todas las clínicas.</p>
					</div>
					<div className={styles.benefitCard}>
						<div className={styles.benefitIcon}>✅</div>
						<h3>Pasaporte verificable</h3>
						<p>Certificado en blockchain. Cualquier clínica puede validarlo al instante con el QR.</p>
					</div>
					<div className={styles.benefitCard}>
						<div className={styles.benefitIcon}>📂</div>
						<h3>Información organizada</h3>
						<p>Todo centralizado — sin papeles perdidos ni historiales repartidos entre clínicas.</p>
					</div>
					<div className={styles.benefitCard}>
						<div className={styles.benefitIcon}>🔒</div>
						<h3>Control de acceso</h3>
						<p>Vos decidís qué veterinarias ven la información de tu mascota. Tus datos, bajo tu control.</p>
					</div>
					<div className={styles.benefitCard}>
						<div className={styles.benefitIcon}>🏥</div>
						<h3>Conexión con veterinarias</h3>
						<p>Las clínicas identifican a tu mascota y solicitan acceso autorizado de forma segura.</p>
					</div>
				</div>
			</section>

			{/* ── PARA VETERINARIAS ─────────────────────────────────────────── */}
			<section className={styles.vets} id="veterinarias">
				<div className={styles.vetsInner}>
					<div className={styles.vetsText}>
						<div className={styles.vetsBadge}>Para clínicas</div>
						<h2 className={styles.vetsTitle}>
							Una mejor conexión entre veterinarias y propietarios.
						</h2>
						<p className={styles.vetsDesc}>
							Con Vetra Clinic, las clínicas identifican mascotas al instante
							mediante su código QR y solicitan acceso autorizado al historial
							veterinario. Sin papeleo, sin demoras.
						</p>
						<Link to="/veterinarias" className={styles.btnPrimaryWhite}>
							Conocer Vetra Clinic
						</Link>
					</div>
					<div className={styles.vetsIllustration}>
						<div className={styles.flowCard}>
							<div className={styles.flowStep}>
								<span className={styles.flowIcon}>📷</span>
								<span className={styles.flowLabel}>Clínica escanea el QR</span>
							</div>
							<div className={styles.flowConnector}>↓</div>
							<div className={styles.flowStep}>
								<span className={styles.flowIcon}>🔔</span>
								<span className={styles.flowLabel}>Propietario recibe solicitud</span>
							</div>
							<div className={styles.flowConnector}>↓</div>
							<div className={styles.flowStep}>
								<span className={styles.flowIcon}>✅</span>
								<span className={styles.flowLabel}>Acceso autorizado</span>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* ── CTA ───────────────────────────────────────────────────────── */}
			<section className={styles.cta}>
				<div className={styles.ctaContent}>
					<h2>Empezá hoy</h2>
					<p>
						Registrá a tu mascota y llevá su identidad siempre con vos.
					</p>
					{address ? (
						<Link to="/mascotas/nueva" className={styles.ctaBtn}>
							Registrar mi mascota
						</Link>
					) : (
						<button onClick={() => cavos?.signIn()} className={styles.ctaBtn}>
							Crear mi cuenta gratis
						</button>
					)}
					<p className={styles.ctaNote}>
						Ingresá con tu correo electrónico — no necesitás extensiones ni
						configuración adicional.
					</p>
				</div>
			</section>

		</div>
	)
}

export default Home
