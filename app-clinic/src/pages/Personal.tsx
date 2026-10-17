import { useState, useEffect, useCallback } from "react"
import { useClinicAuthContext } from "../contexts/clinicAuthContext"
import { listStaff, updateStaffRole, updateStaffActive, type StaffMember } from "../services/staffDb"
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

export default function Personal() {
    const { member } = useClinicAuthContext()
    const isAdmin = member?.role === "admin"

    const [staff, setStaff]     = useState<StaffMember[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError]     = useState<string | null>(null)
    const [saving, setSaving]   = useState<Record<string, boolean>>({})
    const [saveError, setSaveError] = useState<Record<string, string>>({})

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        const res = await listStaff()
        setLoading(false)
        if (res.error) { setError(res.error); return }
        setStaff(res.data)
    }, [])

    useEffect(() => { void load() }, [load])

    async function handleRoleChange(m: StaffMember, role: StaffMember["role"]) {
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
        setSaving((p) => ({ ...p, [`active_${m.id}`]: true }))
        setSaveError((p) => { const n = { ...p }; delete n[m.id]; return n })
        const res = await updateStaffActive(m.id, next)
        setSaving((p) => ({ ...p, [`active_${m.id}`]: false }))
        if (!res.ok) {
            setSaveError((p) => ({ ...p, [m.id]: res.error ?? "Error al actualizar estado" }))
            return
        }
        setStaff((prev) => prev.map((s) => s.id === m.id ? { ...s, is_active: next } : s))
    }

    function displayName(m: StaffMember) {
        return m.display_name?.trim() || m.email?.split("@")[0] || "Sin nombre"
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className={styles.page}>

            <div className={styles.toolbar}>
                <h1 className={styles.title}>Personal</h1>
            </div>

            {/* Invitation notice */}
            <div className={styles.notice}>
                <strong>Gestión de accesos</strong>
                <p>
                    Podés cambiar el rol y desactivar el acceso de los colaboradores registrados.
                    La funcionalidad de invitación para nuevos colaboradores estará disponible en
                    la próxima fase — hasta entonces podés agregar miembros directamente desde el
                    panel de Supabase.
                </p>
            </div>

            {/* Content */}
            {loading && (
                <div className={styles.empty}>
                    <span className={styles.emptyIcon}>⬡</span>
                    <p>Cargando personal…</p>
                </div>
            )}

            {!loading && error && (
                <div className={styles.errorBox}>
                    {error}
                    <button className={styles.btnRetry} onClick={() => void load()}>Reintentar</button>
                </div>
            )}

            {!loading && !error && staff.length === 0 && (
                <div className={styles.empty}>
                    <span className={styles.emptyIcon}>👥</span>
                    <p>No hay colaboradores registrados en esta clínica.</p>
                </div>
            )}

            {!loading && !error && staff.length > 0 && (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Colaborador</th>
                                <th>Rol</th>
                                <th>Estado</th>
                                {isAdmin && <th>Acciones</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {staff.map((m) => {
                                const isSelf     = m.id === member?.id
                                const isBusy     = saving[m.id] || saving[`active_${m.id}`]
                                const rowError   = saveError[m.id]

                                return (
                                    <tr key={m.id} className={styles.row}>
                                        {/* Name + email */}
                                        <td>
                                            <div className={styles.memberCell}>
                                                <span className={styles.avatar}>
                                                    {(displayName(m)[0] ?? "?").toUpperCase()}
                                                </span>
                                                <div>
                                                    <span className={styles.memberName}>
                                                        {displayName(m)}
                                                        {isSelf && (
                                                            <span className={styles.selfBadge}>tú</span>
                                                        )}
                                                    </span>
                                                    {m.email && (
                                                        <span className={styles.memberEmail}>
                                                            {m.email}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
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
                                                <span
                                                    className={`${styles.roleBadge} ${styles[`role_${m.role}`]}`}
                                                >
                                                    {ROLE_LABELS[m.role] ?? m.role}
                                                </span>
                                            )}
                                        </td>

                                        {/* Status */}
                                        <td>
                                            <span
                                                className={`${styles.statusBadge} ${
                                                    m.is_active
                                                        ? styles.statusActive
                                                        : styles.statusInactive
                                                }`}
                                            >
                                                {m.is_active ? "Activo" : "Inactivo"}
                                            </span>
                                        </td>

                                        {/* Actions (admin only) */}
                                        {isAdmin && (
                                            <td>
                                                {rowError && (
                                                    <span className={styles.rowError}>{rowError}</span>
                                                )}
                                                {!isSelf && (
                                                    <button
                                                        className={`${styles.btnToggle} ${
                                                            m.is_active
                                                                ? styles.btnDeactivate
                                                                : styles.btnActivate
                                                        }`}
                                                        onClick={() => void handleToggleActive(m)}
                                                        disabled={isBusy}
                                                    >
                                                        {isBusy
                                                            ? "…"
                                                            : m.is_active
                                                              ? "Desactivar"
                                                              : "Activar"}
                                                    </button>
                                                )}
                                                {isSelf && (
                                                    <span className={styles.selfNote}>
                                                        Tu cuenta
                                                    </span>
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

            {!loading && !error && staff.length > 0 && (
                <p className={styles.count}>
                    {staff.filter((s) => s.is_active).length} activo
                    {staff.filter((s) => s.is_active).length !== 1 ? "s" : ""} ·{" "}
                    {staff.length} en total
                </p>
            )}
        </div>
    )
}
