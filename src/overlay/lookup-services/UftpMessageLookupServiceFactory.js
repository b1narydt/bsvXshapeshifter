import { LookupService } from '@bsv/overlay'

class UftpMessageLookupService  {
  constructor(db) {
    this.db = db
    this.collection = db.collection('uftp_messages')
  }
  
  async onOutputAdded(outputInfo) {
    try {
      // Extract UFTP message data
      const messageData = this.extractUftpMessageData(outputInfo)
      
      if (!messageData) {
        return
      }
      
      // Store in MongoDB
      await this.collection.insertOne({
        txid: outputInfo.txid,
        outputIndex: outputInfo.outputIndex,
        messageData,
        timestamp: new Date()
      })
      
      console.log(`Stored UFTP message: ${messageData.messageType} (${outputInfo.txid})`)
    } catch (error) {
      console.error('Error storing UFTP message:', error)
    }
  }
  
  async onOutputSpent(outputInfo) {
    try {
      await this.collection.updateOne(
        { txid: outputInfo.txid, outputIndex: outputInfo.outputIndex },
        { $set: { spent: true, spentAt: new Date() } }
      )
    } catch (error) {
      console.error('Error updating spent UFTP message:', error)
    }
  }
  
  async lookup(question) {
    try {
      if (question.query === 'findMessages') {
        // Query parameters
        const { conversationId, messageType, senderDomain, recipientDomain } = question.params || {}
        
        // Build query
        const query = {}
        if (conversationId) query['messageData.conversationId'] = conversationId
        if (messageType) query['messageData.messageType'] = messageType
        if (senderDomain) query['messageData.senderDomain'] = senderDomain
        if (recipientDomain) query['messageData.recipientDomain'] = recipientDomain
        
        const messages = await this.collection
          .find(query)
          .sort({ timestamp: -1 })
          .limit(100)
          .toArray()
        
        return { messages }
      }
      
      return { error: 'Unknown query type' }
    } catch (error) {
      console.error('Error in lookup service:', error)
      return { error: error.message }
    }
  }
  
  extractUftpMessageData(outputInfo) {
    try {
      // In a real implementation, this would parse the UFTP XML from the transaction
      // Here we're returning a simplified structure based on what we can extract
      return {
        messageType: this.determineMessageType(outputInfo) || 'UnknownUftpMessage',
        conversationId: this.extractConversationId(outputInfo) || `conv-${Date.now()}`,
        senderDomain: this.extractSenderDomain(outputInfo) || 'unknown-sender.com',
        recipientDomain: this.extractRecipientDomain(outputInfo) || 'unknown-recipient.com',
        timestamp: new Date()
      }
    } catch (error) {
      console.error('Error extracting UFTP message data:', error)
      return null
    }
  }
  
  determineMessageType(outputInfo) {
    // Would parse the script to determine message type
    return 'UnknownUftpMessage'
  }
  
  extractConversationId(outputInfo) {
    // Would extract conversation ID from script
    return null
  }
  
  extractSenderDomain(outputInfo) {
    // Would extract sender domain from script
    return null
  }
  
  extractRecipientDomain(outputInfo) {
    // Would extract recipient domain from script
    return null
  }
  
  getDocumentation() {
    return `# UFTP Message Lookup Service
    
This service allows you to query UFTP messages that have been recorded on the BSV blockchain.

## Available Queries

### findMessages

Find UFTP messages based on various criteria.

Parameters:
- \`conversationId\`: Filter by conversation ID
- \`messageType\`: Filter by message type (e.g., FlexRequest, FlexOffer)
- \`senderDomain\`: Filter by sender domain
- \`recipientDomain\`: Filter by recipient domain

Example:
\`\`\`json
{
  "service": "ls_uftp_messages",
  "query": "findMessages",
  "params": {
    "messageType": "FlexRequest",
    "senderDomain": "dso.example.com"
  }
}
\`\`\`

## Response Format

Messages are returned with their metadata and content:

\`\`\`json
{
  "messages": [
    {
      "txid": "transaction_id",
      "outputIndex": 0,
      "messageData": {
        "messageType": "FlexRequest",
        "conversationId": "conv-123",
        "senderDomain": "dso.example.com",
        "recipientDomain": "agr.example.com",
        "timestamp": "2023-01-01T12:00:00Z"
      },
      "timestamp": "2023-01-01T12:00:05Z"
    }
  ]
}
\`\`\`
`
  }
}

// Factory function to create a new LookupService with MongoDB
export default (db) => new UftpMessageLookupService(db)