import {
  AbortActionArgs,
  AbortActionResult,
  AcquireCertificateArgs,
  AcquireCertificateResult,
  CreateActionArgs,
  CreateActionResult,
  DiscoverByAttributesArgs,
  DiscoverByIdentityKeyArgs,
  DiscoverCertificatesResult,
  InternalizeActionArgs,
  InternalizeActionResult,
  KeyDeriverApi,
  ListActionsArgs,
  ListActionsResult,
  ListCertificatesArgs,
  ListCertificatesResult,
  ListOutputsArgs,
  ListOutputsResult,
  ProveCertificateArgs,
  ProveCertificateResult,
  RelinquishCertificateArgs,
  RelinquishCertificateResult,
  RelinquishOutputArgs,
  RelinquishOutputResult,
  SignActionArgs,
  SignActionResult
} from '@bsv/sdk'
import { sdk } from '../index.client'

/**
 */
export interface WalletSigner {
  isWalletSigner: true

  chain: sdk.Chain
  keyDeriver: KeyDeriverApi
}
