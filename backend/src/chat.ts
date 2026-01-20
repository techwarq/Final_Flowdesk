
import OpenAI from 'openai';
import { LocalVectorStore } from './vector_store.js';
import { loadAccounts } from './accounts.js';

// Ensure API Key is present in .env
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
});

const vectorStore = new LocalVectorStore();

export async function ingestOrdersForUser(userId: string) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is missing in .env');
    }

    const data = await loadAccounts();
    // Filter accounts belonging to this user
    const userAccounts = data.accounts.filter(a => a.userId === userId);

    const docs: any[] = [];
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
Receiver: ${order.receiverName || 'N/A'}
OTP: ${order.otp || 'N/A'}
Order ID: ${order.orderId}
Tracking ID: ${order.trackingId || 'N/A'}
URL: ${order.orderUrl || ''}
`.trim();

                try {
                    const embResponse = await openai.embeddings.create({
                        input: text,
                        model: 'text-embedding-3-small'
                    });

                    docs.push({
                        id: order.orderId, // Unique Key
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
    }


    if (docs.length > 0) {
        await vectorStore.addDocuments(docs);
    }
    return { count: processedCount, orderIds: docs.map(d => d.id) };
}



export async function chatWithContext(userId: string, query: string) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is missing in .env');
    }

    // 1. Embed query
    const embResponse = await openai.embeddings.create({
        input: query,
        model: 'text-embedding-3-small'
    });

    // 2. Search Vector Store
    const results = await vectorStore.search(embResponse.data[0].embedding, 10); // Check top 10


    let context = "No specific order details found relative to this query.";
    if (results.length > 0) {
        context = results.map(r => `[Order ID: ${r.id}] [Account ID: ${r.metadata.accountId}] ${r.text}`).join('\n\n');
    }


    // 3. Chat Completion with Tools
    const systemPrompt = `You are a helpful assistant for the user's shopping orders assistant 'FlowDesk'.
You have access to the user's order history via the context below.
If the user asks to see, list, or find specific orders, use the 'show_orders' tool with the relevant Order IDs from the context.
You can also provide "Account IDs" if the user asks for them, and explain which orders belong to which account.

**FORMATTING RULES:**
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
                description: 'Show a list of orders to the user with a UI card.',
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
        model: 'gpt-3.5-turbo',
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
            .map(r => r.metadata); // metadata contains the full Order object

        // Return a structured response that the UI can parse
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

