import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  VStack,
  Text,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Link,
  Spinner,
  Input,
  FormControl,
  FormLabel,
  FormHelperText,
} from '@chakra-ui/react'
import { useRouter } from 'next/router'
import { Contract, BrowserProvider } from 'ethers'
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react'
import GoFactoryAbi from '../utils/GoFactory.json'
import NextLink from 'next/link'

const FACTORY_ADDRESS = GoFactoryAbi.address

export default function Homepage() {
  const [isLoading, setIsLoading] = useState(false)
  const [games, setGames] = useState<{ address: string; id: number }[]>([])
  const [loadingGames, setLoadingGames] = useState(true)
  const [opponentAddress, setOpponentAddress] = useState('')
  const router = useRouter()
  const toast = useToast()
  const { address, isConnected } = useAppKitAccount()
  const { walletProvider } = useAppKitProvider('eip155')

  // Fetch existing games
  useEffect(() => {
    const fetchGames = async () => {
      if (!walletProvider) return

      try {
        const ethersProvider = new BrowserProvider(walletProvider as any)
        const factory = new Contract(FACTORY_ADDRESS, GoFactoryAbi.abi, ethersProvider)

        // Get total number of games
        const gameCount = await factory.gameCount()

        // Fetch all games
        const gamePromises = []
        for (let i = 0; i < gameCount; i++) {
          gamePromises.push(factory.games(i))
        }

        const gameAddresses = await Promise.all(gamePromises)

        // Create games array with IDs and addresses
        const gamesWithIds = gameAddresses
          .map((address, index) => ({
            id: index,
            address: address,
          }))
          .filter((game) => game.address !== '0x0000000000000000000000000000000000000000')

        setGames(gamesWithIds)
        setLoadingGames(false)
      } catch (error) {
        console.error('Error fetching games:', error)
        setLoadingGames(false)
      }
    }

    if (walletProvider) {
      fetchGames()
    }
  }, [walletProvider])

  const createGame = async () => {
    if (!isConnected || !address) {
      toast({
        title: 'Not connected',
        description: 'Please connect your wallet first',
        status: 'error',
        position: 'bottom',
        variant: 'subtle',
        duration: 9000,
        isClosable: true,
      })
      return
    }

    if (!opponentAddress) {
      toast({
        title: 'Missing opponent',
        description: 'Please enter an opponent address',
        status: 'error',
        position: 'bottom',
        variant: 'subtle',
        duration: 9000,
        isClosable: true,
      })
      return
    }

    try {
      setIsLoading(true)

      const ethersProvider = new BrowserProvider(walletProvider as any)
      const signer = await ethersProvider.getSigner()

      const factory = new Contract(FACTORY_ADDRESS, GoFactoryAbi.abi, signer)

      const tx = await factory.createGame(address, opponentAddress)
      const receipt = await tx.wait()

      const event = receipt.logs.find((log: any) => {
        try {
          return factory.interface.parseLog({ topics: log.topics, data: log.data })?.name === 'GameCreated'
        } catch {
          return false
        }
      })

      if (event) {
        const parsedEvent = factory.interface.parseLog({
          topics: event.topics,
          data: event.data,
        })
        const gameAddress = parsedEvent?.args?.gameAddress

        router.push(`/${gameAddress}`)
      }
    } catch (error) {
      console.error('Error creating game:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create game',
        status: 'error',
        position: 'bottom',
        variant: 'subtle',
        duration: 9000,
        isClosable: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const renderGamesList = () => {
    if (loadingGames) {
      if (!walletProvider) {
        return (
          <VStack spacing={2} mt={8}>
            <Text>Please connect your wallet.</Text>
          </VStack>
        )
      }
      return (
        <VStack spacing={2} mt={8}>
          <Spinner size="xl" />
          <Text>Loading games...</Text>
        </VStack>
      )
    }

    if (games.length === 0) {
      return (
        <VStack spacing={2} mt={8}>
          <Text>No games found. Start a new game above!</Text>
        </VStack>
      )
    }

    return (
      <VStack spacing={2} mt={8} width="full">
        {/* <Text fontSize="xl" fontWeight="bold">
          Existing Games
        </Text> */}
        <Box width="full" overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                {/* <Th>Game ID</Th> */}
                <Th>Existing Games</Th>
                {/* <Th>Action</Th> */}
              </Tr>
            </Thead>
            <Tbody>
              {games.map((game) => (
                <Tr key={game.id}>
                  {/* <Td>{game.id}</Td> */}
                  {/* <Td>
                    <Text isTruncated maxW="200px">
                      {game.address}
                    </Text>
                  </Td> */}
                  <Td>
                    <Link
                      as={NextLink}
                      href={`/${game.address}`}
                      color="blue.500"
                      _hover={{ color: 'blue.600', textDecoration: 'underline' }}>
                      {game.address}
                    </Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </VStack>
    )
  }

  return (
    <Box>
      <VStack spacing={6} align="center" justify="center" minH="20vh">
        <FormControl display="flex" flexDirection="column" alignItems="center">
          <FormLabel>Opponent Address</FormLabel>
          <Input
            placeholder="0x..."
            value={opponentAddress}
            onChange={(e) => setOpponentAddress(e.target.value)}
            width="400px"
            mb={4}
            textAlign="center"
          />
          <FormHelperText>Enter the wallet address of your opponent</FormHelperText>
        </FormControl>

        <Button
          colorScheme="blue"
          onClick={createGame}
          isLoading={isLoading}
          loadingText="Starting..."
          size="lg"
          isDisabled={!opponentAddress}>
          Start Game
        </Button>
      </VStack>

      {/* Render games list */}
      {renderGamesList()}
    </Box>
  )
}
