'use client'
import React, { ReactNode, createContext, useContext } from 'react'
import { createAppKit, useAppKitProvider } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { sepolia, mantle } from '@reown/appkit/networks'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

// https://docs.reown.com/appkit/react/core/custom-networks

const metadata = {
  name: 'Game of Go',
  description: 'Play go on-chain',
  url: 'https://play-go.netlify.app',
  icons: ['./favicon.ico'],
}

createAppKit({
  adapters: [new EthersAdapter()],
  metadata,
  networks: [sepolia, mantle],
  defaultNetwork: sepolia,
  projectId,
  features: {
    email: true,
    socials: ['google', 'farcaster', 'github'],
  },
})

const AppKitContext = createContext<ReturnType<typeof useAppKitProvider> | null>(null)

export function Web3Modal({ children }: { children: ReactNode }) {
  const appKitProvider = useAppKitProvider('eip155:11155111' as any)

  return <AppKitContext.Provider value={appKitProvider}>{children}</AppKitContext.Provider>
}

export function useAppKit() {
  const context = useContext(AppKitContext)
  if (!context) {
    throw new Error('useAppKit must be used within a Web3Modal')
  }
  return context
}
