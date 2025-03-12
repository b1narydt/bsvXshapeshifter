import { AcquireCertificateResult } from '@bsv/sdk'
import { sdk, TableCertificateX, Wallet } from '../../index.client'

export async function acquireDirectCertificate(
  wallet: Wallet,
  auth: sdk.AuthId,
  vargs: sdk.ValidAcquireDirectCertificateArgs
): Promise<AcquireCertificateResult> {
  const now = new Date()
  const newCert: TableCertificateX = {
    certificateId: 0, // replaced by storage insert
    created_at: now,
    updated_at: now,
    userId: auth.userId!,
    type: vargs.type,
    subject: vargs.subject,
    verifier: vargs.keyringRevealer === 'certifier' ? vargs.certifier : vargs.keyringRevealer,
    serialNumber: vargs.serialNumber,
    certifier: vargs.certifier,
    revocationOutpoint: vargs.revocationOutpoint,
    signature: vargs.signature,
    fields: [],
    isDeleted: false
  }
  for (const [name, value] of Object.entries(vargs.fields)) {
    newCert.fields?.push({
      certificateId: 0, // replaced by storage insert
      created_at: now,
      updated_at: now,
      userId: auth.userId!,
      fieldName: name,
      fieldValue: value,
      masterKey: vargs.keyringForSubject[name] || ''
    })
  }

  const count = await wallet.storage.insertCertificate(newCert)

  const r: AcquireCertificateResult = {
    type: vargs.type,
    subject: vargs.subject,
    serialNumber: vargs.serialNumber,
    certifier: vargs.certifier,
    revocationOutpoint: vargs.revocationOutpoint,
    signature: vargs.signature,
    fields: vargs.fields
  }

  return r
}
