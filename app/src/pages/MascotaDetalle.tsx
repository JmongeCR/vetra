import { useEffect, useState, useRef } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import QRCode from "qrcode"
import { getPetById } from "../services/petStorage"
import { fetchPetById, deletePetFromDb } from "../services/petDb"
import { getSignedPhotoUrl } from "../services/photoStorage"
import { supabaseConfigured } from "../lib/supabase"
import {
	STELLAR_STATUS_LABELS,
	STELLAR_STATUS_DESCRIPTIONS,
} from "../services/petIdentity"
import { SPECIES_LABELS, SEX_LABELS, SPECIES_EMOJI } from "../types/pet"
import type { Pet } from "../types/pet"
import styles from "./MascotaDetalle.module.css"

function formatDate(iso?: string, estimated?: boolean): string {
	if (!iso) return "Desconocida"
	const d = new Date(iso)
	const base = d.toLocaleDateString("es-CR", {
		year: "numeric",
		month: "long",
		day: "numeric",
	})
	return estimated ? `${base} (estimada)` : base
}

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

function shortAddress(addr?: string): string {
	if (!addr) return "—"
	return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function MascotaDetalle() {
	const { id } = useParams<{ id: string }>()
	const navigate = useNavigate()
	const [pet, setPet] = useState<Pet | null>(null)
	const [photoSrc, setPhotoSrc] = useState<string | undefined>()
	const [notFound, setNotFound] = useState(false)
	const [loading, setLoading] = useState(true)
	const [qrDataUrl, setQrDataUrl] = useState<string>("")
	const passportRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!id) { setNotFound(true); setLoading(false); return }

		async function loadPet() {
			let found: Pet | null | undefined = null

			if (supabaseConfigured) {
				try {
					found = await fetchPetById(id!)
				} catch {
					// fall through to localStorage
				}
			}

			if (!found) {
				found = getPetById(id!) ?? null
			}

			if (!found) {
				setNotFound(true)
				setLoading(false)
				return
			}

			setPet(found)
			setLoading(false)

			// Resolve photo: signed Storage URL or base64 fallback
			if (found.photoPath) {
				const url = await getSignedPhotoUrl(found.photoPath)
				setPhotoSrc(url ?? found.photoDataUrl)
			} else {
				setPhotoSrc(found.photoUrl ?? found.photoDataUrl)
			}

			// Generate QR pointing to the public passport route.
			// The URL only carries the pet's vetId — no personal or medical data.
			const passportUrl = `${window.location.origin}/pasaporte/${found.vetId}`
			QRCode.toDataURL(passportUrl, {
				width: 180,
				margin: 1,
				color: { dark: "#4A1942", light: "#FAF8F5" },
			}).then(setQrDataUrl)
		}

		void loadPet()
	}, [id])

	if (loading) return null

	if (notFound) {
		return (
			<div className={styles.page}>
				<div className={styles.notFound}>
					<span>🔍</span>
					<h2>Mascota no encontrada</h2>
					<p>El registro no existe o fue eliminado de este navegador.</p>
					<Link to="/mascotas" className={styles.btnPrimary}>
						Ver mis mascotas
					</Link>
				</div>
			</div>
		)
	}

	if (!pet) return null

	return (
		<div className={styles.page}>
			<div className={styles.breadcrumb}>
				<Link to="/mascotas">Mis mascotas</Link>
				<span> / </span>
				<span>{pet.name}</span>
			</div>

			<div className={styles.layout}>
				{/* ── Left column: passport card ── */}
				<div className={styles.passportWrapper} ref={passportRef}>
					<div className={styles.passport}>
						<div className={styles.passportHeader}>
							<span className={styles.passportBrand}>⬡ Vetra</span>
							<span className={styles.passportLabel}>Pasaporte Digital</span>
						</div>

						<div className={styles.passportPhoto}>
							{photoSrc ? (
								<img
									src={photoSrc}
									alt={pet.name}
									className={styles.passportImg}
								/>
							) : (
								<span className={styles.passportEmoji}>
									{SPECIES_EMOJI[pet.species]}
								</span>
							)}
						</div>

						<div className={styles.passportBody}>
							<h2 className={styles.passportName}>{pet.name}</h2>
							<p className={styles.passportSpecies}>
								{SPECIES_LABELS[pet.species]}
								{pet.breed ? ` · ${pet.breed}` : ""}
							</p>

							<dl className={styles.passportFields}>
								<div className={styles.passportField}>
									<dt>ID Universal</dt>
									<dd className={styles.vetIdValue}>{pet.vetId}</dd>
								</div>
								<div className={styles.passportField}>
									<dt>Sexo</dt>
									<dd>{SEX_LABELS[pet.sex]}</dd>
								</div>
								<div className={styles.passportField}>
									<dt>Nacimiento</dt>
									<dd>{formatDate(pet.birthDate, pet.birthDateEstimated)}</dd>
								</div>
								<div className={styles.passportField}>
									<dt>Edad</dt>
									<dd>{ageLabel(pet)}</dd>
								</div>
								<div className={styles.passportField}>
									<dt>Color</dt>
									<dd>{pet.color}</dd>
								</div>
								{pet.microchip && (
									<div className={styles.passportField}>
										<dt>Microchip</dt>
										<dd>
											<code>{pet.microchip}</code>
										</dd>
									</div>
								)}
								<div className={styles.passportField}>
									<dt>Responsable</dt>
									<dd className={styles.addressValue}>
										{shortAddress(pet.ownerAddress)}
									</dd>
								</div>
								<div className={styles.passportField}>
									<dt>Registrado</dt>
									<dd>
										{new Date(pet.registeredAt).toLocaleDateString("es-CR", {
											year: "numeric",
											month: "short",
											day: "numeric",
										})}
									</dd>
								</div>
							</dl>

							{/* Stellar status */}
							<div
								className={`${styles.stellarStatus} ${styles[`stellar_${pet.stellarStatus}`]}`}
							>
								<div className={styles.stellarStatusHeader}>
									<span className={styles.stellarDot} />
									<strong>
										{STELLAR_STATUS_LABELS[pet.stellarStatus]}
									</strong>
								</div>
								<p className={styles.stellarStatusDesc}>
									{STELLAR_STATUS_DESCRIPTIONS[pet.stellarStatus]}
								</p>
								{pet.stellarStatus === "local" && (
									<p className={styles.stellarNote}>
										El registro en Stellar Testnet estará disponible en
										el Sprint 5 de Vetra.
									</p>
								)}
							</div>

							{/* QR */}
							{qrDataUrl && (
								<div className={styles.qrSection}>
									<img
										src={qrDataUrl}
										alt={`QR del pasaporte de ${pet.name}`}
										className={styles.qr}
									/>
									<p className={styles.qrCaption}>
										Funciona en <strong>este dispositivo</strong>. El pasaporte
										público verificable estará disponible al registrar la
										identidad en Stellar Testnet (Sprint 5).
									</p>
									<p className={styles.qrCaptionSub}>
										No expone datos médicos ni personales.
									</p>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* ── Right column: actions & metadata ── */}
				<aside className={styles.sidebar}>
					<div className={styles.sideCard}>
						<h3 className={styles.sideTitle}>Identidad blockchain</h3>
						<div
							className={`${styles.statusPill} ${styles[`pill_${pet.stellarStatus}`]}`}
						>
							{STELLAR_STATUS_LABELS[pet.stellarStatus]}
						</div>
						{pet.stellarStatus === "local" && (
							<p className={styles.sideNote}>
								El contrato <code>pet-identity</code> está diseñado y listo
								para implementación. El despliegue en Stellar Testnet requiere
								autorización en Sprint 5.
							</p>
						)}
					</div>

					<div className={styles.sideCard}>
						<h3 className={styles.sideTitle}>Identificadores</h3>
						<dl className={styles.idList}>
							<dt>ID Universal</dt>
							<dd className={styles.codeValue}>{pet.vetId}</dd>
							<dt>ID Interno</dt>
							<dd className={styles.codeValueSmall}>{pet.id}</dd>
							{pet.microchip && (
								<>
									<dt>Microchip</dt>
									<dd className={styles.codeValue}>{pet.microchip}</dd>
								</>
							)}
						</dl>
					</div>

					<div className={styles.sideCard}>
						<h3 className={styles.sideTitle}>Acciones</h3>
						<div className={styles.actionList}>
							<button
								className={styles.btnAction}
								onClick={() => window.print()}
							>
								🖨️ Imprimir pasaporte
							</button>
							<button
								className={styles.btnActionDanger}
								onClick={async () => {
									if (
										window.confirm(
											`¿Eliminar el registro de ${pet.name}? Esta acción no puede deshacerse.`,
										)
									) {
										if (supabaseConfigured) {
											try { await deletePetFromDb(pet.id) } catch { /* best-effort */ }
										}
										const { deletePet } = await import("../services/petStorage")
										deletePet(pet.id)
										navigate("/mascotas")
									}
								}}
							>
								🗑️ Eliminar registro
							</button>
						</div>
					</div>

					<p className={styles.disclaimer}>
						⚠️ Registro local · No certificado en blockchain
					</p>
				</aside>
			</div>
		</div>
	)
}
