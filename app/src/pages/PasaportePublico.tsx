import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { getPetByVetId } from "../services/petStorage"
import { fetchPublicPassport } from "../services/petDb"
import { getSignedPhotoUrl } from "../services/photoStorage"
import { supabaseConfigured } from "../lib/supabase"
import { STELLAR_STATUS_LABELS, explorerTxUrl } from "../services/petIdentity"
import { SPECIES_LABELS, SEX_LABELS, SPECIES_EMOJI } from "../types/pet"
import type { PetSpecies, PetSex, StellarStatus } from "../types/pet"
import styles from "./PasaportePublico.module.css"

// This route is reachable by anyone scanning the QR code.
// It ONLY shows non-sensitive, publicly shareable information:
//   - VET-XXXXXX identifier
//   - Species, breed (no medical data, no owner PII)
//   - Stellar registration status
// It does NOT show: owner name, owner address, medical history, microchip.

interface PassportDisplay {
	vetId: string
	name: string
	species: PetSpecies
	breed?: string
	sex: PetSex
	birthDate?: string
	birthDateEstimated: boolean
	color: string
	photoSrc?: string
	stellarStatus: StellarStatus
	txHash?: string
	source: "db" | "local"
}

export default function PasaportePublico() {
	const { vetId } = useParams<{ vetId: string }>()
	const [passport, setPassport] = useState<PassportDisplay | null | undefined>(undefined)

	useEffect(() => {
		if (!vetId) { setPassport(null); return }

		async function load() {
			// Try the Supabase public view first (no auth required)
			if (supabaseConfigured) {
				try {
					const data = await fetchPublicPassport(vetId!)
					if (data && data.is_public) {
						let photoSrc: string | undefined
						if (data.photo_path) {
							photoSrc = (await getSignedPhotoUrl(data.photo_path)) ?? undefined
						}
						setPassport({
							vetId: data.vet_id,
							name: data.name,
							species: data.species,
							breed: data.breed ?? undefined,
							sex: data.sex,
							birthDate: data.birth_date ?? undefined,
							birthDateEstimated: data.birth_date_estimated,
							color: data.color,
							photoSrc,
							stellarStatus: (data.stellar_status as StellarStatus) ?? "local",
							txHash: data.stellar_tx_hash ?? undefined,
							source: "db",
						})
						return
					}
				} catch {
					// fall through to localStorage
				}
			}

			// Fallback: localStorage (same device only)
			const local = getPetByVetId(vetId!)
			if (local) {
				setPassport({
					vetId: local.vetId,
					name: local.name,
					species: local.species,
					breed: local.breed,
					sex: local.sex,
					birthDate: local.birthDate,
					birthDateEstimated: local.birthDateEstimated,
					color: local.color,
					photoSrc: local.photoUrl ?? local.photoDataUrl,
					stellarStatus: local.stellarStatus,
					source: "local",
				})
				return
			}

			setPassport(null)
		}

		void load()
	}, [vetId])

	// Loading
	if (passport === undefined) return null

	if (!passport) {
		return (
			<div className={styles.page}>
				<div className={styles.notFound}>
					<span className={styles.nfIcon}>📱</span>
					<h1>Pasaporte no disponible</h1>
					<p>
						El identificador <code>{vetId}</code> no se encontró.
					</p>
					<div className={styles.localOnlyBox}>
						<strong>¿Por qué ocurre esto?</strong>
						<p>
							El pasaporte público estará disponible cuando la mascota sea
							registrada en <strong>Vetra</strong> o certificada en{" "}
							<strong>Stellar Testnet</strong>.
						</p>
						<p>
							Si sos el propietario, verificá que hayas guardado el registro
							en Vetra desde tu cuenta.
						</p>
					</div>
					<Link to="/" className={styles.btn}>Ir a Vetra</Link>
				</div>
			</div>
		)
	}

	return (
		<div className={styles.page}>
			<div className={styles.card}>
				<div className={styles.header}>
					<span className={styles.brand}>⬡ Vetra</span>
					<span className={styles.label}>Pasaporte Digital</span>
				</div>

				<div className={styles.photoArea}>
					{passport.photoSrc ? (
						<img
							src={passport.photoSrc}
							alt={passport.name}
							className={styles.photo}
						/>
					) : (
						<span className={styles.emoji}>{SPECIES_EMOJI[passport.species]}</span>
					)}
				</div>

				<div className={styles.body}>
					<h1 className={styles.name}>{passport.name}</h1>
					<p className={styles.species}>
						{SPECIES_LABELS[passport.species]}
						{passport.breed ? ` · ${passport.breed}` : ""}
					</p>

					<dl className={styles.fields}>
						<div className={styles.field}>
							<dt>ID Universal</dt>
							<dd className={styles.vetIdValue}>{passport.vetId}</dd>
						</div>
						<div className={styles.field}>
							<dt>Sexo</dt>
							<dd>{SEX_LABELS[passport.sex]}</dd>
						</div>
						{passport.birthDate && (
							<div className={styles.field}>
								<dt>Nacimiento</dt>
								<dd>
									{new Date(passport.birthDate).toLocaleDateString("es-CR", {
										year: "numeric",
										month: "long",
										day: "numeric",
									})}
									{passport.birthDateEstimated ? " (estimada)" : ""}
								</dd>
							</div>
						)}
						<div className={styles.field}>
							<dt>Color</dt>
							<dd>{passport.color}</dd>
						</div>
					</dl>

					<div className={`${styles.stellarBadge} ${styles[`s_${passport.stellarStatus}`]}`}>
						<span className={styles.dot} />
						{STELLAR_STATUS_LABELS[passport.stellarStatus]}
					</div>

					{passport.stellarStatus === "local" && (
						<p className={styles.note}>
							{passport.source === "local"
								? "Guardado localmente. La identidad aún no fue certificada en Stellar."
								: "Registrada en Vetra. La identidad aún no fue certificada en Stellar."}
						</p>
					)}

					{passport.stellarStatus === "registered" && passport.txHash && (
						<a
							href={explorerTxUrl(passport.txHash)}
							target="_blank"
							rel="noopener noreferrer"
							className={styles.explorerLink}
						>
							Ver certificación en Stellar Explorer →
						</a>
					)}

					<p className={styles.privacy}>
						Este pasaporte no expone datos médicos, historial clínico ni
						información personal del responsable.
					</p>
				</div>

				<div className={styles.footer}>
					<Link to="/" className={styles.footerLink}>
						vetra.app
					</Link>
					<span className={styles.footerSep}>·</span>
					<span>Stellar Testnet</span>
				</div>
			</div>
		</div>
	)
}
