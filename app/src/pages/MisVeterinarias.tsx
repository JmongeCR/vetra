import { useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useWallet } from "../hooks/useWallet"
import styles from "./MisVeterinarias.module.css"

export default function MisVeterinarias() {
	const { address } = useWallet()
	const navigate = useNavigate()

	useEffect(() => {
		if (!address) navigate("/")
	}, [address, navigate])

	const FEATURES = [
		{
			icon: "📷",
			title: "La clínica escanea el QR",
			desc: "El veterinario escanea el código QR del pasaporte de tu mascota para identificarla.",
		},
		{
			icon: "🔔",
			title: "Recibís la solicitud",
			desc: "Vetra te notifica que una clínica quiere acceder a los datos de tu mascota.",
		},
		{
			icon: "✅",
			title: "Vos decidís",
			desc: "Aprobás o rechazás la solicitud. Podés revocar el acceso en cualquier momento.",
		},
	]

	return (
		<div className={styles.page}>
			<div className={styles.pageHeader}>
				<h1 className={styles.pageTitle}>Mis veterinarias</h1>
				<p className={styles.pageSubtitle}>
					Clínicas con acceso autorizado a tus mascotas.
				</p>
			</div>

			<div className={styles.empty}>
				<span className={styles.emptyIcon}>🏥</span>
				<h2 className={styles.emptyTitle}>Sin veterinarias conectadas</h2>
				<p className={styles.emptyDesc}>
					Cuando una clínica solicite acceso a los datos de tu mascota,
					aparecerá aquí. Vos decidís qué pueden ver y por cuánto tiempo.
				</p>
			</div>

			<div className={styles.howSection}>
				<h2 className={styles.howTitle}>¿Cómo funciona el acceso?</h2>
				<div className={styles.howSteps}>
					{FEATURES.map((f) => (
						<div key={f.title} className={styles.step}>
							<span className={styles.stepIcon}>{f.icon}</span>
							<div>
								<strong className={styles.stepTitle}>{f.title}</strong>
								<p className={styles.stepDesc}>{f.desc}</p>
							</div>
						</div>
					))}
				</div>
			</div>

			<div className={styles.cta}>
				<Link to="/autorizaciones" className={styles.btnOutline}>
					Ver mis autorizaciones
				</Link>
				<Link to="/pasaportes" className={styles.btnPrimary}>
					Ver mis pasaportes
				</Link>
			</div>
		</div>
	)
}
