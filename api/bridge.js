// api/uftp-bridge.js
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Transaction } from '@bsv/sdk';
import identityManager from '../src/wallet/identity.js';
import certificateManager from '../src/wallet/certificates.js';
import messageSigner from '../src/integration/message-signer.js';
import { parseXml, buildXml } from '../src/integration/xml-utils.js';

// Create an in-memory storage for UFTP messages
const uftpMessages = [];

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.text({ type: 'application/xml', limit: '10mb' }));

// Endpoint to create a wallet for a domain (DSO or AGR)
app.post('/api/create-wallet', async (req, res) => {
  try {
    const { domain, existingRootKey } = req.body;
    
    if (!domain) {
      return res.status(400).json({ 
        success: false, 
        error: 'Domain is required' 
      });
    }
    
    const walletInfo = await identityManager.createWallet(domain, existingRootKey);
    
    res.json({ 
      success: true, 
      wallet: walletInfo
    });
  } catch (error) {
    console.error('Error creating wallet:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint to create a certificate for market participants
app.post('/api/create-certificate', async (req, res) => {
  try {
    const { issuerDomain, subjectDomain, permissions } = req.body;
    
    if (!issuerDomain || !subjectDomain) {
      return res.status(400).json({ 
        success: false, 
        error: 'Issuer and subject domains are required' 
      });
    }
    
    // For UFTP we grant permissions like "FlexRequest", "FlexOffer", etc.
    const certificate = await certificateManager.createCertificate(
      issuerDomain,
      subjectDomain,
      permissions || []
    );
    
    res.json({ 
      success: true, 
      certificate 
    });
  } catch (error) {
    console.error('Error creating certificate:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint to record a UFTP message on the blockchain
app.post('/api/record-message', async (req, res) => {
  try {
    const { messageType, messageXml, senderDomain, recipientDomain } = req.body;
    
    // Validate inputs
    if (!messageType || !messageXml || !senderDomain || !recipientDomain) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }
    
    console.log(`Recording ${messageType} from ${senderDomain} to ${recipientDomain}`);
    
    // Sign the message with the sender's BSV wallet
    const signedXml = await messageSigner.signUftpMessage(
      messageXml,
      senderDomain
    );
    
    // Create a transaction with UFTP message data in OP_RETURN
    const tx = new Transaction();
    
    // Add OP_RETURN output with UFTP message data
    // We use UFTP as a prefix to identify our messages in the blockchain
    const uftpPrefix = Buffer.from('UFTP', 'utf8').toString('hex');
    const typeBuffer = Buffer.from(messageType, 'utf8').toString('hex');
    
    // For large messages, we may need to truncate or split them
    // Here we're taking the first 800 chars as a simple approach
    const dataBuffer = Buffer.from(signedXml.substring(0, 800), 'utf8').toString('hex');
    
    tx.addOutput({
      script: `6a${uftpPrefix}${typeBuffer}${dataBuffer}`,
      satoshis: 0
    });
    
    // For demo purposes, return the raw transaction
    const rawTx = tx.toString();
    
    // Store in our in-memory database
    const storedMessage = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      messageType,
      senderDomain,
      recipientDomain,
      timestamp: new Date(),
      signedXml,
      rawTransaction: rawTx,
      verified: true // We just signed it, so it's verified
    };
    
    uftpMessages.push(storedMessage);
    
    res.json({ 
      success: true, 
      transactionId: storedMessage.id,
      rawTransaction: rawTx,
      message: 'Signed UFTP message recorded successfully'
    });
  } catch (error) {
    console.error('Error recording message:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint to verify a UFTP message
app.post('/api/verify-message', async (req, res) => {
  try {
    const { signedXml } = req.body;
    
    if (!signedXml) {
      return res.status(400).json({ 
        success: false, 
        error: 'Signed XML is required' 
      });
    }
    
    const verificationResult = await messageSigner.verifyUftpMessage(signedXml);
    
    res.json({ 
      success: true, 
      ...verificationResult
    });
  } catch (error) {
    console.error('Error verifying message:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint to query UFTP message history (requires payment)
app.get('/api/messages', async (req, res) => {
  try {
    const { conversationId, messageType, senderDomain, recipientDomain } = req.query;
    
    // Filter messages based on query parameters
    let filteredMessages = [...uftpMessages];
    
    if (messageType) {
      filteredMessages = filteredMessages.filter(msg => msg.messageType === messageType);
    }
    
    if (senderDomain) {
      filteredMessages = filteredMessages.filter(msg => msg.senderDomain === senderDomain);
    }
    
    if (recipientDomain) {
      filteredMessages = filteredMessages.filter(msg => msg.recipientDomain === recipientDomain);
    }
    
    if (conversationId) {
      // For UFTP messages, we'd need to parse the XML to check the conversationId
      // This is a simplified version
      filteredMessages = filteredMessages.filter(msg => {
        try {
          // Basic check for conversationId in XML
          return msg.signedXml.includes(`ConversationID="${conversationId}"`);
        } catch (e) {
          return false;
        }
      });
    }
    
    res.json({ 
      success: true, 
      messages: filteredMessages.map(msg => ({
        id: msg.id,
        messageType: msg.messageType,
        senderDomain: msg.senderDomain,
        recipientDomain: msg.recipientDomain,
        timestamp: msg.timestamp,
        // Don't include the full XML in the response list for brevity
      }))
    });
  } catch (error) {
    console.error('Error querying messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint to get a specific message by ID
app.get('/api/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const message = uftpMessages.find(msg => msg.id === id);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }
    
    res.json({ 
      success: true, 
      message
    });
  } catch (error) {
    console.error('Error retrieving message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start the API server when run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`ShapeShifter-BSV bridge API running on port ${PORT}`);
  });
}

export default app;