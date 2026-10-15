import { BrowserRouter, Routes, Route, NavLink, Outlet } from 'react-router-dom'
import './index.css'
import styles from './App.module.css'
import Pacientes from './pages/Pacientes'

// ── Landing page ─────────────────────────────────────────────────────────────

function Landing() {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>Sistema de gestión veterinaria</div>
          <h1 className={styles.heroTitle}>
            Gestión clínica profesional.<br />
            <span className={styles.heroAccent}>Organizada. Segura. Tuya.</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Vetra Clinic es el sistema diseñado para que cada veterinaria administre
            su agenda, expedientes y consultas de forma independiente, con datos
            aislados y trazabilidad completa.
          </p>
          <div className={styles.heroBanner}>
            <span className={styles.heroBannerIcon}>🔒</span>
            <div>
              <strong>Acceso autenticado requerido</strong>
              <p>
                Esta interfaz estará disponible únicamente para personal autorizado
                de cada clínica. La autenticación se implementará en la siguiente fase.
              </p>
            </div>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.dashboardMock}>
            <div className={styles.mockSidebar}>
              <div className={styles.mockSidebarItem + ' ' + styles.mockActive}>📅 Agenda</div>
              <div className={styles.mockSidebarItem}>🐾 Pacientes</div>
              <div className={styles.mockSidebarItem}>📋 Expedientes</div>
              <div className={styles.mockSidebarItem}>💉 Vacunas</div>
              <div className={styles.mockSidebarItem}>👥 Personal</div>
            </div>
            <div className={styles.mockContent}>
              <div className={styles.mockHeader}>Agenda de hoy</div>
              {[
                { time: '08:00', pet: 'Max', owner: 'A. García', type: 'Control' },
                { time: '09:30', pet: 'Mia', owner: 'L. Mora', type: 'Vacuna' },
                { time: '11:00', pet: 'Rocky', owner: 'C. Vega', type: 'Consulta' },
              ].map((apt) => (
                <div key={apt.time} className={styles.mockAppt}>
                  <span className={styles.mockTime}>{apt.time}</span>
                  <div className={styles.mockApptInfo}>
                    <strong>{apt.pet}</strong>
                    <span>{apt.owner}</span>
                  </div>
                  <span className={styles.mockType}>{apt.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.features} id="funcionalidades">
        <h2 className={styles.sectionTitle}>Funcionalidades previstas</h2>
        <div className={styles.featureGrid}>
          {[
            { icon: '📅', title: 'Agenda y citas', desc: 'Calendario por profesional, estados de citas, horarios y disponibilidad.' },
            { icon: '🐾', title: 'Expedientes clínicos', desc: 'Historial completo, antecedentes, alergias, diagnósticos y tratamientos.' },
            { icon: '📝', title: 'Anamnesis', desc: 'Formularios adaptables por especie con motivo de consulta y examen físico.' },
            { icon: '⚙️', title: 'Consultas personalizables', desc: 'Plantillas clínicas con campos configurables por tipo de atención.' },
            { icon: '👥', title: 'Gestión de personal', desc: 'Profesionales, roles, permisos y configuración individual por clínica.' },
            { icon: '🔗', title: 'Identidad Vetra', desc: 'Integración con el identificador universal VET-XXXXXX para localizar pacientes.' },
          ].map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.isolation} id="modelo">
        <div className={styles.isolationContent}>
          <h2>Aislamiento total entre clínicas</h2>
          <p>
            Cada veterinaria opera sobre su propia base de datos independiente.
            Ninguna clínica puede consultar ni modificar los registros de otra.
          </p>
          <div className={styles.isolationDiagram}>
            <div className={styles.diagCore}>
              <strong>Vetra Core</strong>
              <span>Identidad · Autorizaciones</span>
            </div>
            <div className={styles.diagArrows}>
              {['Clínica A', 'Clínica B', 'Clínica C'].map((c) => (
                <div key={c} className={styles.diagClinic}>
                  <div className={styles.diagArrow}>↓</div>
                  <div className={styles.diagClinicBox}>
                    <strong>{c}</strong>
                    <span>BD independiente</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

// ── App shell layout ──────────────────────────────────────────────────────────

function AppShell() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.headerBrand}>
          <span className={styles.logoMark}>⬡</span>
          <div>
            <span className={styles.logoName}>Vetra</span>
            <span className={styles.logoBadge}>Clinic</span>
          </div>
        </NavLink>
        <nav className={styles.headerNav}>
          <NavLink to="/" end className={({ isActive }) => isActive ? styles.navActive : ''}>
            Inicio
          </NavLink>
          <NavLink to="/pacientes" className={({ isActive }) => isActive ? styles.navActive : ''}>
            Pacientes
          </NavLink>
        </nav>
        <div className={styles.headerActions}>
          <span className={styles.devBadge}>Sprint 2</span>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>
            <span className={styles.logoMark}>⬡</span> Vetra Clinic · Sistema en desarrollo
          </span>
          <span className={styles.testnetBadge}>PROTOTIPO</span>
        </div>
      </footer>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Landing />} />
          <Route path="/pacientes" element={<Pacientes />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
