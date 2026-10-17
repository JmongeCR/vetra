import { useState, useEffect } from "react"
import { useClinicAuthContext } from "../contexts/clinicAuthContext"
import {
    fetchClinicSettings,
    updateClinicSettings,
    type ClinicSettings,
    type ClinicSettingsUpdate,
} from "../services/clinicSettingsDb"
import styles from "./Configuracion.module.css"

const CR_PROVINCES = [
    "San José", "Alajuela", "Cartago", "Heredia",
    "Guanacaste", "Puntarenas", "Limón",
]

const VERIFICATION_LABELS: Record<string, string> = {
    pending_verification: "Pendiente de verificación",
    verified:             "Verificada",
    suspended:            "Suspendida",
}

export default function Configuracion() {
    const { member } = useClinicAuthContext()
    const isAdmin = member?.role === "admin"

    const [settings, setSettings]   = useState<ClinicSettings | null>(null)
    const [form, setForm]            = useState<ClinicSettingsUpdate | null>(null)
    const [loading, setLoading]      = useState(true)
    const [loadError, setLoadError]  = useState<string | null>(null)
    const [saving, setSaving]        = useState(false)
    const [saveError, setSaveError]  = useState<string | null>(null)
    const [savedAt, setSavedAt]      = useState<Date | null>(null)

    useEffect(() => {
        if (!member?.clinicId) return
        void (async () => {
            setLoading(true)
            setLoadError(null)
            const res = await fetchClinicSettings(member.clinicId)
            setLoading(false)
            if (res.error || !res.data) { setLoadError(res.error ?? "Error al cargar datos"); return }
            setSettings(res.data)
            setForm({
                name:     res.data.name,
                address:  res.data.address  ?? "",
                phone:    res.data.phone    ?? "",
                email:    res.data.email    ?? "",
                legal_id: res.data.legal_id ?? "",
                province: res.data.province ?? "",
                canton:   res.data.canton   ?? "",
                district: res.data.district ?? "",
            })
        })()
    }, [member?.clinicId])

    function set(field: keyof ClinicSettingsUpdate) {
        return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            setForm((prev) => prev ? { ...prev, [field]: e.target.value } : prev)
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        if (!form || !member?.clinicId) return
        if (!form.name.trim()) { setSaveError("El nombre de la clínica es obligatorio."); return }
        setSaving(true)
        setSaveError(null)
        const res = await updateClinicSettings(member.clinicId, {
            ...form,
            name:     form.name.trim(),
            address:  form.address?.trim()  || null,
            phone:    form.phone?.trim()    || null,
            email:    form.email?.trim()    || null,
            legal_id: form.legal_id?.trim() || null,
            province: form.province?.trim() || null,
            canton:   form.canton?.trim()   || null,
            district: form.district?.trim() || null,
        })
        setSaving(false)
        if (!res.ok) { setSaveError(res.error ?? "Error al guardar"); return }
        setSavedAt(new Date())
        setSettings((prev) => prev ? { ...prev, ...form } : prev)
    }

    // ── Render ────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>Cargando configuración…</div>
            </div>
        )
    }

    if (loadError || !settings || !form) {
        return (
            <div className={styles.page}>
                <div className={styles.errorBox}>
                    {loadError ?? "No se pudieron cargar los datos de la clínica."}
                </div>
            </div>
        )
    }

    return (
        <div className={styles.page}>

            {/* ── Datos de la clínica ──────────────────────────────────────── */}
            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <div>
                        <h2 className={styles.sectionTitle}>Datos de la clínica</h2>
                        <p className={styles.sectionDesc}>
                            Información visible para el equipo y los propietarios de mascotas.
                        </p>
                    </div>
                    {/* Verification status badge */}
                    <span
                        className={`${styles.verifyBadge} ${
                            settings.verification_status === "verified"
                                ? styles.verifyOk
                                : settings.verification_status === "suspended"
                                  ? styles.verifyBad
                                  : styles.verifyPending
                        }`}
                    >
                        {VERIFICATION_LABELS[settings.verification_status] ??
                            settings.verification_status}
                    </span>
                </div>

                <form
                    className={styles.form}
                    onSubmit={(e) => void handleSave(e)}
                    noValidate
                >
                    {/* Nombre */}
                    <div className={styles.field}>
                        <label className={styles.label}>
                            Nombre comercial <span className={styles.required}>*</span>
                        </label>
                        <input
                            className={styles.input}
                            type="text"
                            value={form.name}
                            onChange={set("name")}
                            required
                            disabled={!isAdmin || saving}
                            placeholder="Ej: Clínica Veterinaria Los Ángeles"
                        />
                    </div>

                    {/* Cédula + Correo */}
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>Cédula jurídica</label>
                            <input
                                className={styles.input}
                                type="text"
                                value={form.legal_id ?? ""}
                                onChange={set("legal_id")}
                                disabled={!isAdmin || saving}
                                placeholder="3-101-XXXXXX"
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Correo de contacto</label>
                            <input
                                className={styles.input}
                                type="email"
                                value={form.email ?? ""}
                                onChange={set("email")}
                                disabled={!isAdmin || saving}
                                placeholder="clinica@ejemplo.cr"
                            />
                        </div>
                    </div>

                    {/* Teléfono */}
                    <div className={styles.field}>
                        <label className={styles.label}>Teléfono</label>
                        <input
                            className={styles.input}
                            type="tel"
                            value={form.phone ?? ""}
                            onChange={set("phone")}
                            disabled={!isAdmin || saving}
                            placeholder="2222-3333"
                        />
                    </div>

                    <div className={styles.divider} />

                    {/* Provincia + Cantón */}
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>Provincia</label>
                            <select
                                className={styles.input}
                                value={form.province ?? ""}
                                onChange={set("province")}
                                disabled={!isAdmin || saving}
                            >
                                <option value="">Seleccioná</option>
                                {CR_PROVINCES.map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Cantón</label>
                            <input
                                className={styles.input}
                                type="text"
                                value={form.canton ?? ""}
                                onChange={set("canton")}
                                disabled={!isAdmin || saving}
                                placeholder="Ej: Escazú"
                            />
                        </div>
                    </div>

                    {/* Distrito + Dirección */}
                    <div className={styles.field}>
                        <label className={styles.label}>Distrito</label>
                        <input
                            className={styles.input}
                            type="text"
                            value={form.district ?? ""}
                            onChange={set("district")}
                            disabled={!isAdmin || saving}
                            placeholder="Ej: San Rafael"
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Dirección exacta</label>
                        <input
                            className={styles.input}
                            type="text"
                            value={form.address ?? ""}
                            onChange={set("address")}
                            disabled={!isAdmin || saving}
                            placeholder="Ej: 200 m al oeste del parque central"
                        />
                    </div>

                    {/* Registration code (read-only) */}
                    {settings.registration_code && (
                        <div className={styles.field}>
                            <label className={styles.label}>Código de registro</label>
                            <div className={styles.codeField}>
                                <span className={styles.code}>{settings.registration_code}</span>
                                <span className={styles.codeHint}>Solo lectura — asignado por Vetra</span>
                            </div>
                        </div>
                    )}

                    {/* Feedback */}
                    {saveError && <div className={styles.error}>{saveError}</div>}
                    {savedAt && !saveError && (
                        <div className={styles.success}>
                            Cambios guardados correctamente.
                        </div>
                    )}

                    {isAdmin ? (
                        <div className={styles.actions}>
                            <button
                                className={styles.btnSave}
                                type="submit"
                                disabled={saving}
                            >
                                {saving ? "Guardando…" : "Guardar cambios"}
                            </button>
                        </div>
                    ) : (
                        <div className={styles.readOnlyNote}>
                            Solo el administrador puede editar estos datos.
                        </div>
                    )}
                </form>
            </section>

            {/* ── Integración Vetra Core ───────────────────────────────────── */}
            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <div>
                        <h2 className={styles.sectionTitle}>Integración Vetra Core</h2>
                        <p className={styles.sectionDesc}>
                            Conexión con el sistema central de identidad digital de mascotas.
                        </p>
                    </div>
                    <span className={styles.verifyPending + " " + styles.verifyBadge}>
                        Próxima fase
                    </span>
                </div>

                <div className={styles.integrationCard}>
                    <div className={styles.integrationRow}>
                        <span className={styles.integrationIcon}>🔗</span>
                        <div>
                            <strong>Vetra Core — Pasaportes digitales</strong>
                            <p>
                                Vetra Clinic se integrará con Vetra Core para consultar y actualizar
                                pasaportes digitales de mascotas en la red Stellar Testnet. Esta
                                funcionalidad estará disponible cuando la integración esté certificada
                                y activada para tu clínica.
                            </p>
                        </div>
                    </div>
                    <div className={styles.integrationRow}>
                        <span className={styles.integrationIcon}>🛡️</span>
                        <div>
                            <strong>Solicitudes de acceso</strong>
                            <p>
                                Las solicitudes de acceso a expedientes ya están operativas desde el
                                módulo de Pacientes. La integración con Vetra Core amplía estos
                                permisos al historial en blockchain.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
