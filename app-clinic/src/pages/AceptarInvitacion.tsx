import { useState, useEffect, useRef } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { supabase, clinicSupabaseConfigured } from "../lib/supabase"
import { acceptInvitation } from "../services/staffDb"
import styles from "./AceptarInvitacion.module.css"

type State =
	| { type: "loading" }
	| { type: "auth_wait" }
	| { type: "success"; clinicName: string | null }
	| { type: "error"; message: string }

export default function AceptarInvitacion() {
	const [searchParams] = useSearchParams()
	const navigate = useNavigate()
	const token = searchParams.get("token")
	const [state, setState] = useState<State>({ type: "loading" })
	const accepted = useRef(false)

	async function doAccept(tok: string) {
		if (accepted.current) return
		accepted.current = true
		setState({ type: "loading" })
		const res = await acceptInvitation(tok)
		if (res.ok) {
			setState({ type: "success", clinicName: res.clinicName ?? null })
		} else {
			accepted.current = false
			setState({ type: "error", message: res.error ?? "Error desconocido" })
		}
	}

	useEffect(() => {
		if (!clinicSupabaseConfigured) {
			setState({ type: "error", message: "Supabase no está configurado." })
			return
		}
		if (!token) {
			setState({ type: "error", message: "El enlace no contiene un token válido." })
			return
		}

		// Check if already authenticated
		void supabase.auth.getSession().then(({ data: { session } }) => {
			if (session) {
				void doAccept(token)
			} else {
				setState({ type: "auth_wait" })
			}
		})

		// Listen for magic-link auto sign-in
		const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
			if (event === "SIGNED_IN" && session) {
				void doAccept(token)
			}
		})

		return () => { subscription.unsubscribe() }
	// doAccept is stable (uses ref); token comes from URL and doesn't change
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [token])

	// Redirect to dashboard after success
	useEffect(() => {
		if (state.type !== "success") return
		const t = setTimeout(() => { void navigate("/") }, 2800)
		return () => clearTimeout(t)
	}, [state, navigate])

	return (
		<div className={styles.page}>
			<div className={styles.card}>
				<div className={styles.brand}>
					<span className={styles.logoMark}>⬡</span>
					<span className={styles.logoName}>Vetra</span>
					<span className={styles.logoBadge}>Clinic</span>
				</div>

				{(state.type === "loading" || state.type === "auth_wait") && (
					<div className={styles.status}>
						<div className={styles.spinner} />
						<p className={styles.statusText}>
							{state.type === "auth_wait"
								? "Verificando tu identidad…"
								: "Procesando invitación…"}
						</p>
						{state.type === "auth_wait" && (
							<p className={styles.hint}>
								Si llegás desde el correo de invitación, esperá un momento mientras
								iniciamos tu sesión automáticamente.
							</p>
						)}
					</div>
				)}

				{state.type === "success" && (
					<div className={styles.success}>
						<span className={styles.successIcon}>✓</span>
						<h2 className={styles.successTitle}>¡Bienvenido/a!</h2>
						{state.clinicName && (
							<p className={styles.successText}>
								Tu cuenta fue asociada a <strong>{state.clinicName}</strong>.
							</p>
						)}
						<p className={styles.hint}>Redirigiendo al panel…</p>
						<button className={styles.btnPrimary} onClick={() => void navigate("/")}>
							Ir al panel
						</button>
					</div>
				)}

				{state.type === "error" && (
					<div className={styles.errorState}>
						<span className={styles.errorIcon}>!</span>
						<h2 className={styles.errorTitle}>No se pudo aceptar la invitación</h2>
						<p className={styles.errorText}>{state.message}</p>
						<button className={styles.btnPrimary} onClick={() => void navigate("/")}>
							Ir al panel
						</button>
					</div>
				)}
			</div>
		</div>
	)
}
