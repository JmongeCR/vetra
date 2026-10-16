import {
	connectWallet,
	profileModal,
	shortAddress,
} from "@stellar-scaffold/app-lib"
import { useCavosState } from "../cavos/context"
import { useWallet } from "../hooks/useWallet"

export const WalletButton = () => {
	const { address, connector, isPending, balances, disconnect } = useWallet()
	const cavos = useCavosState()

	// Signed in with Cavos on a browser that doesn't hold the wallet key yet.
	if (!address && cavos?.needsDeviceApproval) {
		return (
			<div className="wallet-connected">
				<button onClick={() => void cavos.approveDevice()}>
					Desbloquear con passkey
				</button>
				<button onClick={cavos.signOut}>Cerrar sesión</button>
			</div>
		)
	}

	if (!address) {
		if (!cavos) {
			return (
				<button onClick={() => void connectWallet()} disabled={isPending}>
					{isPending ? "Conectando..." : "Conectar billetera"}
				</button>
			)
		}
		return (
			<div className="wallet-connected">
				<button
					className="wallet-primary"
					onClick={cavos.signIn}
					disabled={cavos.isLoading}
					title="Correo o Google: crea una billetera Stellar automáticamente (Cavos)"
				>
					{cavos.isLoading ? "Ingresando..." : "Iniciar sesión"}
				</button>
				<button
					onClick={() => void connectWallet()}
					title="Freighter, xBull, Lobstr… (Stellar Wallets Kit)"
				>
					Usar billetera
				</button>
			</div>
		)
	}

	return (
		<div className="wallet-connected" style={{ opacity: isPending ? 0.6 : 1 }}>
			<span className="wallet-balance">
				{balances?.xlm?.balance ?? "-"} XLM
			</span>

			{connector === "cavos" ? (
				<>
					<span className="wallet-balance" title={address}>
						{cavos?.email ?? shortAddress(address)}
					</span>
					<button
						className="wallet-profile"
						title="Copy address"
						onClick={() => void navigator.clipboard.writeText(address)}
					>
						{shortAddress(address)}
					</button>
					<button onClick={() => void disconnect()}>Cerrar sesión</button>
				</>
			) : (
				<button className="wallet-profile" onClick={() => void profileModal()}>
					{shortAddress(address)}
				</button>
			)}
		</div>
	)
}
