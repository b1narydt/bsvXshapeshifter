import identityManager from './identity.js';

class CertificateManager {
  constructor() {
    this.certificates = new Map();
  }
  
  async createCertificate(issuerDomain, subjectDomain, permissions = []) {
    // Check if issuer has a wallet
    const issuer = await identityManager.getWallet(issuerDomain);
    if (!issuer) {
      throw new Error(`Issuer domain not found: ${issuerDomain}`);
    }
    
    // Get or create a wallet for the subject
    let subject = await identityManager.getWallet(subjectDomain);
    if (!subject) {
      subject = await identityManager.createWallet(subjectDomain);
    }
    
    // Create certificate data
    const certificateData = {
      issuer: issuerDomain,
      subject: subjectDomain,
      subjectPublicKey: await subject.wallet.getPublicKey(),
      permissions,
      issuedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year validity
    };
    
    // Sign certificate with issuer's key
    const signature = await identityManager.signMessage(
      issuerDomain, 
      JSON.stringify(certificateData)
    );
    
    const certificate = {
      ...certificateData,
      signature
    };
    
    // Store certificate
    const certId = `${issuerDomain}-${subjectDomain}-${Date.now()}`;
    this.certificates.set(certId, certificate);
    
    return {
      id: certId,
      ...certificate
    };
  }
  
  async verifyCertificate(certId) {
    const cert = this.certificates.get(certId);
    if (!cert) {
      return false;
    }
    
    // Check if certificate is expired
    if (new Date(cert.validUntil) < new Date()) {
      return false;
    }
    
    // Verify signature
    const { signature, ...certData } = cert;
    try {
      return await identityManager.verifySignature(
        cert.issuer,
        JSON.stringify(certData),
        signature
      );
    } catch (error) {
      console.error('Error verifying certificate:', error);
      return false;
    }
  }
  
  async getCertificatesForDomain(domain) {
    const results = [];
    
    for (const [id, cert] of this.certificates.entries()) {
      if (cert.subject === domain) {
        results.push({
          id,
          ...cert
        });
      }
    }
    
    return results;
  }
}

export default new CertificateManager();