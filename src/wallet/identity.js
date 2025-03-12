import { Setup } from '@bsv/wallet-toolbox';
import { PrivateKey } from '@bsv/sdk';

class IdentityManager {
  constructor() {
    this.wallets = new Map(); // Store wallets by domain name
  }

  async createWallet(domain, existingRootKey = null) {
    try {
      // Generate or use an existing private key
      const rootKeyHex = existingRootKey || PrivateKey.fromRandom().toString();
      
      console.log(`Creating wallet for domain: ${domain}`);
      
      // Create an in-memory wallet for simplicity
      const { wallet } = await Setup.createWalletMemory({
        chain: 'main', // Use 'test' for testnet
        rootKeyHex
      });
      
      // Store the wallet
      this.wallets.set(domain, {
        wallet,
        rootKeyHex
      });
      
      // Get the public key
      const publicKey = await wallet.getPublicKey();
      
      return {
        domain,
        rootKeyHex,
        publicKey
      };
    } catch (error) {
      console.error('Error creating wallet:', error);
      throw error;
    }
  }
  
  async getWallet(domain) {
    return this.wallets.get(domain);
  }
  
  async signMessage(domain, message) {
    const walletInfo = this.wallets.get(domain);
    if (!walletInfo) {
      throw new Error(`No wallet found for domain: ${domain}`);
    }
    
    const signature = await walletInfo.wallet.createSignature(message);
    return signature;
  }
  
  async verifySignature(domain, message, signature) {
    const walletInfo = this.wallets.get(domain);
    if (!walletInfo) {
      throw new Error(`No wallet found for domain: ${domain}`);
    }
    
    return walletInfo.wallet.verifySignature(signature, message);
  }
}

export default new IdentityManager();