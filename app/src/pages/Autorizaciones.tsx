import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useWallet } from "../hooks/useWallet"
import { useSupabaseAuth } from "../hooks/useSupabaseAuth"
import {
	fetchAccessRequests,
	fetchConsents,
	updateAccessRequestStatus,
	revokeConsent,
} from "../services/authorizationDb"
import type { AccessRequest, Consent } from "../services/authorizationDb"
import styles from "./Autorizaciones.module.css"

type Tab = "pendientes" | "activas" | "revocadas" | "vencidas"

function ScopeList({ scopes }: { scopes: string[] }) {
	const labels: Record<string, string> = {
		basic_data: "Datos básicos",
		vaccines: "Vacunas",
		medical_history: "Historial",
		shared_consultations: "Consultas",
		authorized_documents: "Documentos",
	}
	return (
		<div className={styles.scopes}>
			{scopes.map((s) => (
				<span key={s} className={styles.scopeTag}>
					{labels[s] ?? s}
				</span>
			))}
		</div>
	)
}

export default function Autorizaciones() {
	const { address } = useWallet()
	const { isAuthenticated } = useSupabaseAuth()
	const navigate = useNavigate()
	const [tab, setTab] = useState<Tab>("pendientes")
	const [pending, setPending] = useState<AccessRequest[]>([])
	const [active, setActive] = useState<Consent[]>([])
	const [revoked, setRevoked] = useState<Consent[]>([])
	const [expired, setExpired] = useState<Consent[]>([])
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		if (!address) navigate("/")
	}, [address, navigate])

	useEffect(() => {
		if (!address || !isAuthenticated) return
		setLoading(true)
		Promise.all([
			fetchAccessRequests("pending"),
			fetchConsents("active"),
			fetchConsents("revoked"),
			fetchConsents("expired"),
		]).then(([p, a, r, e]) => {
			setPending(p)
			setActive(a)
			setRevoked(r)
			setExpired(e)
			setLoading(false)
		})
	}, [address, isAuthenticated])

	async function handleApprove(id: string) {
		const result = await updateAccessRequestStatus(id, "approved")
		if (result.ok) setPending((prev) => prev.filter((r) => r.id !== id))
	}

	async function handleReject(id: string) {
		const result = await updateAccessRequestStatus(id, "rejected")
		if (result.ok) setPending((prev) => prev.filter((r) => r.id !== id))
	}

	async function handleRevoke(id: string) {
		const result = await revokeConsent(id)
		if (result.ok) {
			setActive((prev) => prev.filter((c) => c.id !== id))
		}
	}

	const TABS: { id: Tab; label: string; count: number }[] = [
		{ id: "pendientes", label: "Pendientes", count: pending.length },
		{ id: "activas",    label: "Activas",    count: active.length },
		{ id: "revocadas",  label: "Revocadas",  count: revoked.length },
		{ id: "vencidas",   label: "Vencidas",   count: expired.length },
	]

	function EmptyState({ message }: { message: string }) {
		return (
			<div className={styles.empty}>
				<span className={styles.emptyIcon}>🔐</span>
				<p>{message}</p>
			</div>
		)
	}

	return (
		<div className={styles.page}>
			<div className={styles.pageHeader}>
				<h1 className={styles.pageTitle}>Autorizaciones</h1>
				<p className={styles.pageSubtitle}>
					Control de acceso de veterinarias a tus mascotas.
				</p>
			</div>

			{/* Tabs */}
			<div className={styles.tabs}>
				{TABS.map((t) => (
					<button
						key={t.id}
						className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
						onClick={() => setTab(t.id)}
					>
						{t.label}
						{t.count > 0 && (
							<span className={styles.tabBadge}>{t.count}</span>
						)}
					</button>
				))}
			</div>

			{loading ? (
				<div className={styles.empty}>
					<p>Cargando…</p>
				</div>
			) : (
				<>
					{/* Pendientes */}
					{tab === "pendientes" && (
						pending.length === 0 ? (
							<EmptyState message="No hay solicitudes pendientes." />
						) : (
							<div className={styles.list}>
								{pending.map((r) => (
									<div key={r.id} className={`${styles.card} ${styles.cardPending}`}>
										<div className={styles.cardTop}>
											<div>
												<strong className={styles.clinicName}>
													{r.clinic_name ?? "Clínica"}
												</strong>
												<span className={styles.petLabel}>
													· {r.pet_name ?? "Mascota"}
												</span>
											</div>
											<span className={styles.dateMeta}>
												{new Date(r.created_at).toLocaleDateString("es-CR")}
											</span>
										</div>
										{r.message && (
											<p className={styles.message}>"{r.message}"</p>
										)}
										<ScopeList scopes={r.scopes} />
										<div className={styles.cardActions}>
											<button
												className={styles.btnReject}
												onClick={() => void handleReject(r.id)}
											>
												Rechazar
											</button>
											<button
												className={styles.btnApprove}
												onClick={() => void handleApprove(r.id)}
											>
												Aprobar acceso
											</button>
										</div>
									</div>
								))}
							</div>
						)
					)}

					{/* Activas */}
					{tab === "activas" && (
						active.length === 0 ? (
							<EmptyState message="No hay accesos activos." />
						) : (
							<div className={styles.list}>
								{active.map((c) => (
									<div key={c.id} className={styles.card}>
										<div className={styles.cardTop}>
											<div>
												<strong className={styles.clinicName}>
													{c.clinic_name ?? "Clínica"}
												</strong>
												<span className={styles.petLabel}>
													· {c.pet_name ?? "Mascota"}
												</span>
											</div>
											{c.expires_at && (
												<span className={styles.dateMeta}>
													Vence{" "}
													{new Date(c.expires_at).toLocaleDateString("es-CR")}
												</span>
											)}
										</div>
										<ScopeList scopes={c.scopes} />
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
						)
					)}

					{/* Revocadas */}
					{tab === "revocadas" && (
						revoked.length === 0 ? (
							<EmptyState message="No hay accesos revocados." />
						) : (
							<div className={styles.list}>
								{revoked.map((c) => (
									<div key={c.id} className={`${styles.card} ${styles.cardRevoked}`}>
										<div className={styles.cardTop}>
											<div>
												<strong className={styles.clinicName}>
													{c.clinic_name ?? "Clínica"}
												</strong>
												<span className={styles.petLabel}>
													· {c.pet_name ?? "Mascota"}
												</span>
											</div>
											{c.revoked_at && (
												<span className={styles.dateMeta}>
													Revocado{" "}
													{new Date(c.revoked_at).toLocaleDateString("es-CR")}
												</span>
											)}
										</div>
										<ScopeList scopes={c.scopes} />
									</div>
								))}
							</div>
						)
					)}

					{/* Vencidas */}
					{tab === "vencidas" && (
						expired.length === 0 ? (
							<EmptyState message="No hay accesos vencidos." />
						) : (
							<div className={styles.list}>
								{expired.map((c) => (
									<div key={c.id} className={`${styles.card} ${styles.cardExpired}`}>
										<div className={styles.cardTop}>
											<div>
												<strong className={styles.clinicName}>
													{c.clinic_name ?? "Clínica"}
												</strong>
												<span className={styles.petLabel}>
													· {c.pet_name ?? "Mascota"}
												</span>
											</div>
											{c.expires_at && (
												<span className={styles.dateMeta}>
													Venció{" "}
													{new Date(c.expires_at).toLocaleDateString("es-CR")}
												</span>
											)}
										</div>
										<ScopeList scopes={c.scopes} />
									</div>
								))}
							</div>
						)
					)}
				</>
			)}
		</div>
	)
}
