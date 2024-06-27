// Multi-Swap Action API

const express = require('express');
const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
const { Jupiter } = require('@jup-ag/core');

const app = express();
app.use(express.json());

const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
const connection = new Connection(SOLANA_RPC_URL);

app.get('/api/swap', async (req, res) => {
  try {
    res.json({
      icon: 'https://your-icon-url.com/multi-swap-icon.png',
      title: 'Multi-Swap Tokens',
      description: 'Swap multiple tokens in a single transaction',
      label: 'Start Multi-Swap',
      links: {
        actions: [
          {
            label: 'Swap Tokens',
            href: '/api/swap',
            parameters: [
              {
                name: 'swaps',
                label: 'Enter swap details (JSON array)',
                required: true
              }
            ]
          }
        ]
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch multi-swap options' });
  }
});

app.post('/api/swap', async (req, res) => {
  try {
    const { account, swaps } = req.body;
    
    if (!account || !swaps || !Array.isArray(swaps)) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const userPublicKey = new PublicKey(account);
    
    const jupiter = await Jupiter.load({
      connection,
      cluster: 'mainnet-beta',
      user: userPublicKey
    });

    const routes = await Promise.all(swaps.map(async (swap) => {
      const { inputMint, outputMint, amount } = swap;
      return jupiter.computeRoutes({
        inputMint: new PublicKey(inputMint),
        outputMint: new PublicKey(outputMint),
        amount,
        slippageBps: 50,
      });
    }));

    const transactions = routes.map(route => route.transactions);
    
    // Combine all transactions into a single one
    const combinedTransaction = new Transaction();
    transactions.forEach(tx => {
      tx.forEach(instruction => combinedTransaction.add(instruction));
    });

    const serializedTransaction = combinedTransaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    const base64Transaction = serializedTransaction.toString('base64');

    res.json({
      transaction: base64Transaction,
      message: 'Multi-swap transaction created successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create multi-swap transaction' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Multi-Swap Action API is running on port ${PORT}`);
});