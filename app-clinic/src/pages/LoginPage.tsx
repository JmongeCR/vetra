import { useState } from 'react'
import styles from './LoginPage.module.css'
import { useClinicAuth } from '../hooks/useClinicAuth'
import { clinicSupabaseConfigured } from '../lib/supabase'

type Mode = 'signin' | 'signup' | 'forgot' | 'forgot_sent' | 'recovery' | 'signup_confirm'

interface Props {
  /** When true the component renders the "set new password" recovery form */
  recoveryMode?: boolean
}

export default function LoginPage({ recoveryMode }: Props) {
  const auth = useClinicAuth()
  const [mode, setMode] = useState<Mode>(recoveryMode ? 'recovery' : 'signin')

  // Shared fields
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState<string | null>(null)

  function reset(next: Mode) {
    setError(null)
    setPassword('')
    setConfirm('')
    setMode(next)
  }

  // ── Sign in ──────────────────────────────────────────────────────────────────

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await auth.signInWithPassword(email.trim(), password)
    setBusy(false)
    if (!res.ok) setError(res.error ?? 'Error al iniciar sesión')
  }

  // ── Sign up ──────────────────────────────────────────────────────────────────

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    if (password.length < 6)  { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    setBusy(true); setError(null)
    const res = await auth.signUp(email.trim(), password)
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'Error al crear la cuenta'); return }
    if (res.emailConfirmationRequired) setMode('signup_confirm')
    // else: onAuthStateChange fires → AppShell takes over automatically
  }

  // ── Forgot password ──────────────────────────────────────────────────────────

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await auth.sendPasswordReset(email.trim())
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'Error al enviar el correo'); return }
    setMode('forgot_sent')
  }

  // ── Recovery (set new password) ──────────────────────────────────────────────

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    if (password.length < 6)  { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    setBusy(true); setError(null)
    const res = await auth.updatePassword(password)
    setBusy(false)
    if (!res.ok) setError(res.error ?? 'Error al actualizar la contraseña')
    // on success: recoveryMode becomes false → AppShell re-renders normally
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const activeMode = recoveryMode ? 'recovery' : mode

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* Brand */}
        <div className={styles.brand}>
          <span className={styles.brandMark}>⬡</span>
          <div>
            <span className={styles.brandName}>Vetra</span>
            <span className={styles.brandBadge}>Clinic</span>
          </div>
        </div>

        {/* Supabase not configured */}
        {!clinicSupabaseConfigured && (
          <div className={styles.notice}>
            <strong>Configuración pendiente</strong>
            <p>Agregá <code>PUBLIC_SUPABASE_URL</code> y <code>PUBLIC_SUPABASE_ANON_KEY</code> en las variables de entorno.</p>
          </div>
        )}

        {clinicSupabaseConfigured && (

          <>
            {/* ── Recovery mode ── */}
            {activeMode === 'recovery' && (
              <>
                <h1 className={styles.title}>Nueva contraseña</h1>
                <p className={styles.subtitle}>Elegí una contraseña segura para tu cuenta.</p>
                <form onSubmit={e => void handleRecovery(e)} className={styles.form} noValidate>
                  <div className={styles.field}>
                    <label className={styles.label}>Nueva contraseña</label>
                    <input className={styles.input} type="password" value={password}
                      onChange={e => setPassword(e.target.value)} required minLength={6}
                      placeholder="Mínimo 6 caracteres" autoFocus />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Confirmar contraseña</label>
                    <input className={styles.input} type="password" value={confirm}
                      onChange={e => setConfirm(e.target.value)} required placeholder="Repetí la contraseña" />
                  </div>
                  {error && <div className={styles.error}>{error}</div>}
                  <button className={styles.btnPrimary} type="submit" disabled={busy}>
                    {busy ? 'Guardando…' : 'Guardar contraseña'}
                  </button>
                </form>
              </>
            )}

            {/* ── Tabs: sign in / sign up ── */}
            {(activeMode === 'signin' || activeMode === 'signup') && (
              <>
                <div className={styles.tabs}>
                  <button
                    className={`${styles.tab} ${activeMode === 'signin' ? styles.tabActive : ''}`}
                    onClick={() => reset('signin')}>
                    Iniciar sesión
                  </button>
                  <button
                    className={`${styles.tab} ${activeMode === 'signup' ? styles.tabActive : ''}`}
                    onClick={() => reset('signup')}>
                    Crear cuenta
                  </button>
                </div>

                {/* Sign in */}
                {activeMode === 'signin' && (
                  <form onSubmit={e => void handleSignIn(e)} className={styles.form} noValidate>
                    <div className={styles.field}>
                      <label className={styles.label}>Correo electrónico</label>
                      <input className={styles.input} type="email" value={email}
                        onChange={e => setEmail(e.target.value)} required
                        placeholder="clinica@ejemplo.cr" autoFocus />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Contraseña</label>
                      <input className={styles.input} type="password" value={password}
                        onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                    </div>
                    {error && <div className={styles.error}>{error}</div>}
                    <button className={styles.btnPrimary} type="submit" disabled={busy}>
                      {busy ? 'Ingresando…' : 'Iniciar sesión'}
                    </button>
                    <button type="button" className={styles.linkBtn}
                      onClick={() => { setError(null); setMode('forgot') }}>
                      ¿Olvidaste tu contraseña?
                    </button>
                  </form>
                )}

                {/* Sign up */}
                {activeMode === 'signup' && (
                  <form onSubmit={e => void handleSignUp(e)} className={styles.form} noValidate>
                    <div className={styles.field}>
                      <label className={styles.label}>Correo electrónico</label>
                      <input className={styles.input} type="email" value={email}
                        onChange={e => setEmail(e.target.value)} required
                        placeholder="clinica@ejemplo.cr" autoFocus />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Contraseña</label>
                      <input className={styles.input} type="password" value={password}
                        onChange={e => setPassword(e.target.value)} required
                        placeholder="Mínimo 6 caracteres" />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Confirmar contraseña</label>
                      <input className={styles.input} type="password" value={confirm}
                        onChange={e => setConfirm(e.target.value)} required
                        placeholder="Repetí la contraseña" />
                    </div>
                    {error && <div className={styles.error}>{error}</div>}
                    <button className={styles.btnPrimary} type="submit" disabled={busy}>
                      {busy ? 'Creando cuenta…' : 'Crear cuenta'}
                    </button>
                  </form>
                )}
              </>
            )}

            {/* ── Forgot password ── */}
            {activeMode === 'forgot' && (
              <>
                <h1 className={styles.title}>Recuperar contraseña</h1>
                <p className={styles.subtitle}>Ingresá tu correo y te enviaremos un enlace para restablecer tu contraseña.</p>
                <form onSubmit={e => void handleForgot(e)} className={styles.form} noValidate>
                  <div className={styles.field}>
                    <label className={styles.label}>Correo electrónico</label>
                    <input className={styles.input} type="email" value={email}
                      onChange={e => setEmail(e.target.value)} required
                      placeholder="clinica@ejemplo.cr" autoFocus />
                  </div>
                  {error && <div className={styles.error}>{error}</div>}
                  <button className={styles.btnPrimary} type="submit" disabled={busy}>
                    {busy ? 'Enviando…' : 'Enviar enlace'}
                  </button>
                  <button type="button" className={styles.linkBtn}
                    onClick={() => reset('signin')}>
                    ← Volver al inicio de sesión
                  </button>
                </form>
              </>
            )}

            {/* ── Forgot: email sent ── */}
            {activeMode === 'forgot_sent' && (
              <div className={styles.successState}>
                <span className={styles.successIcon}>✉️</span>
                <h2 className={styles.successTitle}>Revisá tu correo</h2>
                <p className={styles.successDesc}>
                  Te enviamos un enlace de recuperación a <strong>{email}</strong>.<br />
                  Hacé clic en el enlace para establecer una nueva contraseña.
                </p>
                <button className={styles.btnSecondary} onClick={() => reset('signin')}>
                  Volver al inicio de sesión
                </button>
              </div>
            )}

            {/* ── Sign up: confirmation required ── */}
            {activeMode === 'signup_confirm' && (
              <div className={styles.successState}>
                <span className={styles.successIcon}>✉️</span>
                <h2 className={styles.successTitle}>Confirmá tu correo</h2>
                <p className={styles.successDesc}>
                  Te enviamos un correo de confirmación a <strong>{email}</strong>.<br />
                  Hacé clic en el enlace para activar tu cuenta.
                </p>
                <button className={styles.btnSecondary} onClick={() => reset('signin')}>
                  Volver al inicio de sesión
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
