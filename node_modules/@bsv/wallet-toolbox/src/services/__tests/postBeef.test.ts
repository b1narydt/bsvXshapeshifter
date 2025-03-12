import { BeefTx } from '@bsv/sdk'
import { Services } from '../../index.client'
import { _tu } from '../../../test/utils/TestUtilsWalletStorage'
import { Setup } from '../../index.all'

describe('postBeef service tests', () => {
  jest.setTimeout(99999999)

  test('0 postBeef mainnet', async () => {
    if (Setup.noEnv('main')) return
    const options = Services.createDefaultOptions('main')
    const services = new Services(options)
    await postBeefTest(services)
  })

  test('1 postBeef testnet', async () => {
    if (Setup.noEnv('test')) return
    const options = Services.createDefaultOptions('test')
    const services = new Services(options)
    await postBeefTest(services)
  })
})

async function postBeefTest(services: Services) {
  const chain = services.chain
  if (Setup.noEnv(chain)) return
  const c = await _tu.createNoSendTxPair(chain)

  const txids = [c.txidDo, c.txidUndo]

  const [r] = await services.postBeef(c.beef, txids)
  expect(r.status).toBe('success')
  for (const txid of txids) {
    const tr = r.txidResults.find(tx => tx.txid === txid)
    expect(tr).not.toBeUndefined()
    expect(tr!.status).toBe('success')
  }

  // replace Undo transaction with double spend transaction and send again.
  const beef2 = c.beef.clone()
  beef2.txs[beef2.txs.length - 1] = BeefTx.fromTx(c.doubleSpendTx)
  const txids2 = [c.txidDo, c.doubleSpendTx.id('hex')]

  const [r2] = await services.postBeef(beef2, txids2)
  expect(r2.status).toBe('error')
  for (const txid of txids2) {
    const tr = r2.txidResults.find(tx => tx.txid === txid)
    expect(tr).not.toBeUndefined()
    if (txid === c.txidDo) {
      expect(tr!.status).toBe('success')
    } else {
      expect(tr!.status).toBe('error')
      expect(tr!.doubleSpend).toBe(true)
      expect(tr!.competingTxs).toEqual([c.txidUndo])
    }
  }
}
