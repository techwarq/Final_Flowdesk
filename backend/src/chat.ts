
import OpenAI from 'openai';
import { getVectorStoreForUser, VectorDocument } from './vector_store.js';
import { loadAccounts } from './accounts.js';

// Ensure API Key is present in .env
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * Ingest all orders for a user into their vector store
 */
export async function ingestOrdersForUser(userId: string) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is missing in .env');
    }

    const vectorStore = getVectorStoreForUser(userId);
    const data = await loadAccounts();
    // Filter accounts belonging to this user
    const userAccounts = data.accounts.filter(a => a.userId === userId);

    const docs: VectorDocument[] = [];
    let processedCount = 0;

    for (const acc of userAccounts) {
        if (acc.orders && acc.orders.length > 0) {
            for (const order of acc.orders) {
                // Construct a rich text representation for embedding
                const text = `
Order: ${order.productName}
Price: ${order.price || 'N/A'}
Status: ${order.status}
Delivery Details: ${order.deliveryDetails || 'N/A'}
Delivery Date: ${order.deliveryDate || 'N/A'}
Receiver: ${order.receiverName || 'N/A'}
OTP: ${order.otp || 'N/A'}
Order ID: ${order.orderId}
Tracking ID: ${order.trackingId || 'N/A'}
Account: ${acc.id}
Platform: ${acc.platform}
URL: ${order.orderUrl || ''}
`.trim();

                try {
                    const embResponse = await openai.embeddings.create({
                        input: text,
                        model: 'text-embedding-3-small'
                    });

                    docs.push({
                        id: order.orderId,
                        text,
                        metadata: {
                            ...order,
                            accountId: acc.id,
                            platform: acc.platform
                        },
                        embedding: embResponse.data[0].embedding
                    });
                    processedCount++;
                } catch (e) {
                    console.error(`[Chat] Failed to embed order ${order.orderId}:`, e);
                }
            }
        }

        // Also index account info itself
        const accountText = `
Account ID: ${acc.id}
Platform: ${acc.platform}
Status: ${acc.status || 'Unknown'}
Name: ${acc.details?.name || 'N/A'}
GV Balance: ${acc.details?.gvBalance || 'N/A'}
Orders Count: ${acc.orders?.length || 0}
`.trim();

        try {
            const embResponse = await openai.embeddings.create({
                input: accountText,
                model: 'text-embedding-3-small'
            });

            docs.push({
                id: `account_${acc.id}`,
                text: accountText,
                metadata: {
                    type: 'account',
                    accountId: acc.id,
                    platform: acc.platform,
                    status: acc.status,
                    details: acc.details
                },
                embedding: embResponse.data[0].embedding
            });
        } catch (e) {
            console.error(`[Chat] Failed to embed account ${acc.id}:`, e);
        }
    }

    if (docs.length > 0) {
        await vectorStore.addDocuments(docs);
    }
    console.log(`[Chat] Ingested ${processedCount} orders and ${userAccounts.length} accounts for user ${userId}`);
    return { count: processedCount, orderIds: docs.map(d => d.id) };
}

/**
 * Update chat context with newly fetched orders (called at runtime)
 */
export async function updateOrdersInContext(userId: string, accountId: string, platform: string, orders: any[]) {
    if (!process.env.OPENAI_API_KEY || orders.length === 0) {
        return { updated: 0 };
    }

    const vectorStore = getVectorStoreForUser(userId);
    const docs: VectorDocument[] = [];

    for (const order of orders) {
        // Skip if already indexed (optimization)
        if (vectorStore.hasDocument(order.orderId)) {
            continue;
        }

        const text = `
Order: ${order.productName}
Price: ${order.price || 'N/A'}
Status: ${order.status}
Delivery Details: ${order.deliveryDetails || 'N/A'}
Delivery Date: ${order.deliveryDate || 'N/A'}
Receiver: ${order.receiverName || 'N/A'}
OTP: ${order.otp || 'N/A'}
Order ID: ${order.orderId}
Tracking ID: ${order.trackingId || 'N/A'}
Account: ${accountId}
Platform: ${platform}
URL: ${order.orderUrl || ''}
`.trim();

        try {
            const embResponse = await openai.embeddings.create({
                input: text,
                model: 'text-embedding-3-small'
            });

            docs.push({
                id: order.orderId,
                text,
                metadata: {
                    ...order,
                    accountId,
                    platform
                },
                embedding: embResponse.data[0].embedding
            });
        } catch (e) {
            console.error(`[Chat] Failed to embed order ${order.orderId}:`, e);
        }
    }

    if (docs.length > 0) {
        await vectorStore.addDocuments(docs);
        console.log(`[Chat] Runtime update: Added ${docs.length} new orders to context for user ${userId}`);
    }

    return { updated: docs.length };
}

/**
 * Update chat context when a new account is added
 */
export async function updateAccountInContext(userId: string, account: any) {
    if (!process.env.OPENAI_API_KEY) {
        return { updated: false };
    }

    const vectorStore = getVectorStoreForUser(userId);

    const accountText = `
Account ID: ${account.id}
Platform: ${account.platform}
Status: ${account.status || 'Unknown'}
Name: ${account.details?.name || 'N/A'}
GV Balance: ${account.details?.gvBalance || 'N/A'}
Orders Count: ${account.orders?.length || 0}
`.trim();

    try {
        const embResponse = await openai.embeddings.create({
            input: accountText,
            model: 'text-embedding-3-small'
        });

        await vectorStore.addDocuments([{
            id: `account_${account.id}`,
            text: accountText,
            metadata: {
                type: 'account',
                accountId: account.id,
                platform: account.platform,
                status: account.status,
                details: account.details
            },
            embedding: embResponse.data[0].embedding
        }]);

        console.log(`[Chat] Runtime update: Added account ${account.id} to context for user ${userId}`);
        return { updated: true };
    } catch (e) {
        console.error(`[Chat] Failed to embed account ${account.id}:`, e);
        return { updated: false };
    }
}

/**
 * Chat with context (main chat function)
 */
export async function chatWithContext(userId: string, query: string) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is missing in .env');
    }

    const vectorStore = getVectorStoreForUser(userId);

    // 1. Embed query
    const embResponse = await openai.embeddings.create({
        input: query,
        model: 'text-embedding-3-small'
    });

    // 2. Search Vector Store
    const results = await vectorStore.search(embResponse.data[0].embedding, 10);

    let context = "No specific order or account details found relative to this query.";
    if (results.length > 0) {
        context = results.map(r => `[ID: ${r.id}] ${r.text}`).join('\n\n');
    }

    // 3. Chat Completion with Tools
    const systemPrompt = `You are a helpful assistant for the user's shopping orders assistant 'FlowDesk'.
You have access to the user's order history and account information via the context below.

**CRITICAL INSTRUCTION FOR LISTS:**
If the user asks to **list**, **show**, **find**, or **display** multiple orders (e.g. "show orders in transit", "list my orders"), you **MUST** use the 'show_orders' tool.
Do NOT write a text list of orders. The UI card is the required format.
Only write text if you are explaining a single order or if no tooling capability matches.

**FORMATTING RULES (for non-list responses):**
- Use **Markdown** for all lists.
- Use bullet points (-) for listing items, orders, or accounts.
- **NEVER** write a long paragraph for a list of items.
- Bold (**text**) key details like Order IDs, Account IDs, and Status.

Answer the user's question accurately based ONLY on the provided context.
If no relevant orders or accounts are found for the specific request, say so.
Be concise and friendly.

CONTEXT:
${context}`;

    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
        {
            type: 'function',
            function: {
                name: 'show_orders',
                description: 'Display a structured UI list of orders. Use this whenever the user asks to list/show multiple orders.',
                parameters: {
                    type: 'object',
                    properties: {
                        orderIds: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'List of Order IDs to show.'
                        }
                    },
                    required: ['orderIds']
                }
            }
        }
    ];

    const completion = await openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query }
        ],
        tools: tools,
        tool_choice: 'auto'
    });

    const choice = completion.choices[0];
    const toolCall = choice.message.tool_calls?.[0];

    if (toolCall && toolCall.type === 'function' && toolCall.function.name === 'show_orders') {
        const args = JSON.parse(toolCall.function.arguments);
        const orderIds = args.orderIds as string[];

        // Retrieve full order objects from metadata
        const richOrders = results
            .filter(r => orderIds.includes(r.id))
            .map(r => r.metadata);

        return JSON.stringify({
            answer: "Here are the orders you asked about:",
            data: {
                type: 'orders',
                items: richOrders
            }
        });
    }

    // Standard text response
    return JSON.stringify({
        answer: choice.message.content || "I couldn't find that.",
        data: null
    });
}
