import { Link, NavLink, Outlet, Route, Routes } from "react-router-dom"
import styles from "./App.module.css"
import ConnectAccount from "./components/ConnectAccount"
import UserMenu from "./components/UserMenu"
import { useWallet } from "./hooks/useWallet"
import Debug from "./pages/Debug"
import Home from "./pages/Home"
import Mascotas from "./pages/Mascotas"
import MascotaNueva from "./pages/MascotaNueva"
import MascotaDetalle from "./pages/MascotaDetalle"
import PasaportePublico from "./pages/PasaportePublico"
import PasaporteBusqueda from "./pages/PasaporteBusqueda"
import Veterinarias from "./pages/Veterinarias"
import MiEspacio from "./pages/MiEspacio"
import Perfil from "./pages/Perfil"
import Pasaportes from "./pages/Pasaportes"
import MisVeterinarias from "./pages/MisVeterinarias"
import Autorizaciones from "./pages/Autorizaciones"

function App() {
	return (
		<Routes>
			{/* Public passport routes — no layout chrome */}
			<Route path="/pasaporte" element={<PasaporteBusqueda />} />
			<Route path="/pasaporte/:vetId" element={<PasaportePublico />} />
			<Route element={<AppLayout />}>
				<Route path="/" element={<Home />} />
				<Route path="/mascotas" element={<Mascotas />} />
				<Route path="/mascotas/nueva" element={<MascotaNueva />} />
				<Route path="/mascotas/:id" element={<MascotaDetalle />} />
				<Route path="/veterinarias" element={<Veterinarias />} />
				{/* Authenticated owner portal */}
				<Route path="/mi-espacio" element={<MiEspacio />} />
				<Route path="/perfil" element={<Perfil />} />
				<Route path="/pasaportes" element={<Pasaportes />} />
				<Route path="/mis-veterinarias" element={<MisVeterinarias />} />
				<Route path="/autorizaciones" element={<Autorizaciones />} />
				<Route path="/debug" element={<Debug />} />
				<Route path="/debug/:contractName" element={<Debug />} />
			</Route>
		</Routes>
	)
}

const AppLayout = () => {
	const { address } = useWallet()

	return (
		<div className={styles.AppLayout}>
			<header className={styles.header}>
				<NavLink to={address ? "/mi-espacio" : "/"} className={styles.logo}>
					<span className={styles.logoMark}>⬡</span>
					<span>Vetra</span>
				</NavLink>

				<nav className={styles.headerNav}>
					{address ? (
						// Authenticated nav
						<>
							<NavLink
								to="/mi-espacio"
								className={({ isActive }) => (isActive ? styles.active : "")}
							>
								Mi espacio
							</NavLink>
							<NavLink
								to="/mascotas"
								className={({ isActive }) => (isActive ? styles.active : "")}
							>
								Mascotas
							</NavLink>
							<NavLink
								to="/pasaportes"
								className={({ isActive }) => (isActive ? styles.active : styles.navLink)}
							>
								Pasaportes
							</NavLink>
							<NavLink
								to="/mis-veterinarias"
								className={({ isActive }) => (isActive ? styles.active : styles.navLink)}
							>
								Veterinarias
							</NavLink>
							<NavLink
								to="/autorizaciones"
								className={({ isActive }) => (isActive ? styles.active : styles.navLink)}
							>
								Autorizaciones
							</NavLink>
							<NavLink
								to="/perfil"
								className={({ isActive }) => (isActive ? styles.active : styles.navLink)}
							>
								Mi perfil
							</NavLink>
						</>
					) : (
						// Public nav
						<>
							<NavLink
								to="/"
								end
								className={({ isActive }) => (isActive ? styles.active : "")}
							>
								Inicio
							</NavLink>
							<a
								href="#como-funciona"
								className={styles.navAnchor}
								onClick={(e) => {
									if (window.location.pathname === "/") {
										e.preventDefault()
										document
											.getElementById("como-funciona")
											?.scrollIntoView({ behavior: "smooth" })
									}
								}}
							>
								Cómo funciona
							</a>
							<Link to="/pasaporte" className={styles.navLink}>
								Consultar pasaporte
							</Link>
							<Link to="/veterinarias" className={styles.navLink}>
								Para veterinarias
							</Link>
						</>
					)}
				</nav>

				{address ? <UserMenu /> : <ConnectAccount />}
			</header>

			<main className={styles.main}>
				<Outlet />
			</main>

			<footer className={styles.footer}>
				<div className={styles.footerInner}>
					<div className={styles.footerBrand}>
						<span className={styles.footerLogo}>
							<span className={styles.logoMark}>⬡</span> Vetra
						</span>
						<p className={styles.footerTagline}>Una identidad, toda una vida.</p>
					</div>
					<nav className={styles.footerNav}>
						<Link to="/">Inicio</Link>
						<Link to="/pasaporte">Consultar pasaporte</Link>
						<Link to="/veterinarias">Para veterinarias</Link>
						<a
							href="https://developers.stellar.org"
							target="_blank"
							rel="noreferrer"
						>
							Stellar Testnet
						</a>
					</nav>
				</div>
				<div className={styles.footerBottom}>
					<span>© 2026 Vetra</span>
					<span className={styles.testnetBadge}>TESTNET</span>
				</div>
			</footer>
		</div>
	)
}

export default App
