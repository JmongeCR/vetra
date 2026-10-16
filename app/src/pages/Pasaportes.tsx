import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useWallet } from "../hooks/useWallet"
import { useSupabaseAuth } from "../hooks/useSupabaseAuth"
import { fetchPets } from "../services/petDb"
import { getPets } from "../services/petStorage"
import { supabaseConfigured } from "../lib/supabase"
import { SPECIES_EMOJI, SPECIES_LABELS } from "../types/pet"
import type { Pet } from "../types/pet"
import styles from "./Pasaportes.module.css"

const BASE_URL = window.location.origin

function StatusPill({ status }: { status: Pet["stellarStatus"] }) {
	const map = {
		local:      { label: "Solo local",   cls: styles.pillLocal },
		pending:    { label: "Pendiente",     cls: styles.pillPending },
		registered: { label: "En Stellar",    cls: styles.pillRegistered },
	}
	const { label, cls } = map[status]
	return <span className={`${styles.pill} ${cls}`}>{label}</span>
}

export default function Pasaportes() {
	const { address } = useWallet()
	const { isAuthenticated } = useSupabaseAuth()
	const navigate = useNavigate()
	const [pets, setPets] = useState<Pet[]>([])
	const [loading, setLoading] = useState(true)
	const [copied, setCopied] = useState<string | null>(null)

	useEffect(() => {
		if (!address) navigate("/")
	}, [address, navigate])

	useEffect(() => {
		if (!address) return
		setLoading(true)
		const load = async () => {
			if (supabaseConfigured) {
				const db = await fetchPets()
				setPets(db.length > 0 ? db : getPets())
			} else {
				setPets(getPets())
			}
			setLoading(false)
		}
		void load()
	}, [address, isAuthenticated])

	function copyLink(vetId: string) {
		const url = `${BASE_URL}/pasaporte/${vetId}`
		void navigator.clipboard.writeText(url).then(() => {
			setCopied(vetId)
			setTimeout(() => setCopied(null), 2000)
		})
	}

	return (
		<div className={styles.page}>
			<div className={styles.pageHeader}>
				<h1 className={styles.pageTitle}>Pasaportes digitales</h1>
				<p className={styles.pageSubtitle}>
					Compartí el enlace o el VET-ID con tu veterinaria.
				</p>
			</div>

			{loading ? (
				<div className={styles.empty}>
					<span className={styles.emptyIcon}>⏳</span>
					<p>Cargando…</p>
				</div>
			) : pets.length === 0 ? (
				<div className={styles.empty}>
					<span className={styles.emptyIcon}>🪪</span>
					<h2>Sin pasaportes todavía</h2>
					<p>Registrá una mascota para generar su pasaporte digital.</p>
					<Link to="/mascotas/nueva" className={styles.btnPrimary}>
						Registrar mascota
					</Link>
				</div>
			) : (
				<div className={styles.list}>
					{pets.map((pet) => (
						<div key={pet.id} className={styles.row}>
							<div className={styles.rowLeft}>
								<span className={styles.emoji}>
									{SPECIES_EMOJI[pet.species]}
								</span>
								<div className={styles.petInfo}>
									<strong className={styles.petName}>{pet.name}</strong>
									<span className={styles.petMeta}>
										{SPECIES_LABELS[pet.species]}
									</span>
									<code className={styles.vetId}>{pet.vetId}</code>
								</div>
							</div>

							<div className={styles.rowRight}>
								<StatusPill status={pet.stellarStatus} />
								<Link
									to={`/pasaporte/${pet.vetId}`}
									className={styles.btnView}
									target="_blank"
									rel="noopener"
								>
									Ver
								</Link>
								<button
									className={styles.btnCopy}
									onClick={() => copyLink(pet.vetId)}
								>
									{copied === pet.vetId ? "✓ Copiado" : "Copiar enlace"}
								</button>
							</div>
						</div>
					))}
				</div>
			)}

			{!loading && pets.length > 0 && (
				<p className={styles.hint}>
					El enlace del pasaporte es público. Cualquier persona con el enlace
					puede ver la información básica de tu mascota.
				</p>
			)}
		</div>
	)
}
