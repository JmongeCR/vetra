import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useWallet } from "../hooks/useWallet"
import { useSupabaseAuth } from "../hooks/useSupabaseAuth"
import { useCavosState } from "../cavos/context"
import { getPets } from "../services/petStorage"
import { fetchPets } from "../services/petDb"
import { supabaseConfigured } from "../lib/supabase"
import LocalMigration from "../components/LocalMigration"
import { SPECIES_EMOJI, SPECIES_LABELS, SEX_LABELS } from "../types/pet"
import type { Pet } from "../types/pet"
import styles from "./Mascotas.module.css"

function ageLabel(pet: Pet): string {
	if (!pet.birthDate) return "Edad desconocida"
	const birth = new Date(pet.birthDate)
	const now = new Date()
	const months =
		(now.getFullYear() - birth.getFullYear()) * 12 +
		(now.getMonth() - birth.getMonth())
	const years = Math.floor(months / 12)
	const rem = months % 12
	const est = pet.birthDateEstimated ? " (aprox.)" : ""
	if (years === 0) return `${months} mes${months !== 1 ? "es" : ""}${est}`
	if (rem === 0) return `${years} año${years !== 1 ? "s" : ""}${est}`
	return `${years} año${years !== 1 ? "s" : ""} y ${rem} mes${rem !== 1 ? "es" : ""}${est}`
}

function statusBadge(pet: Pet) {
	const map = {
		local: { label: "Solo local", cls: styles.statusLocal },
		pending: { label: "Pendiente", cls: styles.statusPending },
		registered: { label: "En Stellar", cls: styles.statusRegistered },
	}
	const { label, cls } = map[pet.stellarStatus]
	return <span className={`${styles.statusBadge} ${cls}`}>{label}</span>
}

function photoSrc(pet: Pet): string | undefined {
	return pet.photoUrl ?? pet.photoDataUrl
}

export default function Mascotas() {
	const { address } = useWallet()
	const { isAuthenticating, isAuthenticated, authError, retry } = useSupabaseAuth()
	const cavos = useCavosState()
	const needsDeviceApproval = cavos?.needsDeviceApproval === true
	const [pets, setPets] = useState<Pet[]>([])
	const [loading, setLoading] = useState(true)
	const [dbError, setDbError] = useState<string | null>(null)

	const loadPets = async () => {
		setLoading(true)
		setDbError(null)
		try {
			if (supabaseConfigured) {
				// Try DB first; fall back to localStorage when not authenticated.
				const dbPets = await fetchPets()
				if (dbPets.length > 0) {
					setPets(dbPets)
					setLoading(false)
					return
				}
			}
			// Fallback: localStorage
			setPets(getPets())
		} catch (err) {
			setDbError("Error al cargar desde la base de datos. Mostrando datos locales.")
			setPets(getPets())
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		// Don't attempt to load pets when the device isn't authorized yet —
		// Supabase auth cannot run without a valid wallet signature, so the
		// result would always be an empty list regardless of real pet count.
		if (needsDeviceApproval) return
		void loadPets()
	}, [address, isAuthenticated, needsDeviceApproval])

	// Device needs passkey approval before any wallet operation can proceed.
	// Show a dedicated screen instead of a false empty pet list.
	if (needsDeviceApproval) {
		return (
			<div className={styles.page}>
				<div className={styles.header}>
					<div>
						<h1 className={styles.title}>Mis mascotas</h1>
					</div>
				</div>
				<div className={styles.notice}>
					<span className={styles.noticeIcon}>🔐</span>
					<div>
						<strong>Este dispositivo necesita autorización</strong>
						<p>
							Tu cuenta Cavos está activa, pero este navegador no puede firmar
							con tu billetera Stellar todavía. Autorizá el dispositivo con tu
							passkey para acceder a tus mascotas.
						</p>
						<div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
							<button className={styles.btnPrimary} onClick={() => void cavos!.approveDevice()}>
								Autorizar con passkey
							</button>
							<button
								onClick={() => void cavos!.signOut()}
								style={{
									background: "transparent",
									border: "1.5px solid var(--color-border)",
									borderRadius: "var(--radius-full)",
									padding: "0.45rem 1.1rem",
									fontSize: "0.875rem",
									color: "var(--color-text-muted)",
									cursor: "pointer",
									fontFamily: "inherit",
								}}
							>
								Cerrar sesión
							</button>
						</div>
						<p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
							Si nunca registraste una passkey, cerrá sesión y volvé a ingresar con Google:
							tu billetera y mascotas se restauran automáticamente.
						</p>
					</div>
				</div>
			</div>
		)
	}

	const subtitle = supabaseConfigured
		? isAuthenticated
			? "Identidades digitales · Supabase + Stellar Testnet"
			: "Supabase configurado · conectá tu billetera para sincronizar"
		: "Registros locales · Pendientes de certificación en Stellar Testnet"

	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<div>
					<h1 className={styles.title}>Mis mascotas</h1>
					<p className={styles.subtitle}>{subtitle}</p>
				</div>
				<Link to="/mascotas/nueva" className={styles.btnPrimary}>
					+ Registrar mascota
				</Link>
			</div>

			<LocalMigration onComplete={loadPets} />

			{!address && (
				<div className={styles.notice}>
					<span className={styles.noticeIcon}>🔑</span>
					<div>
						<strong>Conectá tu cuenta</strong>
						<p>
							Inicia sesión con Cavos para asociar las mascotas a tu dirección
							Stellar y sincronizarlas entre dispositivos.
						</p>
					</div>
				</div>
			)}

			{supabaseConfigured && address && !isAuthenticated && !isAuthenticating && authError && (
				<div className={styles.notice}>
					<span className={styles.noticeIcon}>⚠️</span>
					<div>
						<strong>Error al autenticar con Supabase</strong>
						<p>{authError}</p>
						<button className={styles.btnPrimary} onClick={retry} style={{ marginTop: "0.5rem" }}>
							Reintentar
						</button>
					</div>
				</div>
			)}

			{supabaseConfigured && address && isAuthenticating && (
				<div className={styles.notice}>
					<span className={styles.noticeIcon}>🔐</span>
					<div>
						<strong>Autenticando con Supabase…</strong>
						<p>Firmá la transacción de verificación en Cavos para continuar.</p>
					</div>
				</div>
			)}

			{dbError && (
				<div className={styles.notice}>
					<span className={styles.noticeIcon}>⚠️</span>
					<div><p>{dbError}</p></div>
				</div>
			)}

			{loading ? (
				<div className={styles.empty}>
					<div className={styles.emptyIcon}>⏳</div>
					<p>Cargando mascotas…</p>
				</div>
			) : pets.length === 0 ? (
				<div className={styles.empty}>
					<div className={styles.emptyIcon}>🐾</div>
					<h2>Todavía no registraste mascotas</h2>
					<p>
						Crea el perfil de tu animal y generá un identificador universal
						VET-XXXXXX.
					</p>
					<Link to="/mascotas/nueva" className={styles.btnPrimary}>
						Registrar primera mascota
					</Link>
				</div>
			) : (
				<div className={styles.grid}>
					{pets.map((pet) => (
						<Link
							key={pet.id}
							to={`/mascotas/${pet.id}`}
							className={styles.card}
						>
							<div className={styles.cardPhoto}>
								{photoSrc(pet) ? (
									<img
										src={photoSrc(pet)}
										alt={pet.name}
										className={styles.photo}
									/>
								) : (
									<span className={styles.photoEmoji}>
										{SPECIES_EMOJI[pet.species]}
									</span>
								)}
							</div>
							<div className={styles.cardBody}>
								<div className={styles.cardTop}>
									<span className={styles.vetId}>{pet.vetId}</span>
									{statusBadge(pet)}
								</div>
								<h3 className={styles.petName}>{pet.name}</h3>
								<p className={styles.petMeta}>
									{SPECIES_LABELS[pet.species]}
									{pet.breed ? ` · ${pet.breed}` : ""}
								</p>
								<p className={styles.petMeta}>
									{SEX_LABELS[pet.sex]} · {ageLabel(pet)}
								</p>
								{pet.color && (
									<p className={styles.petMeta}>Color: {pet.color}</p>
								)}
								{pet.microchip && (
									<p className={styles.petMeta}>
										Microchip: <code>{pet.microchip}</code>
									</p>
								)}
							</div>
						</Link>
					))}
				</div>
			)}

			<p className={styles.disclaimer}>
				{supabaseConfigured
					? "Los datos se sincronizan con Supabase PostgreSQL. Sin información clínica."
					: "⚠️ Los datos se almacenan temporalmente en este navegador. Configurá Supabase para sincronización entre dispositivos."}
			</p>
		</div>
	)
}
