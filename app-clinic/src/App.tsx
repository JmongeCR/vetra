import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Outlet, useLocation } from 'react-router-dom'
import './index.css'
import styles from './App.module.css'
import { useClinicAuth } from './hooks/useClinicAuth'
import { clinicSupabaseConfigured } from './lib/supabase'
import { ClinicAuthContext } from './contexts/clinicAuthContext'
import Pacientes from './pages/Pacientes'
import Dashboard from './pages/Dashboard'
import Solicitudes from './pages/Solicitudes'
import ConsultasStub from './pages/ConsultasStub'
import ExpedientesStub from './pages/ExpedientesStub'
import PersonalStub from './pages/PersonalStub'
import ConfiguracionStub from './pages/ConfiguracionStub'

// ── Nav item definition ───────────────────────────────────────────────────────

interface NavItem {
  to: string
  icon: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',              icon: '📊', label: 'Dashboard' },
  { to: '/pacientes',     icon: '🐾', label: 'Pacientes' },
  { to: '/consultas',     icon: '📋', label: 'Consultas' },
  { to: '/expedientes',   icon: '📁', label: 'Expedientes' },
  { to: '/solicitudes',   icon: '🔔', label: 'Solicitudes' },
  { to: '/personal',      icon: '👥', label: 'Personal' },
  { to: '/configuracion', icon: '⚙️',  label: 'Configuración' },
]

// ── Page title helper ─────────────────────────────────────────────────────────

function usePageTitle(): string {
  const { pathname } = useLocation()
  const item = NAV_ITEMS.find((n) =>
    n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)
  )
  return item?.label ?? 'Vetra Clinic'
}

// ── Inline login form ─────────────────────────────────────────────────────────

function TopBarAuth() {
  const { user, member, loading, memberError, signInWithEmail, signOut } = useClinicAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  if (!clinicSupabaseConfigured) {
    return <span className={styles.clinicLabel}>Supabase no configurado</span>
  }

  if (loading) {
    return <span className={styles.clinicLabel}>Conectando…</span>
  }

  if (user && member) {
    return (
      <div className={styles.authBar}>
        <span className={styles.clinicLabel}>{member.clinicName} · {member.role}</span>
        <button className={styles.btnSignOut} onClick={() => void signOut()}>Salir</button>
      </div>
    )
  }

  if (user && memberError) {
    return (
      <div className={styles.authBar}>
        <span className={styles.authError}>{memberError}</span>
        <button className={styles.btnSignOut} onClick={() => void signOut()}>Salir</button>
      </div>
    )
  }

  if (sent) {
    return <span className={styles.clinicLabel}>✓ Revisá tu correo para el enlace de acceso</span>
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setLoginError(null)
    const res = await signInWithEmail(email.trim())
    setSending(false)
    if (res.ok) setSent(true)
    else setLoginError(res.error ?? 'Error al enviar')
  }

  return (
    <form className={styles.loginForm} onSubmit={(e) => void handleSubmit(e)}>
      <input
        className={styles.loginInput}
        type="email"
        placeholder="Correo de la clínica"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={sending}
      />
      <button className={styles.btnSignIn} type="submit" disabled={sending}>
        {sending ? '…' : 'Entrar'}
      </button>
      {loginError && <span className={styles.authError}>{loginError}</span>}
    </form>
  )
}

// ── Shell layout ──────────────────────────────────────────────────────────────

function AppShell() {
  const title = usePageTitle()
  const auth = useClinicAuth()

  return (
    <ClinicAuthContext.Provider value={auth}>
      <div className={styles.shell}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarBrand}>
            <span className={styles.logoMark}>⬡</span>
            <div>
              <span className={styles.logoName}>Vetra</span>
              <span className={styles.logoBadge}>Clinic</span>
            </div>
          </div>

          <nav className={styles.sidebarNav}>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.navActive : ''}`
                }
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className={styles.sidebarFooter}>
            <span className={styles.sprintBadge}>Sprint 2</span>
            <span className={styles.testnetBadge}>PROTOTIPO</span>
          </div>
        </aside>

        {/* Main content */}
        <div className={styles.content}>
          <header className={styles.topBar}>
            <h1 className={styles.pageTitle}>{title}</h1>
            <div className={styles.topBarRight}>
              <TopBarAuth />
            </div>
          </header>
          <main className={styles.main}>
            <Outlet />
          </main>
        </div>
      </div>
    </ClinicAuthContext.Provider>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/"              element={<Dashboard />} />
          <Route path="/pacientes"     element={<Pacientes />} />
          <Route path="/consultas"     element={<ConsultasStub />} />
          <Route path="/expedientes"   element={<ExpedientesStub />} />
          <Route path="/solicitudes"   element={<Solicitudes />} />
          <Route path="/personal"      element={<PersonalStub />} />
          <Route path="/configuracion" element={<ConfiguracionStub />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
