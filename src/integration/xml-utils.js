import { parseString as parseXmlString, Builder } from 'xml2js';

export function parseXml(xmlString) {
  return new Promise((resolve, reject) => {
    parseXmlString(xmlString, { explicitArray: false }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        try {
          // Extract the root element - usually something like FlexRequest
          const rootKey = Object.keys(result)[0];
          resolve(result[rootKey].$);
        } catch (e) {
          // If we can't parse it the structured way, return the raw result
          resolve(result);
        }
      }
    });
  });
}

export function buildXml(obj) {
  try {
    const builder = new Builder();
    // Reconstruct the root element structure
    const rootName = obj.messageType || 'UftpMessage';
    const wrapped = { [rootName]: { $: obj } };
    return builder.buildObject(wrapped);
  } catch (error) {
    console.error('Error building XML:', error);
    // If we can't build properly, return a simplified version
    return `<${obj.messageType || 'UftpMessage'} BSVSignature="${obj.BSVSignature || ''}" />`;
  }
}