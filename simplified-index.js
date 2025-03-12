import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Transaction } from '@bsv/sdk';
import dotenv from 'dotenv';
import identityManager from './src/wallet/identity.js';
import certificateManager from './src/wallet/certificates.js';
import messageSigner from './src/integration/message-signer.js';

// Load environment variables
dotenv.config();

// Create an in-memory storage for UFTP messages
const uftpMessages = [];

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.text({ type: 'application/xml', limit: '10mb' }));

// New endpoint to create a wallet for a domain
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

// New endpoint to create a certificate
app.post('/api/create-certificate', async (req, res) => {
  try {
    const { issuerDomain, subjectDomain, permissions } = req.body;
    
    if (!issuerDomain || !subjectDomain) {
      return res.status(400).json({ 
        success: false, 
        error: 'Issuer and subject domains are required' 
      });
    }
    
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

// Updated endpoint to record a signed UFTP message
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
    const uftpPrefix = Buffer.from('UFTP', 'utf8').toString('hex');
    const typeBuffer = Buffer.from(messageType, 'utf8').toString('hex');
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
      verified: true // We just signed it, so it's verified
    };
    
    uftpMessages.push(storedMessage);
    
    res.json({ 
      success: true, 
      transactionId: storedMessage.id,
      rawTransaction: rawTx,
      message: 'Signed message recorded successfully'
    });
  } catch (error) {
    console.error('Error recording message:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// New endpoint to verify a UFTP message
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

// Existing endpoint to query UFTP message history
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
    
    res.json({ 
      success: true, 
      messages: filteredMessages 
    });
  } catch (error) {
    console.error('Error querying messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Shapeshifter-BSV bridge with identity support running on port ${PORT}`);
});