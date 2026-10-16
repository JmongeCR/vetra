import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import styles from "./PasaporteBusqueda.module.css"

export default function PasaporteBusqueda() {
	const [input, setInput] = useState("")
	const [error, setError] = useState("")
	const navigate = useNavigate()

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		const vetId = input.trim().toUpperCase()
		if (!vetId) {
			setError("Ingresá un identificador VET-ID.")
			return
		}
		setError("")
		void navigate(`/pasaporte/${vetId}`)
	}

	return (
		<div className={styles.page}>
			<div className={styles.card}>
				<div className={styles.header}>
					<span className={styles.brand}>⬡ Vetra</span>
					<span className={styles.label}>Pasaporte Digital</span>
				</div>

				<div className={styles.body}>
					<span className={styles.icon}>🔍</span>
					<h1 className={styles.title}>Buscar pasaporte</h1>
					<p className={styles.desc}>
						Ingresá el identificador único de la mascota para ver su pasaporte
						público.
					</p>

					<form onSubmit={handleSubmit} className={styles.form} noValidate>
						<label htmlFor="vetid-input" className={styles.fieldLabel}>
							VET-ID
						</label>
						<input
							id="vetid-input"
							className={`${styles.input}${error ? ` ${styles.inputError}` : ""}`}
							type="text"
							placeholder="VET-XXXXXXXX"
							value={input}
							onChange={(e) => {
								setInput(e.target.value)
								setError("")
							}}
							autoFocus
							autoComplete="off"
							spellCheck={false}
						/>
						{error && (
							<p className={styles.error} role="alert">
								{error}
							</p>
						)}
						<button type="submit" className={styles.btn}>
							Buscar
						</button>
					</form>
				</div>

				<div className={styles.footer}>
					<Link to="/" className={styles.footerLink}>
						← Volver al inicio
					</Link>
				</div>
			</div>
		</div>
	)
}
