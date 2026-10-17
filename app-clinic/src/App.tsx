import { BrowserRouter, Routes, Route, NavLink, Outlet, useLocation } from 'react-router-dom'
import './index.css'
import styles from './App.module.css'
import { useClinicAuth } from './hooks/useClinicAuth'
import { ClinicAuthContext } from './contexts/clinicAuthContext'

import LoginPage       from './pages/LoginPage'
import RegistrarClinica from './pages/RegistrarClinica'
import Dashboard        from './pages/Dashboard'
import Agenda           from './pages/Agenda'
import Pacientes        from './pages/Pacientes'
import PacienteDetalle  from './pages/PacienteDetalle'
import Solicitudes      from './pages/Solicitudes'
import PersonalStub     from './pages/PersonalStub'
import ConfiguracionStub from './pages/ConfiguracionStub'

// ── Nav structure ──────────────────────────────────────────────────────────────

interface NavItem { to: string; icon: string; label: string }

const NAV_MAIN: NavItem[] = [
  { to: '/',           icon: '⊞', label: 'Dashboard'   },
  { to: '/agenda',     icon: '📅', label: 'Agenda'      },
  { to: '/pacientes',  icon: '🐾', label: 'Pacientes'   },
  { to: '/solicitudes',icon: '🔔', label: 'Solicitudes' },
]

const NAV_ADMIN: NavItem[] = [
  { to: '/personal',      icon: '👥', label: 'Personal'      },
  { to: '/configuracion', icon: '⚙️',  label: 'Configuración' },
]

// ── Page title helper ──────────────────────────────────────────────────────────

function usePageTitle(): string {
  const { pathname } = useLocation()
  const all = [...NAV_MAIN, ...NAV_ADMIN]
  if (pathname.startsWith('/pacientes/')) return 'Ficha de paciente'
  const item = all.find((n) => n.to === '/' ? pathname === '/' : pathname.startsWith(n.to))
  return item?.label ?? 'Vetra Clinic'
}

// ── Clinic top-bar info ────────────────────────────────────────────────────────

function TopBarInfo() {
  const { member, user, signOut } = useClinicAuth()
  if (!user || !member) return null
  return (
    <div className={styles.authBar}>
      <span className={styles.clinicLabel}>{member.clinicName}</span>
      <button className={styles.btnSignOut} onClick={() => void signOut()}>Salir</button>
    </div>
  )
}

// ── Nav link ───────────────────────────────────────────────────────────────────

function NavItem({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        `${styles.navItem} ${isActive ? styles.navActive : ''}`
      }
    >
      <span className={styles.navIcon}>{item.icon}</span>
      <span className={styles.navLabel}>{item.label}</span>
    </NavLink>
  )
}

// ── Shell layout ───────────────────────────────────────────────────────────────

function AppShell() {
  const auth = useClinicAuth()
  const title = usePageTitle()

  // Unauthenticated → login screen
  if (!auth.loading && !auth.user) {
    return (
      <ClinicAuthContext.Provider value={auth}>
        <LoginPage />
      </ClinicAuthContext.Provider>
    )
  }

  // PASSWORD_RECOVERY event → user must set a new password before entering the app
  if (!auth.loading && auth.recoveryMode) {
    return (
      <ClinicAuthContext.Provider value={auth}>
        <LoginPage recoveryMode />
      </ClinicAuthContext.Provider>
    )
  }

  // Authenticated but no clinic → registration
  if (!auth.loading && auth.user && auth.needsRegistration) {
    return (
      <ClinicAuthContext.Provider value={auth}>
        <RegistrarClinica onRegistered={auth.refreshMembership} signOut={auth.signOut} />
      </ClinicAuthContext.Provider>
    )
  }

  // Loading
  if (auth.loading) {
    return (
      <div className={styles.loadingScreen}>
        <span className={styles.loadingMark}>⬡</span>
      </div>
    )
  }

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
            {NAV_MAIN.map((item) => <NavItem key={item.to} item={item} />)}

            <div className={styles.navSection}>Administración</div>
            {NAV_ADMIN.map((item) => <NavItem key={item.to} item={item} />)}
          </nav>

          <div className={styles.sidebarFooter}>
            {auth.member && (
              <span className={styles.clinicFooterName}>{auth.member.clinicName}</span>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className={styles.content}>
          <header className={styles.topBar}>
            <h1 className={styles.pageTitle}>{title}</h1>
            <div className={styles.topBarRight}>
              <TopBarInfo />
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

// ── Root ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/"                  element={<Dashboard />} />
          <Route path="/agenda"            element={<Agenda />} />
          <Route path="/pacientes"         element={<Pacientes />} />
          <Route path="/pacientes/:id"     element={<PacienteDetalle />} />
          <Route path="/solicitudes"       element={<Solicitudes />} />
          <Route path="/personal"          element={<PersonalStub />} />
          <Route path="/configuracion"     element={<ConfiguracionStub />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
