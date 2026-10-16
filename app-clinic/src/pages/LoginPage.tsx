import { useState } from 'react'
import styles from './LoginPage.module.css'
import { useClinicAuth } from '../hooks/useClinicAuth'
import { clinicSupabaseConfigured } from '../lib/supabase'

export default function LoginPage() {
  const { signInWithEmail } = useClinicAuth()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setError(null)
    const res = await signInWithEmail(email.trim())
    setSending(false)
    if (res.ok) setSent(true)
    else setError(res.error ?? 'Error al enviar el enlace')
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>⬡</span>
          <div>
            <span className={styles.brandName}>Vetra</span>
            <span className={styles.brandBadge}>Clinic</span>
          </div>
        </div>

        {!clinicSupabaseConfigured ? (
          <div className={styles.notice}>
            <strong>Configuración pendiente</strong>
            <p>Agregá <code>PUBLIC_SUPABASE_URL</code> y <code>PUBLIC_SUPABASE_ANON_KEY</code> en las variables de entorno.</p>
          </div>
        ) : sent ? (
          <div className={styles.successState}>
            <span className={styles.successIcon}>✉️</span>
            <h2 className={styles.successTitle}>Revisá tu correo</h2>
            <p className={styles.successDesc}>
              Te enviamos un enlace de acceso a <strong>{email}</strong>.<br />
              Hacé clic en el enlace para ingresar.
            </p>
            <button className={styles.btnSecondary} onClick={() => { setSent(false); setEmail('') }}>
              Usar otro correo
            </button>
          </div>
        ) : (
          <>
            <h1 className={styles.title}>Iniciar sesión</h1>
            <p className={styles.subtitle}>
              Ingresá el correo asociado a tu clínica. Te enviaremos un enlace de acceso.
            </p>

            <form onSubmit={(e) => void handleSubmit(e)} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Correo electrónico</label>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="clinica@ejemplo.cr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={sending}
                  autoFocus
                  required
                />
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <button className={styles.btnPrimary} type="submit" disabled={sending}>
                {sending ? 'Enviando…' : 'Enviar enlace de acceso'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
