import { sdk, verifyOne } from '../../../src'
import { specOpInvalidChange, specOpSetWalletChangeParams, specOpWalletBalance } from '../../../src/sdk'
import { _tu, TestWalletNoSetup } from '../../utils/TestUtilsWalletStorage'

describe('specOps tests', () => {
  jest.setTimeout(99999999)

  test('00', () => {})
  if (_tu.noTestEnv('test')) return
  if (_tu.noTestEnv('main')) return

  test('0 wallet balance specOp', async () => {
    const setup = await createSetup('test')

    const r = await setup.wallet.listOutputs({ basket: specOpWalletBalance })

    expect(r.totalOutputs > 0).toBe(true)
    expect(r.outputs.length === 0).toBe(true)

    await setup.wallet.destroy()
  })

  test('1 wallet invalid change outputs', async () => {
    const setup = await createSetup('test')

    const r = await setup.wallet.listOutputs({
      basket: specOpInvalidChange
      //tags: ['release', 'foobar']
    })

    expect(r.totalOutputs).toBe(0)
    expect(r.outputs.length).toBe(0)

    await setup.wallet.destroy()
  })

  test('2 update default basket params', async () => {
    const setup = await createSetup('test')

    const before = verifyOne(
      await setup.activeStorage.findOutputBaskets({
        partial: { userId: setup.userId, name: 'default' }
      })
    )

    const r = await setup.wallet.listOutputs({
      basket: specOpSetWalletChangeParams,
      tags: ['33', '6']
    })

    const after = verifyOne(
      await setup.activeStorage.findOutputBaskets({
        partial: { userId: setup.userId, name: 'default' }
      })
    )

    expect(r.totalOutputs).toBe(0)
    expect(r.outputs.length).toBe(0)
    expect(after.minimumDesiredUTXOValue).toBe(6)
    expect(after.numberOfDesiredUTXOs).toBe(33)

    // Restore original values...
    await setup.wallet.listOutputs({
      basket: specOpSetWalletChangeParams,
      tags: [before.numberOfDesiredUTXOs.toString(), before.minimumDesiredUTXOValue.toString()]
    })

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
    setActiveClient: false,
    addLocalBackup: false,
    useMySQLConnectionForClient: false
  })

  console.log(`ACTIVE STORAGE: ${setup.storage.getActiveStoreName()}`)

  return setup
}
