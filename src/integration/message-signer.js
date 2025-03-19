import identityManager from '../wallet/identity.js';
import certificateManager from '../wallet/certificates.js';
import { parseXml, buildXml } from './xml-utils.js';

class MessageSigner {
  async signUftpMessage(xmlMessage, senderDomain) {
    try {
      // For simplicity in the prototype, we'll just sign the whole message
      // In a production system, we'd parse the XML and add signature properly
      
      // Check if the sender has a wallet
      const senderWallet = await identityManager.getWallet(senderDomain);
      if (!senderWallet) {
        throw new Error(`No wallet found for domain: ${senderDomain}`);
      }
      
      // Get active certificates for the sender
      const certificates = await certificateManager.getCertificatesForDomain(senderDomain);
      const validCertificates = [];
      
      for (const cert of certificates) {
        const isValid = await certificateManager.verifyCertificate(cert.id);
        if (isValid) {
          validCertificates.push(cert.id);
        }
      }
      
      // Parse the XML to extract message properties
      const messageProperties = await parseXml(xmlMessage);
      
      // Sign the original message
      const signature = await identityManager.signMessage(
        senderDomain,
        xmlMessage
      );
      
      // For the prototype, we'll just return the signature
      // In production, we'd properly embed it in the XML
      const signedMessage = `${xmlMessage}\n<!-- BSV Signature: ${signature} -->`;
      
      if (validCertificates.length > 0) {
        return `${signedMessage}\n<!-- BSV Certificates: ${validCertificates.join(',')} -->`;
      }
      
      return signedMessage;
    } catch (error) {
      console.error('Error signing UFTP message:', error);
      throw error;
    }
  }
  
  async verifyUftpMessage(signedXml) {
    try {
      // Extract the signature from the comment
      const signatureMatch = signedXml.match(/<!-- BSV Signature: ([^-]+) -->/);
      if (!signatureMatch) {
        return { verified: false, reason: 'No BSV signature found in message' };
      }
      
      const signature = signatureMatch[1];
      
      // Extract certificates if present
      const certificatesMatch = signedXml.match(/<!-- BSV Certificates: ([^-]+) -->/);
      const certificates = certificatesMatch ? certificatesMatch[1].split(',') : [];
      
      // Extract the original message
      const originalXml = signedXml
        .replace(/<!-- BSV Signature: [^-]+ -->/, '')
        .replace(/<!-- BSV Certificates: [^-]+ -->/, '')
        .trim();
      
      // Extract sender domain from UFTP XML
      const senderDomainMatch = originalXml.match(/SenderDomain="([^"]+)"/);
      if (!senderDomainMatch) {
        return { verified: false, reason: 'Cannot extract sender domain from message' };
      }
      
      const senderDomain = senderDomainMatch[1];
      
      // Verify signature
      try {
        const isSignatureValid = await identityManager.verifySignature(
          senderDomain,
          originalXml,
          signature
        );
        
        if (!isSignatureValid) {
          return { verified: false, reason: 'Invalid BSV signature' };
        }
      } catch (error) {
        return { verified: false, reason: `Signature verification error: ${error.message}` };
      }
      
      // Verify certificates if present
      for (const certId of certificates) {
        const isValid = await certificateManager.verifyCertificate(certId);
        if (!isValid) {
          return { verified: false, reason: `Invalid certificate: ${certId}` };
        }
      }
      
      return { 
        verified: true,
        senderDomain,
        certificateIds: certificates
      };
    } catch (error) {
      console.error('Error verifying UFTP message:', error);
      return { verified: false, reason: `Verification error: ${error.message}` };
    }
  }
}

export default new MessageSigner();