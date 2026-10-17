import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { stellarNetwork } from "@stellar-scaffold/app-lib"
import { useWallet } from "../hooks/useWallet"
import { useSupabaseAuth } from "../hooks/useSupabaseAuth"
import { useCavosState } from "../cavos/context"
import { fetchProfile, updateProfile } from "../services/profileDb"
import { explorerAccountUrl } from "../services/petIdentity"
import { supabaseConfigured } from "../lib/supabase"
import FundAccountButton from "../components/FundAccountButton"
import type { Profile } from "../services/profileDb"
import styles from "./Perfil.module.css"

function shortAddr(addr: string): string {
	if (addr.length <= 12) return addr
	return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

export default function Perfil() {
	const { address, disconnect, balances, networkPassphrase } = useWallet()
	const { isAuthenticated } = useSupabaseAuth()
	const cavos = useCavosState()
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

	const xlmBalance = balances?.xlm?.balance ?? "—"
	const email = cavos?.email

	return (
		<div className={styles.page}>
			<div className={styles.pageHeader}>
				<h1 className={styles.pageTitle}>Mi perfil</h1>
				<p className={styles.pageSubtitle}>Información de tu cuenta Vetra.</p>
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
					{email && <span className={styles.metaSince}>{email}</span>}
					<div className={styles.metaRow}>
						<span className={styles.metaBadge}>Stellar Testnet</span>
						<span className={styles.metaSince}>Cuenta desde {since}</span>
					</div>
				</div>
			</div>

			{/* A. Información personal */}
			<div className={styles.card}>
				<h2 className={styles.cardTitle}>Información personal</h2>
				<dl className={styles.infoList}>
					{email && (
						<>
							<dt className={styles.infoLabel}>Correo</dt>
							<dd className={styles.infoValue}>{email}</dd>
						</>
					)}
					<dt className={styles.infoLabel}>Miembro desde</dt>
					<dd className={styles.infoValue}>{since}</dd>
				</dl>
				{!supabaseConfigured ? (
					<p className={styles.notice}>
						Configurá Supabase para guardar tu perfil entre sesiones.
					</p>
				) : (
					<form onSubmit={handleSave} className={styles.form}>
						<label className={styles.fieldLabel}>Nombre visible</label>
						<input
							className={styles.input}
							type="text"
							placeholder="Tu nombre o apodo"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							maxLength={80}
							disabled={loading || saving}
						/>
						<p className={styles.fieldHint}>
							Aparece en tu espacio personal. No es público.
						</p>
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

			{/* B. Identidad digital */}
			<div className={styles.card} id="identidad">
				<h2 className={styles.cardTitle}>Identidad digital</h2>
				<p className={styles.cardDesc}>Tu dirección en la red Stellar Testnet.</p>
				<dl className={styles.infoList}>
					<dt className={styles.infoLabel}>Estado</dt>
					<dd className={styles.infoValue}>
						<span className={styles.metaBadge}>Conectado · Testnet</span>
					</dd>
					<dt className={styles.infoLabel}>Dirección</dt>
					<dd className={styles.infoValue}>
						<code className={styles.addressAbbr}>{address ? shortAddr(address) : "—"}</code>
					</dd>
				</dl>
				{address && (
					<div className={styles.addressRow}>
						<code className={styles.addressFull}>{address}</code>
						<button
							className={styles.btnCopy}
							onClick={() => void navigator.clipboard.writeText(address)}
							title="Copiar dirección completa"
						>
							Copiar
						</button>
					</div>
				)}
				{address && (
					<a
						href={explorerAccountUrl(address)}
						target="_blank"
						rel="noopener noreferrer"
						className={styles.explorerLink}
					>
						Ver en Stellar Explorer →
					</a>
				)}
			</div>

			{/* C. Opciones avanzadas */}
			<details className={styles.advanced}>
				<summary className={styles.advancedSummary}>Opciones avanzadas</summary>
				<div className={styles.advancedBody}>
					<dl className={styles.infoList}>
						<dt className={styles.infoLabel}>Saldo XLM</dt>
						<dd className={styles.infoValue}>
							<strong>{xlmBalance}</strong> XLM
						</dd>
						{networkPassphrase && (
							<>
								<dt className={styles.infoLabel}>Red</dt>
								<dd className={styles.infoValue}>
									<code className={styles.codeSmall}>{networkPassphrase.slice(0, 48)}…</code>
								</dd>
							</>
						)}
					</dl>
					{stellarNetwork !== "PUBLIC" && (
						<div className={styles.fundWrap}>
							<p className={styles.fieldHint}>
								Fondea tu cuenta con XLM de prueba usando Friendbot (solo Testnet).
							</p>
							<FundAccountButton />
						</div>
					)}
				</div>
			</details>

			{/* D. Sesión */}
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
