import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { Box, VStack, Text, Spinner, Button, HStack, useToast } from '@chakra-ui/react'
import { Contract, BrowserProvider } from 'ethers'
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react'
import GoAbi from '../utils/Go.json'

const lines = Array.from({ length: 19 }, (_, i) => i)
const STONE_SIZE = 'calc(100% / 19 * 0.9)' // 90% of one grid unit
const HOSHI_SIZE = 'calc(100% / 19 * 0.25)' // 25% of one grid unit

interface GameState {
  board: { [key: string]: 'purple' | 'blue' }
  turn: string
  capturedWhite: number
  capturedBlack: number
  whitePassedOnce: boolean
  blackPassedOnce: boolean
  moveCount: number // Add this to track total moves
}

const INITIAL_STATE: GameState = {
  board: {},
  turn: '',
  capturedWhite: 0,
  capturedBlack: 0,
  whitePassedOnce: false,
  blackPassedOnce: false,
  moveCount: 0, // Initialize moveCount
}

export default function GamePage() {
  const router = useRouter()
  const toast = useToast()
  const { address } = useAppKitAccount()
  const { walletProvider } = useAppKitProvider('eip155')
  const [isValidGame, setIsValidGame] = useState(true)
  const [loading, setLoading] = useState(true)
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE)
  const [contractAddress, setContractAddress] = useState<string>('')
  const [isWhitePlayer, setIsWhitePlayer] = useState(false)
  const [isBlackPlayer, setIsBlackPlayer] = useState(false)
  const [nextStoneColor, setNextStoneColor] = useState<'blue' | 'purple'>('blue')

  // Initialize game and load initial state
  useEffect(() => {
    const initGame = async () => {
      if (!router.query.address || typeof router.query.address !== 'string' || !walletProvider) return

      try {
        const ethersProvider = new BrowserProvider(walletProvider as any)
        const contract = new Contract(router.query.address, GoAbi.abi, ethersProvider)

        try {
          await contract.WIDTH()
          setContractAddress(router.query.address)
          setIsValidGame(true)

          // Check if current user is a player
          const [white, black] = await Promise.all([contract.white(), contract.black()])

          setIsWhitePlayer(white.toLowerCase() === address?.toLowerCase())
          setIsBlackPlayer(black.toLowerCase() === address?.toLowerCase())

          await loadGameState(contract)
        } catch {
          setIsValidGame(false)
          setLoading(false)
        }
      } catch (error) {
        console.error('Error initializing game:', error)
        setIsValidGame(false)
        setLoading(false)
      }
    }

    if (router.isReady) {
      initGame()
    }
  }, [router.isReady, router.query.address, walletProvider, address])

  // Load game state
  const loadGameState = async (contract: Contract) => {
    try {
      const [turn, capturedWhite, capturedBlack, whitePassedOnce, blackPassedOnce] = await Promise.all([
        contract.turn(),
        contract.capturedWhiteStones(),
        contract.capturedBlackStones(),
        contract.whitePassedOnce(),
        contract.blackPassedOnce(),
      ])

      const board: { [key: string]: 'purple' | 'blue' } = {}
      let moveCount = 0

      // Get intersections in chunks of 10 to avoid rate limiting
      const chunks = Array(Math.ceil(361 / 10)).fill(0)
      const intersectionPromises = chunks.map((_, chunkIndex) => {
        const start = chunkIndex * 10
        const end = Math.min(start + 10, 361)
        return Promise.all(
          Array(end - start)
            .fill(0)
            .map((_, i) => contract.intersections(start + i))
        )
      })

      const intersectionChunks = await Promise.all(intersectionPromises)
      const intersections = intersectionChunks.flat()

      // Process intersections
      intersections.forEach((intersection, i) => {
        if (Number(intersection.state) !== 0) {
          const x = i % 19
          const y = Math.floor(i / 19)
          const key = `${x}-${y}`
          // State.Empty = 0, State.Black = 1, State.White = 2
          board[key] = Number(intersection.state) === 1 ? 'blue' : 'purple'
          moveCount++
        }
      })

      setGameState({
        board,
        turn: turn.toLowerCase(),
        capturedWhite: Number(capturedWhite),
        capturedBlack: Number(capturedBlack),
        whitePassedOnce,
        blackPassedOnce,
        moveCount,
      })

      setNextStoneColor(moveCount % 2 === 0 ? 'blue' : 'purple')
      setLoading(false)
    } catch (error) {
      console.error('Error loading game state:', error)
      toast({
        title: 'Error loading game state',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      setLoading(false)
    }
  }

  // Set up event listeners
  useEffect(() => {
    if (!contractAddress || !walletProvider) return

    const setupListeners = async () => {
      const ethersProvider = new BrowserProvider(walletProvider as any)
      const contract = new Contract(contractAddress, GoAbi.abi, ethersProvider)

      contract.on('Move', (player, x, y) => {
        loadGameState(contract)
      })

      contract.on('Capture', (player, count) => {
        loadGameState(contract)
      })

      contract.on('End', (result, blackScore, whiteScore) => {
        toast({
          title: 'Game Over',
          description: `${result}! Black: ${blackScore}, White: ${whiteScore}`,
          status: 'info',
          duration: null,
          isClosable: true,
        })
        loadGameState(contract)
      })
    }

    setupListeners()

    return () => {
      const contract = new Contract(contractAddress, GoAbi.abi, new BrowserProvider(walletProvider as any))
      contract.removeAllListeners()
    }
  }, [contractAddress, walletProvider])

  useEffect(() => {
    if (gameState.board) {
      const totalStones = Object.keys(gameState.board).length
      setNextStoneColor(totalStones % 2 === 0 ? 'blue' : 'purple')
    }
  }, [gameState.board])

  const handleIntersectionClick = async (x: number, y: number) => {
    if (!contractAddress || !walletProvider || !address || !isMyTurn()) return

    try {
      const ethersProvider = new BrowserProvider(walletProvider as any)
      const signer = await ethersProvider.getSigner()
      const contract = new Contract(contractAddress, GoAbi.abi, signer)

      const tx = await contract.play(x, y)
      await tx.wait()

      // The game state will be updated via the event listener
    } catch (error: any) {
      console.error('Error making move:', error)
      toast({
        title: 'Error making move',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  const handlePass = async () => {
    if (!contractAddress || !walletProvider || !address || !isMyTurn()) return

    try {
      const ethersProvider = new BrowserProvider(walletProvider as any)
      const signer = await ethersProvider.getSigner()
      const contract = new Contract(contractAddress, GoAbi.abi, signer)

      const tx = await contract.pass()
      await tx.wait()
    } catch (error: any) {
      console.error('Error passing:', error)
      toast({
        title: 'Error passing turn',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  const isMyTurn = () => {
    return gameState.turn === address?.toLowerCase()
  }

  if (!isValidGame) {
    return (
      <VStack spacing={4} align="center" justify="center" minH="50vh">
        <Text>Invalid game address or game not found</Text>
      </VStack>
    )
  }

  if (loading) {
    return (
      <VStack spacing={4}>
        <Spinner size="xl" />
        <Text>Loading game...</Text>
      </VStack>
    )
  }

  return (
    <VStack spacing={6} align="center" width="full" p={4}>
      {/* <Text fontSize="xl" fontWeight="bold">
        Next move: {nextStoneColor === 'blue' ? 'Black' : 'White'}
      </Text> */}

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
          {/* Grid lines */}
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

          {/* Stones and intersections */}
          {lines.map((y) =>
            lines.map((x) => {
              const key = `${x}-${y}`
              const stone = gameState.board[key]

              return (
                <Box
                  key={`intersection-${x}-${y}`}
                  position="absolute"
                  left={`${(x * 100) / 18}%`}
                  top={`${(y * 100) / 18}%`}
                  width={STONE_SIZE}
                  height={STONE_SIZE}
                  transform="translate(-50%, -50%)"
                  cursor={!isWhitePlayer && !isBlackPlayer ? 'default' : stone ? 'not-allowed' : 'pointer'}
                  onClick={() => !stone && (isWhitePlayer || isBlackPlayer) && handleIntersectionClick(x, y)}
                  backgroundColor={stone === 'purple' ? '#8c1c84' : stone === 'blue' ? '#45a2f8' : undefined}
                  _hover={{
                    backgroundColor:
                      !stone && (isWhitePlayer || isBlackPlayer)
                        ? 'rgba(255,255,255,0.1)'
                        : stone === 'purple'
                          ? '#8c1c84'
                          : stone === 'blue'
                            ? '#45a2f8'
                            : undefined,
                  }}
                  borderRadius="full"
                  transition="all 0.2s"
                  boxShadow={stone ? '0 2px 4px rgba(0,0,0,0.2)' : undefined}
                  zIndex={1}
                />
              )
            })
          )}
        </Box>
      </Box>

      {(isWhitePlayer || isBlackPlayer) && (
        <HStack spacing={4}>
          <Button colorScheme="blue" onClick={handlePass} isDisabled={!isMyTurn()} mt={50}>
            Pass
          </Button>
        </HStack>
      )}

      <VStack spacing={2}>
        <Text>Black captures: {gameState.capturedBlack}</Text>
        <Text>White captures: {gameState.capturedWhite}</Text>
      </VStack>

      <HStack spacing={4}>
        <Text fontSize="sm" color="gray.500">
          {gameState.blackPassedOnce ? 'Black passed' : ''}
        </Text>
        <Text fontSize="sm" color="gray.500">
          {gameState.whitePassedOnce ? 'White passed' : ''}
        </Text>
      </HStack>
    </VStack>
  )
}
