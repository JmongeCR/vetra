import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useWallet } from "../hooks/useWallet"
import { useSupabaseAuth } from "../hooks/useSupabaseAuth"
import { fetchConsents, revokeConsent } from "../services/authorizationDb"
import type { Consent } from "../services/authorizationDb"
import styles from "./MisVeterinarias.module.css"

const SCOPE_LABELS: Record<string, string> = {
	basic_data: "Datos básicos",
	vaccines: "Vacunas",
	medical_history: "Historial",
	shared_consultations: "Consultas",
	authorized_documents: "Documentos",
}

export default function MisVeterinarias() {
	const { address } = useWallet()
	const { isAuthenticated } = useSupabaseAuth()
	const navigate = useNavigate()
	const [consents, setConsents] = useState<Consent[]>([])
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		if (!address) navigate("/")
	}, [address, navigate])

	useEffect(() => {
		if (!address || !isAuthenticated) return
		setLoading(true)
		void fetchConsents("active").then((data) => {
			setConsents(data)
			setLoading(false)
		})
	}, [address, isAuthenticated])

	async function handleRevoke(id: string) {
		const result = await revokeConsent(id)
		if (result.ok) setConsents((prev) => prev.filter((c) => c.id !== id))
	}

	return (
		<div className={styles.page}>
			<div className={styles.pageHeader}>
				<h1 className={styles.pageTitle}>Mis veterinarias</h1>
				<p className={styles.pageSubtitle}>
					Clínicas con acceso autorizado a tus mascotas.
				</p>
			</div>

			{loading ? (
				<div className={styles.empty}>
					<span className={styles.emptyIcon}>🏥</span>
					<p className={styles.emptyDesc}>Cargando…</p>
				</div>
			) : consents.length === 0 ? (
				<div className={styles.empty}>
					<span className={styles.emptyIcon}>🏥</span>
					<h2 className={styles.emptyTitle}>Sin veterinarias conectadas</h2>
					<p className={styles.emptyDesc}>
						Cuando una clínica solicite acceso a los datos de tu mascota,
						aparecerá aquí. Vos decidís qué pueden ver y por cuánto tiempo.
					</p>
				</div>
			) : (
				<div className={styles.list}>
					{consents.map((c) => (
						<div key={c.id} className={styles.card}>
							<div className={styles.cardTop}>
								<div>
									<strong className={styles.clinicName}>
										{c.clinic_name ?? "Clínica"}
									</strong>
									<span className={styles.petLabel}>
										{" "}· {c.pet_name ?? "Mascota"}
									</span>
								</div>
								<span className={styles.dateMeta}>
									{c.expires_at
										? `Vence ${new Date(c.expires_at).toLocaleDateString("es-CR")}`
										: `Desde ${new Date(c.granted_at).toLocaleDateString("es-CR")}`}
								</span>
							</div>
							<div className={styles.scopes}>
								{c.scopes.map((s) => (
									<span key={s} className={styles.scopeTag}>
										{SCOPE_LABELS[s] ?? s}
									</span>
								))}
							</div>
							<div className={styles.cardActions}>
								<button
									className={styles.btnRevoke}
									onClick={() => void handleRevoke(c.id)}
								>
									Revocar acceso
								</button>
							</div>
						</div>
					))}
				</div>
			)}

			<div className={styles.cta}>
				<Link to="/autorizaciones" className={styles.btnOutline}>
					Ver todas las autorizaciones
				</Link>
			</div>
		</div>
	)
}
