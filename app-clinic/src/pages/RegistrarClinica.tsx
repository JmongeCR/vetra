import { useState } from "react"
import styles from "./RegistrarClinica.module.css"
import { registerClinic } from "../services/clinicRegistration"
import type { ClinicAuthState } from "../hooks/useClinicAuth"

const CR_PROVINCES = [
    "San José",
    "Alajuela",
    "Cartago",
    "Heredia",
    "Guanacaste",
    "Puntarenas",
    "Limón",
]

interface Props {
    onRegistered: () => Promise<void>
    signOut: ClinicAuthState["signOut"]
}

export default function RegistrarClinica({ onRegistered, signOut }: Props) {
    const [form, setForm] = useState({
        name: "",
        legalId: "",
        email: "",
        phone: "",
        province: "",
        canton: "",
        district: "",
        address: "",
    })
    const [submitting, setSubmitting] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)

    function set(field: keyof typeof form) {
        return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            setForm((prev) => ({ ...prev, [field]: e.target.value }))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setFormError(null)
        if (!form.name.trim()) { setFormError("El nombre de la clínica es obligatorio."); return }
        setSubmitting(true)
        const res = await registerClinic({
            name:     form.name.trim(),
            legalId:  form.legalId.trim(),
            email:    form.email.trim(),
            phone:    form.phone.trim(),
            address:  form.address.trim(),
            province: form.province,
            canton:   form.canton.trim(),
            district: form.district.trim(),
        })
        setSubmitting(false)
        if (!res.ok) { setFormError(res.error); return }
        await onRegistered()
    }

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.brand}>
                    <span className={styles.brandMark}>⬡</span>
                    <span className={styles.brandName}>Vetra</span>
                    <span className={styles.brandBadge}>Clinic</span>
                </div>

                <h1 className={styles.title}>Registrá tu clínica veterinaria</h1>
                <p className={styles.subtitle}>
                    Completá los datos de tu clínica. Una vez registrada, quedará pendiente de
                    verificación por el equipo de Vetra.
                </p>

                <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
                    {/* Nombre comercial */}
                    <div className={styles.field}>
                        <label className={styles.label}>
                            Nombre comercial <span className={styles.required}>*</span>
                        </label>
                        <input
                            className={styles.input}
                            type="text"
                            placeholder="Ej: Clínica Veterinaria Los Ángeles"
                            value={form.name}
                            onChange={set("name")}
                            required
                            disabled={submitting}
                        />
                    </div>

                    {/* Cédula jurídica + Correo */}
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>Cédula jurídica</label>
                            <input
                                className={styles.input}
                                type="text"
                                placeholder="3-101-XXXXXX"
                                value={form.legalId}
                                onChange={set("legalId")}
                                disabled={submitting}
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Correo</label>
                            <input
                                className={styles.input}
                                type="email"
                                placeholder="clinica@ejemplo.cr"
                                value={form.email}
                                onChange={set("email")}
                                disabled={submitting}
                            />
                        </div>
                    </div>

                    {/* Teléfono */}
                    <div className={styles.field}>
                        <label className={styles.label}>Teléfono</label>
                        <input
                            className={styles.input}
                            type="tel"
                            placeholder="2222-3333"
                            value={form.phone}
                            onChange={set("phone")}
                            disabled={submitting}
                        />
                    </div>

                    <div className={styles.divider} />

                    {/* Provincia + Cantón */}
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>Provincia</label>
                            <select
                                className={styles.select}
                                value={form.province}
                                onChange={set("province")}
                                disabled={submitting}
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
                                placeholder="Ej: Escazú"
                                value={form.canton}
                                onChange={set("canton")}
                                disabled={submitting}
                            />
                        </div>
                    </div>

                    {/* Distrito + Dirección */}
                    <div className={styles.field}>
                        <label className={styles.label}>Distrito</label>
                        <input
                            className={styles.input}
                            type="text"
                            placeholder="Ej: San Rafael"
                            value={form.district}
                            onChange={set("district")}
                            disabled={submitting}
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Dirección exacta</label>
                        <input
                            className={styles.input}
                            type="text"
                            placeholder="Ej: 200 m al oeste del parque central"
                            value={form.address}
                            onChange={set("address")}
                            disabled={submitting}
                        />
                    </div>

                    {formError && <div className={styles.error}>{formError}</div>}

                    <button className={styles.btnSubmit} type="submit" disabled={submitting}>
                        {submitting ? "Registrando…" : "Registrar clínica"}
                    </button>
                </form>

                <p className={styles.hint}>
                    ¿Cuenta equivocada?{" "}
                    <button
                        style={{ background: "none", border: "none", color: "var(--color-accent,#8b5cf6)", cursor: "pointer", padding: 0, fontSize: "0.72rem" }}
                        onClick={() => void signOut()}
                    >
                        Cerrar sesión
                    </button>
                </p>
            </div>
        </div>
    )
}
