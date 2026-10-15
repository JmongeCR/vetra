// LocalMigration — controlled localStorage → Supabase migration (Sprint 4)
//
// This component:
//   1. Detects pets stored in localStorage.
//   2. Identifies the authenticated owner (Stellar address from useWallet).
//   3. Shows a preview of what will be imported.
//   4. Requests explicit confirmation before writing to Supabase.
//   5. Imports pets one by one, preserving VET-IDs and skipping duplicates.
//   6. Migrates photos from base64 to Supabase Storage.
//   7. Does NOT delete localStorage records automatically.

import { useState } from "react"
import { useWallet } from "../hooks/useWallet"
import { getPets } from "../services/petStorage"
import { getCurrentProfileId, isSupabaseAuthenticated } from "../services/authBridge"
import { createPetInDb } from "../services/petDb"
import { dataUrlToFile, uploadPetPhoto } from "../services/photoStorage"
import { updatePetPhotoPath } from "../services/petDb"
import { supabaseConfigured } from "../lib/supabase"
import type { Pet } from "../types/pet"
import { SPECIES_LABELS, SPECIES_EMOJI } from "../types/pet"
import styles from "./LocalMigration.module.css"

type MigrationStatus = "idle" | "previewing" | "migrating" | "done" | "error"
type PetMigrationResult = { pet: Pet; status: "imported" | "skipped" | "error"; message?: string }

interface LocalMigrationProps {
	onComplete?: () => void
}

export default function LocalMigration({ onComplete }: LocalMigrationProps) {
	const { address } = useWallet()
	const [status, setStatus] = useState<MigrationStatus>("idle")
	const [localPets, setLocalPets] = useState<Pet[]>([])
	const [results, setResults] = useState<PetMigrationResult[]>([])
	const [errorMsg, setErrorMsg] = useState<string>("")

	if (!supabaseConfigured) return null

	const handlePreview = async () => {
		const pets = getPets()
		if (pets.length === 0) return
		// Only show pets that appear to belong to the current wallet
		// (ownerAddress matches, or ownerAddress is undefined — legacy records).
		const relevant = pets.filter(
			(p) => !p.ownerAddress || p.ownerAddress === address,
		)
		setLocalPets(relevant)
		setStatus("previewing")
	}

	const handleMigrate = async () => {
		setStatus("migrating")
		setResults([])

		const supabaseReady = await isSupabaseAuthenticated()
		if (!supabaseReady) {
			setErrorMsg("Autenticá tu billetera con Supabase antes de importar.")
			setStatus("error")
			return
		}

		const profileId = await getCurrentProfileId()
		if (!profileId) {
			setErrorMsg("No se encontró el perfil de usuario en la base de datos.")
			setStatus("error")
			return
		}

		const newResults: PetMigrationResult[] = []
		for (const pet of localPets) {
			try {
				const created = await createPetInDb({
					profileId,
					vetId: pet.vetId,
					name: pet.name,
					species: pet.species,
					breed: pet.breed,
					sex: pet.sex,
					birthDate: pet.birthDate,
					birthDateEstimated: pet.birthDateEstimated,
					color: pet.color,
					microchip: pet.microchip,
				})

				// Migrate photo from base64 to Storage if present.
				if (pet.photoDataUrl) {
					try {
						const file = dataUrlToFile(pet.photoDataUrl, "photo.jpg")
						const path = await uploadPetPhoto(created.id, file)
						await updatePetPhotoPath(created.id, path)
					} catch {
						// Photo migration failure is non-fatal — pet was created successfully.
					}
				}

				newResults.push({ pet, status: "imported" })
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				if (msg.includes("ya está registrado") || msg.includes("DuplicateVetId")) {
					newResults.push({ pet, status: "skipped", message: "Ya existe en la base de datos" })
				} else {
					newResults.push({ pet, status: "error", message: msg })
				}
			}
			setResults([...newResults])
		}
		setStatus("done")
		onComplete?.()
	}

	const localCount = getPets().length

	if (localCount === 0) return null

	return (
		<div className={styles.banner}>
			{status === "idle" && (
				<>
					<span className={styles.icon}>📦</span>
					<div className={styles.text}>
						<strong>Tenés {localCount} mascota{localCount !== 1 ? "s" : ""} guardada{localCount !== 1 ? "s" : ""} solo en este dispositivo.</strong>
						<span> Importalas a la nube para acceder desde cualquier lugar.</span>
					</div>
					<button className={styles.btn} onClick={handlePreview}>
						Ver y migrar
					</button>
				</>
			)}

			{status === "previewing" && (
				<div className={styles.preview}>
					<h3 className={styles.previewTitle}>Mascotas a importar</h3>
					<ul className={styles.petList}>
						{localPets.map((p) => (
							<li key={p.id} className={styles.petItem}>
								<span className={styles.petEmoji}>{SPECIES_EMOJI[p.species]}</span>
								<div>
									<strong>{p.name}</strong>
									<span className={styles.petMeta}> · {SPECIES_LABELS[p.species]} · {p.vetId}</span>
								</div>
							</li>
						))}
					</ul>
					<p className={styles.note}>
						Los registros locales <strong>no se eliminarán</strong> automáticamente.
						{!address && " Conectá tu billetera antes de continuar."}
					</p>
					<div className={styles.actions}>
						<button
							className={styles.btnPrimary}
							onClick={handleMigrate}
							disabled={!address}
						>
							Importar {localPets.length} mascota{localPets.length !== 1 ? "s" : ""}
						</button>
						<button className={styles.btnSecondary} onClick={() => setStatus("idle")}>
							Cancelar
						</button>
					</div>
				</div>
			)}

			{status === "migrating" && (
				<div className={styles.progress}>
					<div className={styles.spinner} />
					<span>Importando {results.length} de {localPets.length}…</span>
					<ul className={styles.resultList}>
						{results.map((r) => (
							<li key={r.pet.id} className={styles[`result_${r.status}`]}>
								{r.status === "imported" ? "✅" : r.status === "skipped" ? "⏭️" : "❌"}{" "}
								{r.pet.name} ({r.pet.vetId}){r.message ? ` — ${r.message}` : ""}
							</li>
						))}
					</ul>
				</div>
			)}

			{status === "done" && (
				<div className={styles.done}>
					<span className={styles.icon}>✅</span>
					<div className={styles.text}>
						<strong>Migración completada.</strong>
						{" "}{results.filter((r) => r.status === "imported").length} importada{results.filter((r) => r.status === "imported").length !== 1 ? "s" : ""},{" "}
						{results.filter((r) => r.status === "skipped").length} omitida{results.filter((r) => r.status === "skipped").length !== 1 ? "s" : ""}.
					</div>
					<button className={styles.btnSecondary} onClick={() => setStatus("idle")}>
						Cerrar
					</button>
				</div>
			)}

			{status === "error" && (
				<div className={styles.error}>
					<span>⚠️ {errorMsg}</span>
					<button className={styles.btnSecondary} onClick={() => setStatus("idle")}>
						Reintentar
					</button>
				</div>
			)}
		</div>
	)
}
