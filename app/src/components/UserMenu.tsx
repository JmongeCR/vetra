import { useState, useEffect, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useWallet } from "../hooks/useWallet"
import { useCavosState } from "../cavos/context"
import NetworkPill from "./NetworkPill"
import styles from "./UserMenu.module.css"

export default function UserMenu() {
	const { address, disconnect } = useWallet()
	const cavos = useCavosState()
	const navigate = useNavigate()
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	const label = cavos?.email ?? (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "")
	const initial = label.charAt(0).toUpperCase() || "V"

	useEffect(() => {
		if (!open) return
		function handleOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener("mousedown", handleOutside)
		return () => document.removeEventListener("mousedown", handleOutside)
	}, [open])

	async function handleLogout() {
		setOpen(false)
		await disconnect()
		navigate("/")
	}

	return (
		<div className={styles.wrap} ref={ref}>
			<NetworkPill />
			<button
				className={styles.trigger}
				onClick={() => setOpen((o) => !o)}
				aria-haspopup="true"
				aria-expanded={open}
			>
				<span className={styles.avatar}>{initial}</span>
				<span className={styles.label}>{label}</span>
				<span className={styles.caret} aria-hidden="true">{open ? "▴" : "▾"}</span>
			</button>

			{open && (
				<div className={styles.dropdown} role="menu">
					<Link
						to="/perfil"
						className={styles.item}
						onClick={() => setOpen(false)}
						role="menuitem"
					>
						Mi perfil
					</Link>
					<Link
						to="/perfil#identidad"
						className={styles.item}
						onClick={() => setOpen(false)}
						role="menuitem"
					>
						Mi identidad digital
					</Link>
					<hr className={styles.divider} />
					<button
						className={styles.itemDanger}
						onClick={() => void handleLogout()}
						role="menuitem"
					>
						Cerrar sesión
					</button>
				</div>
			)}
		</div>
	)
}
