import {
  Beef,
  CreateActionArgs,
  CreateActionOptions,
  CreateActionResult,
  OutpointString,
  P2PKH,
  PrivateKey,
  PublicKey,
  Script,
  SignActionArgs
} from '@bsv/sdk'
import {
  asString,
  EntityProvenTxReq,
  EntitySyncState,
  Monitor,
  sdk,
  Services,
  Setup,
  StorageKnex,
  TableOutput,
  TableUser,
  verifyId,
  verifyOne,
  wait
} from '../../../src'
import { _tu, TestWalletNoSetup } from '../../utils/TestUtilsWalletStorage'
import { monitorEventLoopDelay } from 'perf_hooks'
import { specOpInvalidChange, validateCreateActionArgs, ValidCreateActionArgs } from '../../../src/sdk'

const setActiveClient = true
const useMySQLConnectionForClient = true

describe('localWallet tests', () => {
  jest.setTimeout(99999999)

  test('00', () => {})
  if (_tu.noTestEnv('test')) return
  if (_tu.noTestEnv('main')) return

  test('0 monitor runOnce', async () => {
    const setup = await createSetup('test')
    await setup.monitor.runOnce()
    await setup.wallet.destroy()
  })

  test('1 recover 1 sat outputs', async () => {
    const setup = await createSetup('test')
    await recoverOneSatTestOutputs(setup)
    await setup.wallet.destroy()
  })

  test('2 create 1 sat delayed', async () => {
    const setup = await createSetup('test')
    const car = await createOneSatTestOutput(setup, {}, 1)
    //await trackReqByTxid(setup, car.txid!)
    await setup.wallet.destroy()
  })

  test('2a create 1 sat immediate', async () => {
    const setup = await createSetup('test')
    const car = await createOneSatTestOutput(setup, { acceptDelayedBroadcast: false }, 1)
    // await trackReqByTxid(setup, car.txid!)
    await setup.wallet.destroy()
  })

  test('2b create 2 nosend and sendWith', async () => {
    const setup = await createSetup('test')
    const car = await createOneSatTestOutput(setup, { noSend: true }, 2)
    //await trackReqByTxid(setup, car.txid!)
    await setup.wallet.destroy()
  })

  test('3 return active to cloud client', async () => {
    const setup = await createSetup('test')
    const localBalance = await setup.wallet.balance()
    const log = await setup.storage.setActive(setup.clientStorageIdentityKey!)
    console.log(log)
    console.log(`ACTIVE STORAGE: ${setup.storage.getActiveStoreName()}`)
    const clientBalance = await setup.wallet.balance()
    expect(localBalance.total).toBe(clientBalance.total)
    await setup.wallet.destroy()
  })

  test('4 review change utxos', async () => {
    const setup = await createSetup('test')
    const lor = await setup.wallet.listOutputs({
      basket: specOpInvalidChange,
      limit: 1000
    })
    if (lor.totalOutputs > 0) {
      debugger
      const lor = await setup.wallet.listOutputs({
        basket: specOpInvalidChange,
        tags: ['release']
      })
    }
    /*
    const storage = setup.activeStorage
    const services = setup.services
    const { invalidSpendableOutputs: notUtxos } = await confirmSpendableOutputs(storage, services)
    const outputsToUpdate = notUtxos.map(o => ({ id: o.outputId, satoshis: o.satoshis }))
    const total: number = outputsToUpdate.reduce((t, o) => t + o.satoshis, 0)
    debugger
    // *** About set spendable = false for outputs ***
    for (const o of outputsToUpdate) {
      await storage.updateOutput(o.id, { spendable: false })
    }
    */
    await setup.wallet.destroy()
  })

  test('5 review synchunk', async () => {
    const setup = await createSetup('test')
    const identityKey = setup.identityKey
    const reader = setup.activeStorage
    const readerSettings = reader.getSettings()
    const writer = setup.storage._backups![0].storage
    const writerSettings = writer.getSettings()
    const ss = await EntitySyncState.fromStorage(writer, identityKey, readerSettings)
    const args = ss.makeRequestSyncChunkArgs(identityKey, writerSettings.storageIdentityKey)
    const chunk = await reader.getSyncChunk(args)
    await setup.wallet.destroy()
  })

  test('6 backup', async () => {
    const setup = await createSetup('test')
    const log = await setup.storage.updateBackups()
    console.log(log)
    await setup.wallet.destroy()
  })
})

async function createSetup(chain: sdk.Chain): Promise<TestWalletNoSetup> {
  const env = _tu.getEnv(chain)
  if (!env.testIdentityKey) throw new sdk.WERR_INVALID_PARAMETER('env.testIdentityKey', 'valid')
  if (!env.testFilePath) throw new sdk.WERR_INVALID_PARAMETER('env.testFilePath', 'valid')

  const setup = await _tu.createTestWallet({
    chain,
    rootKeyHex: env.devKeys[env.testIdentityKey],
    filePath: env.testFilePath,
    setActiveClient,
    addLocalBackup: false,
    useMySQLConnectionForClient
  })

  console.log(`ACTIVE STORAGE: ${setup.storage.getActiveStoreName()}`)

  return setup
}

async function createOneSatTestOutput(
  setup: TestWalletNoSetup,
  options: CreateActionOptions = {},
  howMany: number = 1
): Promise<CreateActionResult> {
  if (howMany < 1) throw new sdk.WERR_INVALID_PARAMETER('howMany', 'at least 1')

  let car: CreateActionResult = {}

  let noSendChange: OutpointString[] | undefined = undefined
  let txids: string[] = []
  let vargs: ValidCreateActionArgs

  for (let i = 0; i < howMany; i++) {
    const args: CreateActionArgs = {
      outputs: [
        {
          lockingScript: new P2PKH().lock(PublicKey.fromString(setup.identityKey).toAddress()).toHex(),
          satoshis: 1,
          outputDescription: 'test output',
          customInstructions: JSON.stringify({
            type: 'P2PKH',
            key: 'identity'
          }),
          basket: 'test-output'
        }
      ],
      description: 'create test output',
      options: {
        ...options,
        noSendChange
      }
    }
    vargs = validateCreateActionArgs(args)
    car = await setup.wallet.createAction(args)
    expect(car.txid)
    txids.push(car.txid!)
    noSendChange = car.noSendChange

    const req = await EntityProvenTxReq.fromStorageTxid(setup.activeStorage, car.txid!)
    expect(req !== undefined && req.history.notes !== undefined)
    if (req && req.history.notes) {
      if (vargs.isNoSend) {
        expect(req.status === 'nosend').toBe(true)
        expect(req.history.notes.length).toBe(1)
        const n = req.history.notes[0]
        expect(n.what === 'status' && n.status_now === 'nosend').toBe(true)
      } else {
        expect(req.status === 'unsent').toBe(true)
        expect(req.history.notes.length).toBe(1)
        const n = req.history.notes[0]
        expect(n.what === 'status' && n.status_now === 'unsent').toBe(true)
      }
    }
  }

  if (vargs!.isNoSend) {
    // Create final sending transaction
    const args: CreateActionArgs = {
      description: 'send batch',
      options: {
        ...options,
        sendWith: txids
      }
    }
    vargs = validateCreateActionArgs(args)
    car = await setup.wallet.createAction(args)
  }

  return car
}

async function recoverOneSatTestOutputs(setup: TestWalletNoSetup): Promise<void> {
  const outputs = await setup.wallet.listOutputs({
    basket: 'test-output',
    include: 'entire transactions',
    limit: 1000
  })

  if (outputs.outputs.length > 8) {
    const args: CreateActionArgs = {
      inputBEEF: outputs.BEEF!,
      inputs: [],
      description: 'recover test output'
    }
    const p2pkh = new P2PKH()
    for (const o of outputs.outputs) {
      args.inputs!.push({
        unlockingScriptLength: 108,
        outpoint: o.outpoint,
        inputDescription: 'recovered test output'
      })
    }
    const car = await setup.wallet.createAction(args)
    expect(car.signableTransaction)

    const st = car.signableTransaction!
    const beef = Beef.fromBinary(st.tx)
    const tx = beef.findAtomicTransaction(beef.txs.slice(-1)[0].txid)!
    const signArgs: SignActionArgs = {
      reference: st.reference,
      spends: {} //  0: { unlockingScript } },
    }
    for (let i = 0; i < outputs.outputs.length; i++) {
      const o = outputs.outputs[i]
      const unlock = p2pkh.unlock(setup.keyDeriver.rootKey, 'all', false)
      const unlockingScript = (await unlock.sign(tx, i)).toHex()
      signArgs.spends[i] = { unlockingScript }
    }
    const sar = await setup.wallet.signAction(signArgs)
    expect(sar.txid)
  }
}

async function trackReqByTxid(setup: TestWalletNoSetup, txid: string): Promise<void> {
  const req = await EntityProvenTxReq.fromStorageTxid(setup.activeStorage, txid)

  expect(req !== undefined && req.history.notes !== undefined)
  if (!req || !req.history.notes) throw new sdk.WERR_INTERNAL()

  let newBlocks = 0
  let lastHeight: number | undefined
  for (; req.status !== 'completed'; ) {
    let height = setup.monitor.lastNewHeader?.height
    if (req.status === 'unsent') {
      // send it...
    }
    if (req.status === 'sending') {
      // send it...
    }
    if (req.status === 'unmined') {
      if (height && lastHeight) {
        if (height === lastHeight) {
          await wait(1000 * 60)
        } else {
          newBlocks++
          expect(newBlocks < 5)
        }
      }
    }

    await setup.monitor.runOnce()
    await req.refreshFromStorage(setup.activeStorage)
    lastHeight = height
  }
}

export async function confirmSpendableOutputs(
  storage: StorageKnex,
  services: Services,
  identityKey?: string
): Promise<{ invalidSpendableOutputs: TableOutput[] }> {
  const invalidSpendableOutputs: TableOutput[] = []
  const partial: Partial<TableUser> = {}
  if (identityKey) partial.identityKey = identityKey
  const users = await storage.findUsers({ partial })

  for (const { userId } of users) {
    const defaultBasket = verifyOne(await storage.findOutputBaskets({ partial: { userId, name: 'default' } }))
    const where: Partial<TableOutput> = {
      userId,
      basketId: defaultBasket.basketId,
      spendable: true
    }

    const outputs = await storage.findOutputs({ partial: where })

    for (let i = outputs.length - 1; i >= 0; i--) {
      const o = outputs[i]
      const oid = verifyId(o.outputId)

      if (o.spendable) {
        let ok = false

        if (o.lockingScript && o.lockingScript.length > 0) {
          const r = await services.getUtxoStatus(asString(o.lockingScript), 'script')

          if (r.status === 'success' && r.isUtxo && r.details?.length > 0) {
            const tx = await storage.findTransactionById(o.transactionId)

            if (
              tx &&
              tx.txid &&
              r.details.some(d => d.txid === tx.txid && d.satoshis === o.satoshis && d.index === o.vout)
            ) {
              ok = true
            }
          }
        }

        if (!ok) {
          invalidSpendableOutputs.push(o)
        }
      }
    }
  }

  return { invalidSpendableOutputs }
}
