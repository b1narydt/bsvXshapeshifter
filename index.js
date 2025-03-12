import OverlayExpress from '@bsv/overlay-express'
import dotenv from 'dotenv'
import UftpMessageTopicManager from './topic-managers/UftpMessageTopicManager.js'
import uftpMessageLookupServiceFactory from './lookup-services/UftpMessageLookupServiceFactory.js'

// Load environment variables
dotenv.config()

const main = async () => {
  // Create a new server for our overlay node
  const server = new OverlayExpress(
    // Name your overlay node
    'shapeshifter',
    
    // Server private key for identity
    process.env.SERVER_PRIVATE_KEY,
    
    // Public URL where your node is available
    process.env.HOSTING_URL
  )

  // Configure the port to listen on
  server.configurePort(process.env.PORT || 8080)

  // Connect to databases
  await server.configureKnex(process.env.KNEX_URL)
  await server.configureMongo(process.env.MONGO_URL)

  // Configure our topic manager and lookup service
  server.configureTopicManager('tm_uftp_messages', new UftpMessageTopicManager())
  server.configureLookupServiceWithMongo('ls_uftp_messages', uftpMessageLookupServiceFactory)

  // For local development, disable GASP sync
  server.configureEnableGASPSync(false)

  // Configure the engine and start the server
  await server.configureEngine()
  await server.start()

  console.log(`Shapeshifter-BSV bridge running on port ${process.env.PORT || 8080}`)
}

main().catch(error => {
  console.error('Failed to start server:', error)
})