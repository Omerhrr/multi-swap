import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  actionSpecOpenApiPostRequestBody,
  actionsSpecOpenApiGetResponse,
  actionsSpecOpenApiPostResponse,
} from './openapi';

import {
  ActionsSpecErrorResponse,
  ActionsSpecGetResponse,
  ActionsSpecPostRequestBody,
  ActionsSpecPostResponse,
} from '../../spec/actions-spec';

import jupiterApi from './jupiter-api';

import { prepareTransaction } from './transaction-utils';

const SWAP_AMOUNT_USD_OPTIONS = [10, 100, 1000];
const DEFAULT_SWAP_AMOUNT_USD = 10;

const app = new OpenAPIHono();

app.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Multi-Token Swap'],
    responses: actionsSpecOpenApiGetResponse,
  }),
  async (c) => {
    const tokenList = await jupiterApi.getStrictList();
    const response: ActionsSpecGetResponse = {
      icon: 'https://your-dapp-logo-url.com',
      label: 'Swap Tokens',
      title: 'Multi-Token Swap',
      description: 'Swap between various tokens using Jupiter',
      links: {
        actions: [
          {
            href: '/api/swap/{inputToken}/{outputToken}/{amount}',
            label: 'Swap Tokens',
            parameters: [
              { name: 'inputToken', label: 'Input Token' },
              { name: 'outputToken', label: 'Output Token' },
              { name: 'amount', label: 'Amount in USD' },
            ],
          },
        ],
      },
    };
    return c.json(response);
  }
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/{inputToken}/{outputToken}/{amount}',
    tags: ['Multi-Token Swap'],
    request: {
      params: z.object({
        inputToken: z.string(),
        outputToken: z.string(),
        amount: z.string(),
      }),
    },
    responses: actionsSpecOpenApiGetResponse,
  }),
  async (c) => {
    const { inputToken, outputToken, amount } = c.req.param();
    const [inputTokenMeta, outputTokenMeta] = await Promise.all([
      jupiterApi.lookupToken(inputToken),
      jupiterApi.lookupToken(outputToken),
    ]);

    if (!inputTokenMeta || !outputTokenMeta) {
      return c.json({
        icon: 'https://your-dapp-logo-url.com',
        label: 'Not Available',
        title: `Swap ${inputToken} to ${outputToken}`,
        description: 'Token swap',
        disabled: true,
        error: {
          message: 'Token metadata not found.',
        },
      } satisfies ActionsSpecGetResponse, 400);
    }

    const response: ActionsSpecGetResponse = {
      icon: 'https://www.freeimages.com/vector/fine-pattern-background-5368148',
      label: `Swap ${inputTokenMeta.symbol} to ${outputTokenMeta.symbol}`,
      title: `Swap ${inputTokenMeta.symbol} to ${outputTokenMeta.symbol}`,
      description: `Swap ${amount} USD worth of ${inputTokenMeta.symbol} to ${outputTokenMeta.symbol}`,
    };

    return c.json(response);
  }
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/{inputToken}/{outputToken}/{amount}',
    tags: ['Multi-Token Swap'],
    request: {
      params: z.object({
        inputToken: z.string(),
        outputToken: z.string(),
        amount: z.string(),
      }),
      body: actionSpecOpenApiPostRequestBody,
    },
    responses: actionsSpecOpenApiPostResponse,
  }),
  async (c) => {
    try {
      const { inputToken, outputToken, amount } = c.req.param();
      const { account } = (await c.req.json()) as ActionsSpecPostRequestBody;

      const [inputTokenMeta, outputTokenMeta] = await Promise.all([
        jupiterApi.lookupToken(inputToken),
        jupiterApi.lookupToken(outputToken),
      ]);

      if (!inputTokenMeta || !outputTokenMeta) {
        return c.json(
          {
            message: 'Token metadata not found.',
          } satisfies ActionsSpecErrorResponse,
          400
        );
      }

      const swapAmount = await calculateSwapAmount(inputTokenMeta.address, parseFloat(amount));

      const quoteRequest = {
        inputMint: inputTokenMeta.address,
        outputMint: outputTokenMeta.address,
        amount: swapAmount.toString(),
        slippageBps: 50,
      };

      const quote = await jupiterApi.quoteGet(quoteRequest);

      const swapRequest = {
        swapRequest: {
          quoteResponse: quote,
          userPublicKey: account,
          wrapUnwrapSOL: true,
        },
      };

      const swapResponse = await jupiterApi.swapPost(swapRequest);

      // Prepare the transaction
      const transaction = await prepareTransaction(
        swapResponse.swapTransaction.instructions,
        new PublicKey(account)
      );

      const serializedTransaction = transaction.serialize();
      const base64Transaction = Buffer.from(serializedTransaction).toString('base64');

      const response: ActionsSpecPostResponse = {
        transaction: base64Transaction,
        message: `Swap ${amount} USD worth of ${inputTokenMeta.symbol} to ${outputTokenMeta.symbol}`,
      };
      return c.json(response);
    } catch (error) {
      console.error('Error in swap endpoint:', error);
      return c.json(
        {
          message: `An error occurred: ${error.message}`,
        } satisfies ActionsSpecErrorResponse,
        500
      );
    }
  }
);
async function calculateSwapAmount(tokenAddress: string, usdAmount: number): Promise<number> {
  const tokenPrices = await jupiterApi.getTokenPricesInUsdc([tokenAddress]);
  const tokenPrice = tokenPrices[tokenAddress]?.price;
  if (!tokenPrice) {
    throw new Error('Failed to get token price');
  }
  return Math.floor(usdAmount / tokenPrice * Math.pow(10, 6)); // Assuming 6 decimals for USDC
}

export default app;