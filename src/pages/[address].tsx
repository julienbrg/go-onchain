import { useRouter } from 'next/router'
import { useEffect, useState, useCallback } from 'react'
import { Box, VStack, Text } from '@chakra-ui/react'
import { Contract, BrowserProvider } from 'ethers'
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react'
import GoAbi from '../utils/Go.json'

interface GoBoardProps {
  contractAddress?: string
}

const GoBoard = ({ contractAddress }: GoBoardProps) => {
  const lines = Array.from({ length: 19 }, (_, i) => i)
  const [stones, setStones] = useState<{ [key: string]: 'purple' | 'blue' }>({})
  const [isBlueNext, setIsBlueNext] = useState(true)

  const STONE_SIZE = 'calc(100% / 19 * 0.9)' // 90% of one grid unit
  const HOSHI_SIZE = 'calc(100% / 19 * 0.25)' // 25% of one grid unit

  const handleIntersectionClick = useCallback(
    (x: number, y: number) => {
      const key = `${x}-${y}`
      if (stones[key]) return // Already has a stone

      setStones((prev) => ({
        ...prev,
        [key]: isBlueNext ? 'blue' : 'purple',
      }))
      setIsBlueNext(!isBlueNext)
    },
    [stones, isBlueNext]
  )

  const getIntersectionStyle = useCallback(
    (x: number, y: number) => {
      const stone = stones[`${x}-${y}`]
      if (!stone) return {}

      return {
        backgroundColor: stone === 'blue' ? '#45a2f8' : '#8c1c84',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }
    },
    [stones]
  )

  return (
    <VStack width="full" spacing={4} align="center">
      <Box
        position="relative"
        width="full"
        maxW="700px"
        aspectRatio="1/1"
        bg="gray.800"
        borderRadius="md"
        p={4}
        userSelect="none"
        sx={{
          touchAction: 'none',
        }}>
        <Box position="relative" width="full" height="full">
          {/* Vertical lines */}
          {lines.map((i) => (
            <Box
              key={`v-${i}`}
              position="absolute"
              left={`${(i * 100) / 18}%`}
              top="0"
              bottom="0"
              width="1px"
              bg="gray.200"
            />
          ))}

          {/* Horizontal lines */}
          {lines.map((i) => (
            <Box
              key={`h-${i}`}
              position="absolute"
              top={`${(i * 100) / 18}%`}
              left="0"
              right="0"
              height="1px"
              bg="gray.200"
            />
          ))}

          {/* Star points (hoshi) */}
          {[3, 9, 15].map((x) =>
            [3, 9, 15].map((y) => (
              <Box
                key={`star-${x}-${y}`}
                position="absolute"
                left={`${(x * 100) / 18}%`}
                top={`${(y * 100) / 18}%`}
                width={HOSHI_SIZE}
                height={HOSHI_SIZE}
                bg="gray.200"
                borderRadius="full"
                transform="translate(-50%, -50%)"
              />
            ))
          )}

          {/* Clickable intersections */}
          {lines.map((y) =>
            lines.map((x) => (
              <Box
                key={`intersection-${x}-${y}`}
                position="absolute"
                left={`${(x * 100) / 18}%`}
                top={`${(y * 100) / 18}%`}
                width={STONE_SIZE}
                height={STONE_SIZE}
                transform="translate(-50%, -50%)"
                cursor="pointer"
                onClick={() => handleIntersectionClick(x, y)}
                _hover={{
                  backgroundColor: stones[`${x}-${y}`] ? undefined : 'rgba(255,255,255,0.1)',
                }}
                _active={{
                  transform: stones[`${x}-${y}`] ? 'translate(-50%, -50%)' : 'translate(-50%, -50%) scale(0.95)',
                }}
                borderRadius="full"
                transition="background-color 0.1s"
                {...getIntersectionStyle(x, y)}
              />
            ))
          )}
        </Box>
      </Box>
    </VStack>
  )
}

export default function GamePage() {
  const router = useRouter()
  const { address } = useAppKitAccount()
  const { walletProvider } = useAppKitProvider('eip155')
  const [gameContract, setGameContract] = useState<Contract | null>(null)
  const [isValidGame, setIsValidGame] = useState(true)
  const [contractAddress, setContractAddress] = useState<string>('')

  useEffect(() => {
    const initGame = async () => {
      if (!router.query.address || typeof router.query.address !== 'string') return

      try {
        const ethersProvider = new BrowserProvider(walletProvider as any)
        const contract = new Contract(router.query.address, GoAbi.abi, ethersProvider)

        // Basic validation - check if this is actually a Go contract
        try {
          await contract.WIDTH()
          setGameContract(contract)
          setContractAddress(router.query.address)
          setIsValidGame(true)
        } catch {
          setIsValidGame(false)
        }
      } catch (error) {
        console.error('Error initializing game:', error)
        setIsValidGame(false)
      }
    }

    if (router.isReady) {
      initGame()
    }
  }, [router.isReady, router.query.address, walletProvider])

  if (!isValidGame) {
    return (
      <VStack spacing={4} align="center" justify="center" minH="50vh">
        <Text>Invalid game address or game not found</Text>
      </VStack>
    )
  }

  return (
    <main>
      <GoBoard contractAddress={contractAddress} />
    </main>
  )
}
