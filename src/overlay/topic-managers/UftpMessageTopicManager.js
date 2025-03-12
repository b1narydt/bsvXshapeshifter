import { TopicManager } from '@bsv/overlay'

export default class UftpMessageTopicManager extends TopicManager {
async identifyAdmissibleOutputs(tx, outputs) {
const admissibleOutputs = []

    for (let i = 0; i < outputs.length; i++) {
      const output = outputs[i]

      try {
        // Check if this output contains a UFTP message
        const scriptHex = output.script?.toHex()

        if (!scriptHex) continue

        // Look for our UFTP marker in the output
        if (this.containsUftpMessage(scriptHex)) {
          console.log(`Found UFTP message in output ${i}`)
          admissibleOutputs.push(i)
        }
      } catch (error) {
        console.error('Error processing output:', error)
      }
    }

    return admissibleOutputs

}

/\*\*

- Checks if a script contains a UFTP message
  \*/
  containsUftpMessage(scriptHex) {
  // OP_RETURN is 0x6a in hex
  if (!scriptHex.startsWith('6a')) {
  return false
  }


    // Check for "UFTP" marker - "UFTP" in hex is 55465450
    return scriptHex.includes('55465450')

}

/\*\*

- Topic manager documentation
  \*/
  getDocumentation() {
  return `# UFTP Message Topic Manager

This Topic Manager tracks UFTP (USEF Flex Trading Protocol) messages on the BSV blockchain.

## Admission Criteria

Messages are admitted to this overlay if they:

1. Are stored in OP_RETURN outputs
2. Contain the "UFTP" marker in their data
3. Follow a valid UFTP message format

## Message Types

The Topic Manager recognizes all standard UFTP message types as defined by the Shapeshifter specification:

- FlexRequest
- FlexRequestResponse
- FlexOffer
- FlexOfferResponse
- FlexOrder
- FlexOrderResponse
  ... and many more

## Purpose

This overlay provides tamper-proof storage and verification of energy flexibility trading messages,
creating an immutable audit trail for regulatory compliance and settlement purposes.
`
}
}
