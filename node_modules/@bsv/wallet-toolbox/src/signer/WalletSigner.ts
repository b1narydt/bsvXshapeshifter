import { KeyDeriver } from '@bsv/sdk'
import { sdk } from '../index.client'
import { WalletStorageManager } from '../storage/WalletStorageManager'

export class WalletSigner {
  isWalletSigner: true = true

  chain: sdk.Chain
  keyDeriver: KeyDeriver
  storage: WalletStorageManager

  constructor(chain: sdk.Chain, keyDeriver: KeyDeriver, storage: WalletStorageManager) {
    this.chain = chain
    this.keyDeriver = keyDeriver
    this.storage = storage
  }
}
