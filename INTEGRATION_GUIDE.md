import { WalletClient, AuthFetch } from '@bsv/sdk';

// Connect to user's wallet (e.g., Metanet Desktop)
const wallet = new WalletClient('json-api', 'localhost');
const authFetch = new AuthFetch(wallet);

// Make authenticated & paid API requests
const response = await authFetch.fetch('http://localhost:3001/api/messages');
const messages = await response.json();

```

## Next Steps

- Add the BRC-104/105 payment middleware to monetize specific endpoints
- Enhance the message parsing to extract more UFTP fields
- Set up LARS/CARS for cloud deployment
```
