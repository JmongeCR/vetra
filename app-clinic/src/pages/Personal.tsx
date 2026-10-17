import { useState, useEffect, useCallback, useRef } from "react"
import { useClinicAuthContext } from "../contexts/clinicAuthContext"
import {
	listStaff,
	updateStaffRole,
	updateStaffActive,
	listInvitations,
	createInvitation,
	cancelInvitation,
	sendInvitationEmail,
	type StaffMember,
	type StaffInvitation,
} from "../services/staffDb"
import styles from "./Personal.module.css"

const ROLE_LABELS: Record<string, string> = {
	admin:     "Administrador",
	vet:       "Veterinario/a",
	reception: "Recepción",
}

const ROLE_OPTIONS: { value: StaffMember["role"]; label: string }[] = [
	{ value: "admin",     label: "Administrador" },
	{ value: "vet",       label: "Veterinario/a" },
	{ value: "reception", label: "Recepción" },
]

// ── InviteModal ────────────────────────────────────────────────────────────────

interface InviteModalProps {
	onClose: () => void
	onInvited: () => void
}

function InviteModal({ onClose, onInvited }: InviteModalProps) {
	const [email, setEmail]     = useState("")
	const [role, setRole]       = useState<StaffMember["role"]>("vet")
	const [loading, setLoading] = useState(false)
	const [error, setError]     = useState<string | null>(null)
	const [sent, setSent]       = useState(false)

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!email.trim()) return
		setLoading(true)
		setError(null)

		const res = await createInvitation(email.trim().toLowerCase(), role)
		if (!res.ok) {
			setLoading(false)
			if (res.migrationPending) {
				setError("Esta función requiere una migración pendiente en la base de datos.")
			} else {
				setError(res.error ?? "Error al crear invitación")
			}
			return
		}

		if (res.token) {
			const emailRes = await sendInvitationEmail(email.trim().toLowerCase(), res.token)
			if (!emailRes.ok) {
				setLoading(false)
				// Non-fatal: record created, inform admin
				setError(`Invitación registrada, pero falló el envío del correo: ${emailRes.error}`)
				setSent(true)
				onInvited()
				return
			}
		}

		setLoading(false)
		setSent(true)
		onInvited()
	}

	if (sent) {
		return (
			<div className={styles.modalOverlay} onClick={onClose}>
				<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
					<div className={styles.modalSuccess}>
						<span className={styles.modalSuccessIcon}>✓</span>
						<h3>Invitación enviada</h3>
						<p>
							Se envió un correo a <strong>{email}</strong> con el enlace para
							unirse a la clínica. La invitación expira en 7 días.
						</p>
						<button className={styles.btnPrimary} onClick={onClose}>Listo</button>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className={styles.modalOverlay} onClick={onClose}>
			<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
				<div className={styles.modalHeader}>
					<h2 className={styles.modalTitle}>Invitar colaborador</h2>
					<button
						className={styles.modalClose}
						onClick={onClose}
						aria-label="Cerrar"
					>
						×
					</button>
				</div>

				<form onSubmit={(e) => void handleSubmit(e)} className={styles.modalForm}>
					<div className={styles.field}>
						<label className={styles.fieldLabel}>Correo electrónico</label>
						<input
							type="email"
							className={styles.input}
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="colaborador@example.com"
							required
							autoFocus
							disabled={loading}
						/>
					</div>

					<div className={styles.field}>
						<label className={styles.fieldLabel}>Rol</label>
						<select
							className={styles.roleSelect}
							value={role}
							onChange={(e) => setRole(e.target.value as StaffMember["role"])}
							disabled={loading}
						>
							{ROLE_OPTIONS.map((o) => (
								<option key={o.value} value={o.value}>{o.label}</option>
							))}
						</select>
					</div>

					{error && <p className={styles.fieldError}>{error}</p>}

					<div className={styles.modalActions}>
						<button
							type="button"
							className={styles.btnSecondary}
							onClick={onClose}
							disabled={loading}
						>
							Cancelar
						</button>
						<button
							type="submit"
							className={styles.btnPrimary}
							disabled={loading || !email.trim()}
						>
							{loading ? "Enviando…" : "Enviar invitación"}
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}

// ── Personal ───────────────────────────────────────────────────────────────────

export default function Personal() {
	const { member } = useClinicAuthContext()
	const isAdmin = member?.role === "admin"

	const [staff, setStaff]               = useState<StaffMember[]>([])
	const [invitations, setInvitations]   = useState<StaffInvitation[]>([])
	const [migrationPending, setMigrationPending] = useState(false)
	const [loading, setLoading]           = useState(true)
	const [error, setError]               = useState<string | null>(null)
	const [saving, setSaving]             = useState<Record<string, boolean>>({})
	const [saveError, setSaveError]       = useState<Record<string, string>>({})
	const [showInvite, setShowInvite]     = useState(false)
	const [cancelingId, setCancelingId]   = useState<string | null>(null)
	const didLoad = useRef(false)

	const load = useCallback(async () => {
		setLoading(true)
		setError(null)

		const [staffRes, invRes] = await Promise.all([
			listStaff(),
			listInvitations(),
		])

		setLoading(false)

		if (staffRes.error) {
			setError(staffRes.error)
			return
		}
		setStaff(staffRes.data)

		if (!invRes.ok && "migrationPending" in invRes) {
			setMigrationPending(true)
		} else if (invRes.ok) {
			setInvitations(invRes.data)
		}
	}, [])

	useEffect(() => {
		if (didLoad.current) return
		didLoad.current = true
		void load()
	}, [load])

	const activeAdmins = staff.filter((s) => s.is_active && s.role === "admin")

	async function handleRoleChange(m: StaffMember, role: StaffMember["role"]) {
		if (m.role === "admin" && role !== "admin" && activeAdmins.length <= 1) {
			setSaveError((p) => ({ ...p, [m.id]: "No podés cambiar el rol del único administrador activo" }))
			return
		}
		setSaving((p) => ({ ...p, [m.id]: true }))
		setSaveError((p) => { const n = { ...p }; delete n[m.id]; return n })
		const res = await updateStaffRole(m.id, role)
		setSaving((p) => ({ ...p, [m.id]: false }))
		if (!res.ok) {
			setSaveError((p) => ({ ...p, [m.id]: res.error ?? "Error al actualizar rol" }))
			return
		}
		setStaff((prev) => prev.map((s) => s.id === m.id ? { ...s, role } : s))
	}

	async function handleToggleActive(m: StaffMember) {
		const next = !m.is_active
		if (!next && m.role === "admin" && activeAdmins.length <= 1) {
			setSaveError((p) => ({ ...p, [`active_${m.id}`]: "No podés desactivar al único administrador activo" }))
			return
		}
		setSaving((p) => ({ ...p, [`active_${m.id}`]: true }))
		setSaveError((p) => { const n = { ...p }; delete n[`active_${m.id}`]; return n })
		const res = await updateStaffActive(m.id, next)
		setSaving((p) => ({ ...p, [`active_${m.id}`]: false }))
		if (!res.ok) {
			setSaveError((p) => ({ ...p, [`active_${m.id}`]: res.error ?? "Error al actualizar estado" }))
			return
		}
		setStaff((prev) => prev.map((s) => s.id === m.id ? { ...s, is_active: next } : s))
	}

	async function handleCancelInvitation(id: string) {
		setCancelingId(id)
		const res = await cancelInvitation(id)
		setCancelingId(null)
		if (!res.ok) return
		setInvitations((prev) => prev.filter((i) => i.id !== id))
	}

	function displayName(m: StaffMember) {
		return m.display_name?.trim() || m.email?.split("@")[0] || "Sin nombre"
	}

	const activeCount  = staff.filter((s) => s.is_active).length
	const pendingCount = invitations.length

	// ── Render ─────────────────────────────────────────────────────────────────

	return (
		<div className={styles.page}>

			{/* Header */}
			<div className={styles.toolbar}>
				<div>
					<h1 className={styles.title}>Personal</h1>
					<p className={styles.subtitle}>Administrá el equipo de tu veterinaria</p>
				</div>
				{isAdmin && (
					<button
						className={styles.btnPrimary}
						onClick={() => setShowInvite(true)}
						disabled={migrationPending}
						title={migrationPending ? "Requiere migración pendiente en la base de datos" : undefined}
					>
						+ Invitar colaborador
					</button>
				)}
			</div>

			{/* Stats */}
			{!loading && !error && (
				<div className={styles.stats}>
					<div className={styles.statCard}>
						<span className={styles.statValue}>{activeCount}</span>
						<span className={styles.statLabel}>
							{activeCount === 1 ? "Colaborador activo" : "Colaboradores activos"}
						</span>
					</div>
					{!migrationPending && (
						<div className={styles.statCard}>
							<span className={styles.statValue}>{pendingCount}</span>
							<span className={styles.statLabel}>
								{pendingCount === 1 ? "Invitación pendiente" : "Invitaciones pendientes"}
							</span>
						</div>
					)}
				</div>
			)}

			{/* Loading */}
			{loading && (
				<div className={styles.empty}>
					<span className={styles.emptyIcon}>⬡</span>
					<p>Cargando personal…</p>
				</div>
			)}

			{/* Error */}
			{!loading && error && (
				<div className={styles.errorBox}>
					{error}
					<button className={styles.btnRetry} onClick={() => void load()}>Reintentar</button>
				</div>
			)}

			{/* Empty */}
			{!loading && !error && staff.length === 0 && (
				<div className={styles.empty}>
					<span className={styles.emptyIcon}>👥</span>
					<p>No hay colaboradores registrados en esta clínica.</p>
				</div>
			)}

			{/* Staff table */}
			{!loading && !error && staff.length > 0 && (
				<div className={styles.tableWrapper}>
					<table className={styles.table}>
						<thead>
							<tr>
								<th>Nombre</th>
								<th>Correo</th>
								<th>Rol</th>
								<th>Estado</th>
								{isAdmin && <th>Acciones</th>}
							</tr>
						</thead>
						<tbody>
							{staff.map((m) => {
								const isSelf    = m.id === member?.id
								const isBusy    = saving[m.id] || saving[`active_${m.id}`]
								const rowError  = saveError[m.id] ?? saveError[`active_${m.id}`]

								return (
									<tr key={m.id} className={styles.row}>
										{/* Name */}
										<td>
											<div className={styles.memberCell}>
												<span className={styles.avatar}>
													{(displayName(m)[0] ?? "?").toUpperCase()}
												</span>
												<span className={styles.memberName}>
													{displayName(m)}
													{isSelf && (
														<span className={styles.selfBadge}>tú</span>
													)}
												</span>
											</div>
										</td>

										{/* Email */}
										<td>
											<span className={styles.emailCell}>{m.email ?? "—"}</span>
										</td>

										{/* Role */}
										<td>
											{isAdmin && !isSelf ? (
												<select
													className={styles.roleSelect}
													value={m.role}
													disabled={isBusy}
													onChange={(e) =>
														void handleRoleChange(
															m,
															e.target.value as StaffMember["role"],
														)
													}
												>
													{ROLE_OPTIONS.map((o) => (
														<option key={o.value} value={o.value}>
															{o.label}
														</option>
													))}
												</select>
											) : (
												<span className={`${styles.roleBadge} ${styles[`role_${m.role}`]}`}>
													{ROLE_LABELS[m.role] ?? m.role}
												</span>
											)}
										</td>

										{/* Status */}
										<td>
											<span className={`${styles.statusBadge} ${m.is_active ? styles.statusActive : styles.statusInactive}`}>
												{m.is_active ? "Activo" : "Inactivo"}
											</span>
										</td>

										{/* Actions */}
										{isAdmin && (
											<td>
												{rowError && (
													<span className={styles.rowError}>{rowError}</span>
												)}
												{!isSelf ? (
													<button
														className={`${styles.btnToggle} ${m.is_active ? styles.btnDeactivate : styles.btnActivate}`}
														onClick={() => void handleToggleActive(m)}
														disabled={isBusy}
													>
														{isBusy ? "…" : m.is_active ? "Desactivar" : "Activar"}
													</button>
												) : (
													<span className={styles.selfNote}>Tu cuenta</span>
												)}
											</td>
										)}
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			)}

			{/* Pending invitations */}
			{!loading && !error && !migrationPending && invitations.length > 0 && (
				<div className={styles.invitationsSection}>
					<h2 className={styles.sectionTitle}>Invitaciones pendientes</h2>
					<div className={styles.tableWrapper}>
						<table className={styles.table}>
							<thead>
								<tr>
									<th>Correo</th>
									<th>Rol</th>
									<th>Expira</th>
									{isAdmin && <th>Acciones</th>}
								</tr>
							</thead>
							<tbody>
								{invitations.map((inv) => (
									<tr key={inv.id} className={styles.row}>
										<td>
											<span className={styles.emailCell}>{inv.email}</span>
										</td>
										<td>
											<span className={`${styles.roleBadge} ${styles[`role_${inv.role}`]}`}>
												{ROLE_LABELS[inv.role] ?? inv.role}
											</span>
										</td>
										<td>
											<span className={styles.dateCell}>
												{new Date(inv.expires_at).toLocaleDateString("es-AR", {
													day: "numeric",
													month: "short",
													year: "numeric",
												})}
											</span>
										</td>
										{isAdmin && (
											<td>
												<button
													className={`${styles.btnToggle} ${styles.btnDeactivate}`}
													onClick={() => void handleCancelInvitation(inv.id)}
													disabled={cancelingId === inv.id}
												>
													{cancelingId === inv.id ? "…" : "Cancelar"}
												</button>
											</td>
										)}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Invite modal */}
			{showInvite && (
				<InviteModal
					onClose={() => setShowInvite(false)}
					onInvited={() => {
						setShowInvite(false)
						void load()
					}}
				/>
			)}
		</div>
	)
}
