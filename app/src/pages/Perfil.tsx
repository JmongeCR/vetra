import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useWallet } from "../hooks/useWallet"
import { useSupabaseAuth } from "../hooks/useSupabaseAuth"
import { fetchProfile, updateProfile } from "../services/profileDb"
import { supabaseConfigured } from "../lib/supabase"
import type { Profile } from "../services/profileDb"
import styles from "./Perfil.module.css"

function shortAddr(addr: string): string {
	if (addr.length <= 12) return addr
	return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

export default function Perfil() {
	const { address, disconnect } = useWallet()
	const { isAuthenticated } = useSupabaseAuth()
	const navigate = useNavigate()

	const [profile, setProfile] = useState<Profile | null>(null)
	const [displayName, setDisplayName] = useState("")
	const [saving, setSaving] = useState(false)
	const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		if (!address) navigate("/")
	}, [address, navigate])

	useEffect(() => {
		if (!address) return
		setLoading(true)
		fetchProfile().then((p) => {
			setProfile(p)
			setDisplayName(p?.display_name ?? "")
			setLoading(false)
		})
	}, [address, isAuthenticated])

	async function handleSave(e: React.FormEvent) {
		e.preventDefault()
		setSaving(true)
		setSaveMsg(null)
		const result = await updateProfile({ display_name: displayName.trim() || null })
		setSaving(false)
		if (result.ok) {
			setSaveMsg({ ok: true, text: "Perfil actualizado." })
			setProfile((p) => p ? { ...p, display_name: displayName.trim() || null } : p)
		} else {
			setSaveMsg({ ok: false, text: result.error ?? "Error al guardar." })
		}
	}

	async function handleLogout() {
		await disconnect()
		navigate("/")
	}

	const since = profile?.created_at
		? new Date(profile.created_at).toLocaleDateString("es-CR", {
				year: "numeric",
				month: "long",
				day: "numeric",
			})
		: "—"

	return (
		<div className={styles.page}>
			<div className={styles.pageHeader}>
				<h1 className={styles.pageTitle}>Mi perfil</h1>
				<p className={styles.pageSubtitle}>
					Información de tu cuenta Vetra.
				</p>
			</div>

			{/* Identity card */}
			<div className={styles.identityCard}>
				<div className={styles.avatarPlaceholder}>
					<span>{displayName ? displayName.charAt(0).toUpperCase() : "?"}</span>
				</div>
				<div className={styles.identityInfo}>
					<div className={styles.identityName}>
						{displayName || <span className={styles.muted}>Sin nombre</span>}
					</div>
					<code className={styles.stellarAddress}>
						{address ? shortAddr(address) : "—"}
					</code>
					<div className={styles.metaRow}>
						<span className={styles.metaBadge}>Stellar Testnet</span>
						<span className={styles.metaSince}>Cuenta desde {since}</span>
					</div>
				</div>
			</div>

			{/* Edit display name */}
			<div className={styles.card}>
				<h2 className={styles.cardTitle}>Nombre visible</h2>
				<p className={styles.cardDesc}>
					Este nombre aparece en tu espacio personal. No es público.
				</p>
				{!supabaseConfigured ? (
					<p className={styles.notice}>
						Configurá Supabase para guardar tu perfil entre sesiones.
					</p>
				) : (
					<form onSubmit={handleSave} className={styles.form}>
						<input
							className={styles.input}
							type="text"
							placeholder="Tu nombre o apodo"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							maxLength={80}
							disabled={loading || saving}
						/>
						{saveMsg && (
							<p className={saveMsg.ok ? styles.msgOk : styles.msgError}>
								{saveMsg.text}
							</p>
						)}
						<button
							type="submit"
							className={styles.btnPrimary}
							disabled={loading || saving}
						>
							{saving ? "Guardando…" : "Guardar"}
						</button>
					</form>
				)}
			</div>

			{/* Stellar address (read-only) */}
			<div className={styles.card}>
				<h2 className={styles.cardTitle}>Dirección Stellar</h2>
				<p className={styles.cardDesc}>
					Tu identidad en la red Stellar Testnet. Solo lectura.
				</p>
				<div className={styles.addressRow}>
					<code className={styles.addressFull}>{address ?? "—"}</code>
					{address && (
						<button
							className={styles.btnCopy}
							onClick={() => void navigator.clipboard.writeText(address)}
							title="Copiar dirección"
						>
							Copiar
						</button>
					)}
				</div>
			</div>

			{/* Session */}
			<div className={`${styles.card} ${styles.dangerCard}`}>
				<h2 className={styles.cardTitle}>Sesión</h2>
				<p className={styles.cardDesc}>
					Cerrar sesión desconecta tu billetera de este dispositivo.
				</p>
				<button className={styles.btnDanger} onClick={() => void handleLogout()}>
					Cerrar sesión
				</button>
			</div>
		</div>
	)
}
