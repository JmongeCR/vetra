import { useState, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useWallet } from "../hooks/useWallet"
import { createPet, generateVetId } from "../services/petStorage"
import { createPetInDb, updatePetPhotoPath } from "../services/petDb"
import { uploadPetPhoto, validatePhoto } from "../services/photoStorage"
import { getCurrentProfileId, isSupabaseAuthenticated } from "../services/authBridge"
import { supabaseConfigured } from "../lib/supabase"
import type { PetSpecies, PetSex } from "../types/pet"
import { SPECIES_LABELS, SEX_LABELS } from "../types/pet"
import styles from "./MascotaNueva.module.css"

const SPECIES_OPTIONS: PetSpecies[] = [
	"dog", "cat", "bird", "rabbit", "reptile", "other",
]

const SEX_OPTIONS: PetSex[] = ["male", "female", "unknown"]

export default function MascotaNueva() {
	const navigate = useNavigate()
	const { address } = useWallet()
	const photoRef = useRef<HTMLInputElement>(null)

	const [form, setForm] = useState({
		name: "",
		species: "dog" as PetSpecies,
		breed: "",
		sex: "unknown" as PetSex,
		birthDate: "",
		birthDateEstimated: false,
		color: "",
		microchip: "",
	})
	const [photoFile, setPhotoFile] = useState<File | undefined>()
	const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>()
	const [photoPreview, setPhotoPreview] = useState<string | undefined>()
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState("")

	function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
		setForm((f) => ({ ...f, [key]: value }))
	}

	function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0]
		if (!file) return
		const validationError = validatePhoto(file)
		if (validationError) {
			setError(validationError.message)
			return
		}
		setPhotoFile(file)
		const reader = new FileReader()
		reader.onload = (ev) => {
			const url = ev.target?.result as string
			setPhotoDataUrl(url)
			setPhotoPreview(url)
		}
		reader.readAsDataURL(file)
	}

	function validate(): string {
		if (!form.name.trim()) return "El nombre es obligatorio."
		if (!form.color.trim()) return "El color es obligatorio."
		return ""
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		const msg = validate()
		if (msg) { setError(msg); return }
		setSaving(true)
		setError("")
		try {
			if (supabaseConfigured) {
				// Supabase mode: require authentication — do NOT silently fall back to
				// localStorage (that would make the user think the record is in the cloud).
				const authenticated = await isSupabaseAuthenticated()
				if (!authenticated) {
					setError("Conectá tu billetera Cavos y autentícate con Supabase antes de registrar una mascota en la nube.")
					setSaving(false)
					return
				}
				const profileId = await getCurrentProfileId()
				if (!profileId) {
					setError("No se encontró tu perfil en la base de datos. Intentá cerrar sesión y volver a autenticarte.")
					setSaving(false)
					return
				}

				const pet = await createPetInDb({
					profileId,
					vetId: generateVetId(),
					name: form.name.trim(),
					species: form.species,
					breed: form.breed.trim() || undefined,
					sex: form.sex,
					birthDate: form.birthDate || undefined,
					birthDateEstimated: form.birthDateEstimated,
					color: form.color.trim(),
					microchip: form.microchip.trim() || undefined,
				})
				if (photoFile) {
					try {
						const path = await uploadPetPhoto(pet.id, photoFile)
						await updatePetPhotoPath(pet.id, path)
					} catch {
						// Photo upload failure is non-fatal — the pet record is already saved
					}
				}
				navigate(`/mascotas/${pet.id}`)
			} else {
				// Local-only mode (Supabase not configured — intentional, not a fallback)
				const pet = createPet({
					name: form.name.trim(),
					species: form.species,
					breed: form.breed.trim() || undefined,
					sex: form.sex,
					birthDate: form.birthDate || undefined,
					birthDateEstimated: form.birthDateEstimated,
					color: form.color.trim(),
					microchip: form.microchip.trim() || undefined,
					photoDataUrl,
					ownerAddress: address,
				})
				navigate(`/mascotas/${pet.id}`)
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Error desconocido"
			setError(`No se pudo guardar el registro: ${msg}`)
		} finally {
			setSaving(false)
		}
	}

	return (
		<div className={styles.page}>
			<div className={styles.breadcrumb}>
				<Link to="/mascotas">Mis mascotas</Link>
				<span> / </span>
				<span>Nueva mascota</span>
			</div>

			<h1 className={styles.title}>Registrar mascota</h1>
			<p className={styles.subtitle}>
				Se generará un identificador universal VET-XXXXXX. El registro es local
				hasta que la identidad sea certificada y verificada en la red.
			</p>

			<form onSubmit={handleSubmit} className={styles.form} noValidate>
				{/* ── Fotografía ── */}
				<section className={styles.section}>
					<h2 className={styles.sectionTitle}>Fotografía</h2>
					<div
						className={styles.photoArea}
						onClick={() => photoRef.current?.click()}
						role="button"
						tabIndex={0}
						onKeyDown={(e) => e.key === "Enter" && photoRef.current?.click()}
					>
						{photoPreview ? (
							<img src={photoPreview} alt="Preview" className={styles.photoPreview} />
						) : (
							<div className={styles.photoPlaceholder}>
								<span>📷</span>
								<p>Haz clic para agregar una fotografía (opcional, máx. 2 MB)</p>
							</div>
						)}
					</div>
					<input
						ref={photoRef}
						type="file"
						accept="image/*"
						className={styles.hidden}
						onChange={handlePhoto}
					/>
				</section>

				{/* ── Datos básicos ── */}
				<section className={styles.section}>
					<h2 className={styles.sectionTitle}>Datos básicos</h2>
					<div className={styles.fieldGrid}>
						<div className={styles.field}>
							<label className={styles.label} htmlFor="name">
								Nombre <span className={styles.required}>*</span>
							</label>
							<input
								id="name"
								type="text"
								className={styles.input}
								value={form.name}
								onChange={(e) => set("name", e.target.value)}
								placeholder="Ej: Luna"
								maxLength={60}
								required
							/>
						</div>

						<div className={styles.field}>
							<label className={styles.label} htmlFor="species">
								Especie <span className={styles.required}>*</span>
							</label>
							<select
								id="species"
								className={styles.input}
								value={form.species}
								onChange={(e) => set("species", e.target.value as PetSpecies)}
							>
								{SPECIES_OPTIONS.map((s) => (
									<option key={s} value={s}>{SPECIES_LABELS[s]}</option>
								))}
							</select>
						</div>

						<div className={styles.field}>
							<label className={styles.label} htmlFor="breed">
								Raza <span className={styles.optional}>(opcional)</span>
							</label>
							<input
								id="breed"
								type="text"
								className={styles.input}
								value={form.breed}
								onChange={(e) => set("breed", e.target.value)}
								placeholder="Ej: Labrador Retriever"
								maxLength={80}
							/>
						</div>

						<div className={styles.field}>
							<label className={styles.label} htmlFor="sex">
								Sexo <span className={styles.required}>*</span>
							</label>
							<select
								id="sex"
								className={styles.input}
								value={form.sex}
								onChange={(e) => set("sex", e.target.value as PetSex)}
							>
								{SEX_OPTIONS.map((s) => (
									<option key={s} value={s}>{SEX_LABELS[s]}</option>
								))}
							</select>
						</div>

						<div className={styles.field}>
							<label className={styles.label} htmlFor="color">
								Color <span className={styles.required}>*</span>
							</label>
							<input
								id="color"
								type="text"
								className={styles.input}
								value={form.color}
								onChange={(e) => set("color", e.target.value)}
								placeholder="Ej: Dorado con manchas blancas"
								maxLength={80}
							/>
						</div>
					</div>
				</section>

				{/* ── Fecha de nacimiento ── */}
				<section className={styles.section}>
					<h2 className={styles.sectionTitle}>Fecha de nacimiento</h2>
					<div className={styles.fieldGrid}>
						<div className={styles.field}>
							<label className={styles.label} htmlFor="birthDate">
								Fecha <span className={styles.optional}>(opcional)</span>
							</label>
							<input
								id="birthDate"
								type="date"
								className={styles.input}
								value={form.birthDate}
								max={new Date().toISOString().split("T")[0]}
								onChange={(e) => set("birthDate", e.target.value)}
							/>
						</div>
						<div className={`${styles.field} ${styles.checkField}`}>
							<label className={styles.checkLabel}>
								<input
									type="checkbox"
									checked={form.birthDateEstimated}
									onChange={(e) => set("birthDateEstimated", e.target.checked)}
								/>
								Fecha estimada (no exacta)
							</label>
						</div>
					</div>
				</section>

				{/* ── Identificación ── */}
				<section className={styles.section}>
					<h2 className={styles.sectionTitle}>Identificación</h2>
					<div className={styles.fieldGrid}>
						<div className={styles.field}>
							<label className={styles.label} htmlFor="microchip">
								Microchip <span className={styles.optional}>(opcional)</span>
							</label>
							<input
								id="microchip"
								type="text"
								className={styles.input}
								value={form.microchip}
								onChange={(e) => set("microchip", e.target.value)}
								placeholder="Número de microchip ISO 11784"
								maxLength={20}
							/>
						</div>
					</div>
				</section>

				{error && <p className={styles.error}>{error}</p>}

				<div className={styles.actions}>
					<Link to="/mascotas" className={styles.btnSecondary}>
						Cancelar
					</Link>
					<button
						type="submit"
						className={styles.btnPrimary}
						disabled={saving}
					>
						{saving ? "Guardando…" : "Registrar mascota"}
					</button>
				</div>
			</form>
		</div>
	)
}
