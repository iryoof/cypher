import { spawn } from 'node:child_process'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { io as createSocket } from 'socket.io-client'

const PORT = Number(process.env.STRESS_TEST_PORT || 3100 + Math.floor(Math.random() * 1000))
const SERVER_URL = `http://127.0.0.1:${PORT}`
const PLAYER_COUNT = 6

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function waitFor(predicate, timeoutMs, label) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const value = predicate()
    if (value) {
      return value
    }
    await delay(50)
  }
  throw new Error(`Timeout while waiting for ${label}`)
}

async function waitForEvent(client, eventName, predicate = () => true, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error(`Timeout while waiting for event "${eventName}" on ${client.nickname}`))
    }, timeoutMs)

    const handler = (...args) => {
      if (!predicate(...args)) return
      cleanup()
      resolve(args)
    }

    const cleanup = () => {
      clearTimeout(timeout)
      client.socket.off(eventName, handler)
    }

    client.socket.on(eventName, handler)
  })
}

async function waitForHealth() {
  const start = Date.now()
  while (Date.now() - start < 15000) {
    try {
      const response = await fetch(`${SERVER_URL}/health`)
      if (response.ok) {
        return
      }
    } catch {
      // server not ready yet
    }
    await delay(100)
  }
  throw new Error('Backend health check did not become ready')
}

function createClient(index) {
  const playerId = `stress-player-${index}`
  const nickname = `Stress${index + 1}`
  const socket = createSocket(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false
  })

  const client = {
    index,
    playerId,
    nickname,
    socket,
    state: null,
    errors: [],
    roundsStarted: [],
    roundCompleteCount: 0,
    votingStartedCount: 0,
    votingComplete: null
  }

  socket.on('state-update', state => {
    client.state = state
  })
  socket.on('lobby-joined', state => {
    client.state = state
  })
  socket.on('lobby-created', (_code, state) => {
    client.state = state
  })
  socket.on('round-started', roundNumber => {
    client.roundsStarted.push(roundNumber)
  })
  socket.on('round-complete', () => {
    client.roundCompleteCount += 1
  })
  socket.on('voting-started', () => {
    client.votingStartedCount += 1
  })
  socket.on('voting-complete', (archive, results) => {
    client.votingComplete = { archive, results }
  })
  socket.on('error', message => {
    client.errors.push(String(message))
  })

  return client
}

async function connectClient(client) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Connect timeout for ${client.nickname}`)), 8000)
    client.socket.once('connect', () => {
      clearTimeout(timeout)
      resolve()
    })
    client.socket.once('connect_error', error => {
      clearTimeout(timeout)
      reject(error)
    })
  })
}

async function cleanupClients(clients) {
  await Promise.all(clients.map(async client => {
    if (client.socket.connected) {
      client.socket.disconnect()
    }
  }))
}

async function main() {
  console.log('Starting local backend...')
  const backend = spawn(
    process.execPath,
    ['backend/dist/server.js'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(PORT),
        FRONTEND_URL: 'http://localhost:5173'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )

  let backendOutput = ''
  backend.stdout.on('data', chunk => {
    backendOutput += chunk.toString()
  })
  backend.stderr.on('data', chunk => {
    backendOutput += chunk.toString()
  })

  const clients = []

  try {
    await waitForHealth()
    console.log('Backend ready')

    for (let i = 0; i < PLAYER_COUNT; i += 1) {
      const client = createClient(i)
      clients.push(client)
      await connectClient(client)
    }
    console.log(`Connected ${PLAYER_COUNT} clients`)

    const host = clients[0]
    const [createdCode] = await Promise.all([
      waitForEvent(host, 'lobby-created'),
      (async () => {
        host.socket.emit(
          'create-lobby',
          { playerCount: PLAYER_COUNT, timerEnabled: false, timerSeconds: 60 },
          host.nickname,
          host.playerId
        )
      })()
    ]).then(values => values[0])
    const lobbyCode = createdCode
    console.log(`Created lobby ${lobbyCode}`)

    await Promise.all(clients.slice(1).map(async client => {
      await Promise.all([
        waitForEvent(client, 'lobby-joined'),
        (async () => {
          client.socket.emit('join-lobby', lobbyCode, client.nickname, client.playerId)
        })()
      ])
    }))

    await Promise.all(clients.map(client =>
      waitFor(() => client.state?.players?.length === PLAYER_COUNT, 8000, `${client.nickname} lobby state`)
    ))
    console.log('All clients received full lobby state')

    await Promise.all([
      ...clients.map(client => waitForEvent(client, 'round-started', roundNumber => roundNumber === 1)),
      (async () => host.socket.emit('start-game'))()
    ])
    console.log('Round 1 started for all clients')

    host.socket.emit('next-round')
    await waitFor(() => host.errors.includes('Round is not complete'), 4000, 'host early next-round rejection')

    const duplicateErrorPromise = waitFor(() => host.errors.includes('Text already submitted'), 4000, 'duplicate submit rejection')

    await Promise.all(clients.map(async (client, index) => {
      const text = `r1-line-a-${index}\nr1-line-b-${index}`
      client.socket.emit('submit-text', text)
    }))

    host.socket.emit('submit-text', 'duplicate\nsubmit')
    await duplicateErrorPromise
    console.log('Duplicate submission correctly rejected')

    await Promise.all(clients.map(client =>
      waitFor(() => client.roundCompleteCount >= 1, 8000, `${client.nickname} round 1 complete`)
    ))
    console.log('Round 1 completed for all clients')

    const reconnectingClient = clients[PLAYER_COUNT - 1]
    reconnectingClient.socket.disconnect()
    await delay(250)
    const reconnectPromise = connectClient(reconnectingClient)
    reconnectingClient.socket.connect()
    await reconnectPromise
    reconnectingClient.socket.emit('join-lobby', lobbyCode, reconnectingClient.nickname, reconnectingClient.playerId)
    await waitForEvent(reconnectingClient, 'lobby-joined')
    console.log(`${reconnectingClient.nickname} reconnected and rejoined`)

    await Promise.all([
      ...clients.map(client => waitForEvent(client, 'round-started', roundNumber => roundNumber === 2)),
      (async () => host.socket.emit('next-round'))()
    ])
    console.log('Round 2 started for all clients')

    await Promise.all(clients.map(async (client, index) => {
      client.socket.emit('submit-text', `round2-${index}`)
    }))

    await Promise.all(clients.map(client =>
      waitFor(() => client.roundCompleteCount >= 2, 8000, `${client.nickname} round 2 complete`)
    ))
    console.log('Round 2 completed for all clients')

    await Promise.all([
      ...clients.map(client => waitForEvent(client, 'voting-started')),
      (async () => host.socket.emit('end-game'))()
    ])
    console.log('Voting started for all clients')

    clients[1].socket.emit('submit-vote', 0)
    clients[2].socket.emit('submit-vote', 1)

    await Promise.all([
      ...clients.map(client => waitForEvent(client, 'voting-complete')),
      (async () => host.socket.emit('skip-voting'))()
    ])

    await Promise.all(clients.map(client =>
      waitFor(() => !!client.votingComplete, 8000, `${client.nickname} voting completion`)
    ))
    console.log('Voting completed for all clients')

    const finalArchive = clients[0].votingComplete.archive
    assert(finalArchive.finalTexts.length === PLAYER_COUNT, 'Archive final text count should match player count')
    assert(finalArchive.rounds.length === PLAYER_COUNT, 'Archive rounds count should match player count')
    assert(finalArchive.rounds.every(round => round.length >= 3), 'Each archived text should contain accumulated lines')

    const statsResponse = await fetch(`${SERVER_URL}/api/stats`)
    const stats = await statsResponse.json()
    assert(stats.totalGames === 1, `Stats should record exactly one completed game, got ${stats.totalGames}`)

    console.log('Stress test passed')
    console.log(JSON.stringify({
      lobbyCode,
      players: PLAYER_COUNT,
      totalGames: stats.totalGames,
      archivedTexts: finalArchive.finalTexts.length
    }, null, 2))
  } finally {
    await cleanupClients(clients)
    backend.kill('SIGTERM')
    await Promise.race([
      new Promise(resolve => backend.once('exit', resolve)),
      delay(2000)
    ])
    if (backend.exitCode === null) {
      backend.kill('SIGKILL')
      await Promise.race([
        new Promise(resolve => backend.once('exit', resolve)),
        delay(2000)
      ])
    }
    if (backend.exitCode && backend.exitCode !== 0) {
      console.error(backendOutput)
    }
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
