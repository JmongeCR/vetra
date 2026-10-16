import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useWallet } from "../hooks/useWallet"
import { useSupabaseAuth } from "../hooks/useSupabaseAuth"
import { fetchPets } from "../services/petDb"
import { getPets } from "../services/petStorage"
import { fetchProfile } from "../services/profileDb"
import { supabaseConfigured } from "../lib/supabase"
import { SPECIES_EMOJI, SPECIES_LABELS } from "../types/pet"
import type { Pet } from "../types/pet"
import type { Profile } from "../services/profileDb"
import styles from "./MiEspacio.module.css"

function shortAddr(addr: string): string {
	return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
}

export default function MiEspacio() {
	const { address } = useWallet()
	const { isAuthenticated } = useSupabaseAuth()
	const navigate = useNavigate()
	const [pets, setPets] = useState<Pet[]>([])
	const [profile, setProfile] = useState<Profile | null>(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		if (!address) navigate("/")
	}, [address, navigate])

	useEffect(() => {
		if (!address) return
		setLoading(true)
		Promise.all([
			supabaseConfigured ? fetchPets() : Promise.resolve(getPets()),
			fetchProfile(),
		]).then(([loadedPets, loadedProfile]) => {
			if (loadedPets.length === 0 && supabaseConfigured) setPets(getPets())
			else setPets(loadedPets)
			setProfile(loadedProfile)
			setLoading(false)
		})
	}, [address, isAuthenticated])

	const displayName =
		profile?.display_name ?? (address ? shortAddr(address) : "")

	const QUICK_ACTIONS = [
		{ icon: "🐾", label: "Registrar mascota", to: "/mascotas/nueva" },
		{ icon: "🗂", label: "Mis mascotas", to: "/mascotas" },
		{ icon: "🪪", label: "Pasaportes", to: "/pasaportes" },
		{ icon: "🏥", label: "Mis veterinarias", to: "/mis-veterinarias" },
		{ icon: "🔐", label: "Autorizaciones", to: "/autorizaciones" },
		{ icon: "👤", label: "Mi perfil", to: "/perfil" },
	]

	return (
		<div className={styles.page}>
			{/* Greeting */}
			<div className={styles.greeting}>
				<h1 className={styles.greetingTitle}>Hola, {displayName}</h1>
				<p className={styles.greetingSubtitle}>
					Este es tu espacio personal en Vetra.
				</p>
			</div>

			{/* Stats */}
			<div className={styles.stats}>
				<div className={styles.statCard}>
					<span className={styles.statNum}>
						{loading ? "—" : pets.length}
					</span>
					<span className={styles.statLabel}>
						Mascota{pets.length !== 1 ? "s" : ""} registrada
						{pets.length !== 1 ? "s" : ""}
					</span>
				</div>
				<div className={styles.statCard}>
					<span className={styles.statNum}>0</span>
					<span className={styles.statLabel}>Autorizaciones pendientes</span>
				</div>
				<div className={styles.statCard}>
					<span className={styles.statNum}>
						{loading
							? "—"
							: pets.filter((p) => p.stellarStatus === "registered").length}
					</span>
					<span className={styles.statLabel}>Certificadas en Stellar</span>
				</div>
			</div>

			{/* Quick actions */}
			<section className={styles.section}>
				<h2 className={styles.sectionTitle}>Acciones rápidas</h2>
				<div className={styles.actions}>
					{QUICK_ACTIONS.map((a) => (
						<Link key={a.to} to={a.to} className={styles.actionBtn}>
							<span className={styles.actionIcon}>{a.icon}</span>
							<span className={styles.actionLabel}>{a.label}</span>
						</Link>
					))}
				</div>
			</section>

			{/* Recent pets */}
			{!loading && pets.length > 0 && (
				<section className={styles.section}>
					<div className={styles.sectionHeader}>
						<h2 className={styles.sectionTitle}>Mis mascotas</h2>
						<Link to="/mascotas" className={styles.seeAll}>
							Ver todas →
						</Link>
					</div>
					<div className={styles.petGrid}>
						{pets.slice(0, 4).map((pet) => (
							<Link
								key={pet.id}
								to={`/mascotas/${pet.id}`}
								className={styles.petCard}
							>
								<span className={styles.petEmoji}>
									{SPECIES_EMOJI[pet.species]}
								</span>
								<div className={styles.petInfo}>
									<strong className={styles.petName}>{pet.name}</strong>
									<span className={styles.petSpecies}>
										{SPECIES_LABELS[pet.species]}
									</span>
									<code className={styles.petVetId}>{pet.vetId}</code>
								</div>
							</Link>
						))}
					</div>
				</section>
			)}

			{!loading && pets.length === 0 && (
				<div className={styles.empty}>
					<span className={styles.emptyIcon}>🐾</span>
					<p>Todavía no registraste mascotas.</p>
					<Link to="/mascotas/nueva" className={styles.btnPrimary}>
						Registrar primera mascota
					</Link>
				</div>
			)}
		</div>
	)
}
