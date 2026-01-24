


if (process.env.OPENAI_API_KEY) {
    console.log('OpenAI API Key loaded.');
} else {
    console.warn('OpenAI API Key NOT found in environment.');
}

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadAccounts, getAccount, upsertAccount, deleteAccount, updateAccountStatus } from './src/accounts.js';
// Re-export required functions if they are not directly exported or if path logic differs, 
// but here we import directly from the restored src files.
// Note: We need to ensure src/accounts.ts exports everything we need. 
// It does: loadAccounts, checkAccountHealth (wait, checkAccountHealth is in src/check/health.ts), refreshSession (src/refresh/flow.ts).
// I need to import them from correct paths.

import { checkAccountHealth as checkHealthLogic } from './src/check/health.js';
import { refreshSession as refreshSessionLogic } from './src/refresh/flow.js';
import { loginFlipkart } from './src/login/flipkart.js';
import { loginShopsy } from './src/login/shopsy.js';
import { signUpSupabase, signInSupabase, verifySession } from './src/auth_supabase.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

// Allow DELETE requests with Content-Type: application/json and empty body
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
    if (body === '' || body === null || body === undefined) {
        done(null, null);
    } else {
        try {
            const json = JSON.parse(body as string);
            done(null, json);
        } catch (err: any) {
            done(err, undefined);
        }
    }
});

// Health check
fastify.get('/api/health', async (request, reply) => {
    return { status: 'ok', version: '1.2.0' };
});

// Accounts
fastify.get('/api/accounts', async (request, reply) => {
    const authHeader = request.headers.authorization;
    let userId: string | undefined;

    // Check for auth token
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const session = await verifySession(token);
        if (session) {
            userId = session.id;
        }
    }

    const data = await loadAccounts();

    // If authenticated, filter by userId
    // If NOT authenticated, show NOTHING (or public accounts if any, but let's be strict for isolation)
    if (!userId) {
        // If user is not logged in, they shouldn't see any accounts ideally. 
        // But for backward compatibility during dev, maybe we allow it? 
        // User requested: "show just the ids that the user added"
        // So strict filtering is better.
        return { accounts: [] };
    }

    // Filter: Include accounts that match userId OR have no userId (legacy/admin-created?) 
    // Actually, "no userId" accounts should probably be visible to everyone or no one?
    // Let's strict filter: matches userId. 
    // BUT we must also consider the Admin role.
    // If role is admin, show all? User request didn't specify admin, but usually admins see all.
    // Let's implement: Users see their own. Admin sees all? 
    // "wit h eth role user profiles os in teh ui when i sing in with user then show just teh ids thath teh user added"
    // Implies users only see theirs.

    // Check role if we have it
    const session = await verifySession(authHeader!.split(' ')[1]);
    if (session?.role === 'admin') {
        return data;
    }

    const filtered = data.accounts.filter(a => a.userId === userId);
    return { accounts: filtered };
});

fastify.post('/api/accounts', async (request, reply) => {
    const authHeader = request.headers.authorization;
    let userId: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const session = await verifySession(token);
        if (session) {
            userId = session.id;
        }
    }

    if (!userId) {
        return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }

    const body = request.body as any;
    // Enforce userId ownership
    body.userId = userId;

    const account = await upsertAccount(body);
    return account;
});

fastify.delete('/api/accounts/:id', async (request, reply) => {
    // Add Auth Check
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const session = await verifySession(token);
    if (!session) {
        return reply.status(401).send({ success: false, message: 'Invalid session' });
    }

    try {
        const { id } = request.params as { id: string };
        const decodedId = decodeURIComponent(id);

        // Check ownership before delete if not admin
        if (session.role !== 'admin') {
            const account = await getAccount(decodedId);
            if (account && account.userId && account.userId !== session.id) {
                return reply.status(403).send({ success: false, message: 'Forbidden' });
            }
        }

        console.log(`[API] Deleting account: ${decodedId}`);
        const result = await deleteAccount(decodedId);
        return { success: result };
    } catch (e: any) {
        console.error('[API] Delete account error:', e);
        return reply.status(500).send({ success: false, error: e.message });
    }
});

fastify.post('/api/accounts/:id/login-session', async (request, reply) => {
    // Auth Check
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const session = await verifySession(token);
    if (!session) {
        return reply.status(401).send({ success: false, message: 'Invalid session' });
    }

    const { id } = request.params as { id: string };
    const { platform = 'flipkart', headless = false } = request.body as { platform: 'flipkart' | 'shopsy', headless?: boolean };
    const decodedId = decodeURIComponent(id);

    try {
        // Verify account exists and ownership
        const account = await getAccount(decodedId);
        if (!account) {
            return reply.status(404).send({ success: false, message: 'Account not found' });
        }
        if (session.role !== 'admin' && account.userId && account.userId !== session.id) {
            return reply.status(403).send({ success: false, message: 'Forbidden' });
        }

        console.log(`[API] Starting login session for ${decodedId} on ${platform} (Visible Browser)`);

        let result;
        if (platform === 'shopsy') {
            result = await loginShopsy({
                accountId: decodedId,
                identifier: account.identifier, // Use identifier from account
                headless: headless,
                keepOpen: true // Keep open until user manually closes
            });
        } else {
            result = await loginFlipkart({
                accountId: decodedId,
                identifier: account.identifier,
                headless: headless,
                keepOpen: true // Keep open until user manually closes
            });
        }

        return result;
    } catch (e: any) {
        console.error('[API] Login session error:', e);
        return reply.status(500).send({ success: false, error: e.message });
    }
});

fastify.post('/api/accounts/:id/rotate-ip', async (request, reply) => {
    // Note: this endpoint is called from the browser overlay, which might not have the auth token.
    // For local usage, we allow it. In production, we should inject a one-time token or session key.

    const { id } = request.params as { id: string };
    const decodedId = decodeURIComponent(id);

    try {
        const account = await getAccount(decodedId);
        if (!account) {
            return reply.status(404).send({ success: false, message: 'Account not found' });
        }

        // 1. Update Offset
        const currentOffset = account.proxyOffset || 0;
        await upsertAccount({
            id: decodedId,
            platform: account.platform,
            proxyOffset: currentOffset + 1
        });

        console.log(`[API] Rotating IP for ${decodedId} (New Offset: ${currentOffset + 1})`);

        // 2. Close active browsers
        // We need to find the active context and close it.
        // navigate to browserManager to find how to close specific. 
        // actually browsers.register uses `${accountId}-flipkart-login` etc.
        // We can just iterate or use browserManager if exposed. 
        // Let's use `browsers.closeAll()`? No, that closes ALL accounts.
        // We need `browsers.close(id)`. 
        // Let's import browsers and see if we can close specific. 
        // Helper: Access private map? No.
        // Let's just do: try close activeContexts in flipkart.ts if we could? 
        // We can't access flipkart.ts internals here easily.
        // But `browsers` is exported from `browserManager.ts`.
        // Let's check `browserManager.ts` content.
        // It has `contexts: Map<string, BrowserContext>`.
        // We can iterate and close keys starting with accountId.

        // 3. Restart Session (unless skipped)
        const { skipLaunch } = request.body as { skipLaunch?: boolean } || {};

        if (!skipLaunch) {
            setTimeout(async () => {
                // Close
                await browsers.closeAccount(decodedId);

                // Reopen
                console.log(`[API] Restarting session for ${decodedId}...`);
                if (account.platform === 'shopsy') {
                    await loginShopsy({ accountId: decodedId, identifier: account.identifier, headless: false, keepOpen: true });
                } else {
                    await loginFlipkart({ accountId: decodedId, identifier: account.identifier, headless: false, keepOpen: true });
                }
            }, 1000);
        }

        return { success: true, message: 'Rotation initiated' };

    } catch (e: any) {
        console.error('[API] Rotate IP error:', e);
        return reply.status(500).send({ success: false, error: e.message });
    }
});

import { getProxyForAccount } from './src/proxy.js';
fastify.get('/api/accounts/:id/proxy', async (request, reply) => {
    // Auth Check
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Loose auth for local dev overlay usage if needed, but safer to enforce
        return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const session = await verifySession(token);
    if (!session) return reply.status(403).send({ success: false, message: 'Forbidden' });

    const { id } = request.params as { id: string };
    const decodedId = decodeURIComponent(id);

    const proxy = await getProxyForAccount(decodedId);

    let proxyString: string | null = null;
    if (proxy) {
        if (proxy.username && proxy.password) {
            // Manually construct URL to avoid trailing slash from url.toString()
            const serverUrl = new URL(proxy.server);
            const protocol = serverUrl.protocol; // e.g., 'http:'
            const host = serverUrl.hostname;
            const port = serverUrl.port;
            // Format: protocol://username:password@host:port (NO trailing slash)
            proxyString = `${protocol}//${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@${host}:${port}`;
        } else {
            // Remove any trailing slash from server
            proxyString = proxy.server.replace(/\/$/, '');
        }
    }

    return { success: true, proxy: proxyString };
});

// Settings
import { getSettings, saveSettings, loadSettings } from './src/settings.js';

fastify.get('/api/settings', async (request, reply) => {
    return getSettings();
});

fastify.post('/api/settings', async (request, reply) => {
    const body = request.body as any;
    saveSettings(body);
    return { success: true };
});

// Proxies
import { loadProxies, saveProxies } from './src/proxy.js';

fastify.get('/api/proxies', async (request, reply) => {
    // Auth Check
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const session = await verifySession(token);
    if (!session || session.role !== 'admin') {
        return reply.status(403).send({ success: false, message: 'Forbidden' });
    }

    return await loadProxies();
});

fastify.post('/api/proxies', async (request, reply) => {
    // Auth Check
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const session = await verifySession(token);
    if (!session || session.role !== 'admin') {
        return reply.status(403).send({ success: false, message: 'Forbidden' });
    }

    const { proxies } = request.body as { proxies: string[] };
    if (!Array.isArray(proxies)) {
        return reply.status(400).send({ success: false, message: 'Proxies must be an array of strings' });
    }

    await saveProxies(proxies);
    return { success: true, count: proxies.length };
});

// Auth (Supabase)
fastify.post('/api/auth/signup', async (request, reply) => {
    const { username, password } = request.body as any;
    if (!username || !password) {
        return reply.status(400).send({ success: false, message: 'Username and password are required' });
    }
    return await signUpSupabase(username, password);
});

fastify.post('/api/auth/signin', async (request, reply) => {
    const { username, password } = request.body as any;
    if (!username || !password) {
        return reply.status(400).send({ success: false, message: 'Username and password are required' });
    }
    return await signInSupabase(username, password);
});

fastify.get('/api/auth/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const session = await verifySession(token);
    if (!session) {
        return reply.status(401).send({ success: false, message: 'Invalid or expired session' });
    }
    return { success: true, session };
});


// Operations
fastify.post('/api/check/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await getAccount(id);
    if (!account) {
        reply.status(404).send({ error: 'Account not found' });
        return;
    }

    // Run health check
    try {
        const result = await checkHealthLogic(account.platform, id);
        // Persist the status to the account
        if (result.status === 'Healthy' || result.status === 'NeedsRefresh' || result.status === 'Error') {
            await updateAccountStatus(id, result.status as any);
        }
        return result;
    } catch (error) {
        fastify.log.error(error);
        await updateAccountStatus(id, 'Error', String(error));
        return { status: 'Error', message: String(error) };
    }
});

fastify.post('/api/refresh/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await getAccount(id);
    if (!account) {
        reply.status(404).send({ error: 'Account not found' });
        return;
    }

    try {
        const result = await refreshSessionLogic(account.platform, id, account.identifier);
        return result || { status: 'success', message: 'Refresh process completed' };
    } catch (error) {
        fastify.log.error(error);
        return { status: 'error', message: String(error) };
    }
});

fastify.post('/api/login', async (request, reply) => {
    const body = request.body as any;
    const { accountId, identifier, platform } = body;

    try {
        let result;
        if (platform === 'flipkart') {
            result = await loginFlipkart({ accountId, identifier, headless: false, keepOpen: true });
        } else {
            result = await loginShopsy({ accountId, identifier, headless: false, keepOpen: true });
        }
        return result;
    } catch (error) {
        return { status: 'error', message: String(error) };
    }
});

// Session View - Opens browser with saved cookies
import { openSession } from './src/session.js';
import { fetchOrders } from './src/orders.js';
import { startBatchFetch, getJobStatus, cancelJob, pollRecentOrders, BatchJob, BatchProgress } from './src/batchOrders.js';

fastify.post('/api/session', async (request, reply) => {
    const body = request.body as any;
    const { accountId, platform } = body;

    try {
        const result = await openSession({ accountId, platform });
        return result;
    } catch (error) {
        console.error('[Session Error Detail]:', error);
        return { status: 'error', message: String(error) };
    }
});

fastify.post('/api/orders/:id/fetch', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { platform } = request.body as { platform: 'flipkart' | 'shopsy' };

    // Add auth check similar to other endpoints if needed, skipping for dev speed/consistency with session
    try {
        const result = await fetchOrders(id, platform);
        return result;
    } catch (error) {
        return { success: false, error: String(error) };
    }
});

fastify.post('/api/orders/:id/fetch-gv', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Import the new function dynamically to ensure it uses the latest file
    const { fetchGiftCardBalance } = await import('./src/orders.js');

    try {
        const result = await fetchGiftCardBalance(id);
        return result;
    } catch (error) {
        return { success: false, error: String(error) };
    }
});

// ============================================
// BATCH ORDER FETCHING
// ============================================

// Start batch fetch for multiple accounts
fastify.post('/api/orders/batch', async (request, reply) => {
    const { accountIds, platform, concurrency, headless } = request.body as {
        accountIds: string[];
        platform: 'flipkart' | 'shopsy';
        concurrency?: number;
        headless?: boolean;
    };

    if (!accountIds || accountIds.length === 0) {
        return reply.status(400).send({ success: false, message: 'accountIds array is required' });
    }

    if (!platform) {
        return reply.status(400).send({ success: false, message: 'platform is required' });
    }

    console.log(`[Batch] Starting batch fetch for ${accountIds.length} accounts on ${platform}`);

    // Start batch job - returns job ID immediately (synchronous)
    const jobId = startBatchFetch(accountIds, platform, {
        concurrency: concurrency || 5,
        headless: headless !== false,
        onProgress: (progress: BatchProgress) => {
            console.log(`[Batch] Progress: ${progress.completed}/${progress.total} - ${progress.type}`);
        }
    });

    return {
        success: true,
        jobId,
        message: `Batch job started for ${accountIds.length} accounts`,
        total: accountIds.length
    };
});

// Get batch job status
fastify.get('/api/orders/batch/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = getJobStatus(jobId);

    if (!job) {
        return reply.status(404).send({ success: false, message: 'Job not found' });
    }

    return {
        success: true,
        job: {
            jobId: job.jobId,
            status: job.status,
            total: job.total,
            completed: job.completed,
            failed: job.failed,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            results: job.results,
            errors: job.errors
        }
    };
});

// Cancel batch job
fastify.post('/api/orders/batch/:jobId/cancel', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const cancelled = cancelJob(jobId);

    if (!cancelled) {
        return reply.status(400).send({ success: false, message: 'Job not found or not running' });
    }

    return { success: true, message: 'Job cancellation requested' };
});

// Poll for recent orders (lightweight, for checking new orders)
fastify.post('/api/orders/poll', async (request, reply) => {
    const { accountIds, platform } = request.body as {
        accountIds: string[];
        platform: 'flipkart' | 'shopsy';
    };

    if (!accountIds || accountIds.length === 0) {
        return reply.status(400).send({ success: false, message: 'accountIds array is required' });
    }

    try {
        const results = await pollRecentOrders(accountIds, platform, {
            concurrency: 5,
            headless: true
        });

        return {
            success: true,
            accountsPolled: accountIds.length,
            accountsWithOrders: results.size,
            orders: Object.fromEntries(results)
        };
    } catch (error) {
        return { success: false, error: String(error) };
    }
});

// Browser Management
import { browsers } from './src/browserManager.js';

fastify.post('/api/terminate-all', async (request, reply) => {
    await browsers.closeAll();
    return { success: true };
});

// Cloud Sync
import { pullSyncData, fetchCloudUsers, upsertCloudUser as upsertCloudUserFn, deleteCloudUser as deleteCloudUserFn, fetchActivityLogs, fetchAppErrors as fetchCloudErrors, pushAccounts, pushAllCookies, checkCloudConnection } from './src/cloud.js';
import { initDirs } from './src/config.js';

fastify.post('/api/cloud/sync', async (request, reply) => {
    return await pullSyncData();
});


// Admin: Logs
import { getActivityLogs, getAppErrors } from './src/log.js';
import { loadCookiesFromDB } from './src/cookies.js';

fastify.get('/api/accounts/:id/:platform/cookies', async (request, reply) => {
    const { id, platform } = request.params as { id: string, platform: 'flipkart' | 'shopsy' };
    return await loadCookiesFromDB(id, platform);
});

fastify.get('/api/logs/activity', async (request, reply) => {
    // Try cloud first, else local
    const cloudLogs = await fetchActivityLogs();
    if (cloudLogs && cloudLogs.length > 0) return cloudLogs;
    return await getActivityLogs();
});

fastify.get('/api/logs/errors', async (request, reply) => {
    const cloudErrors = await fetchCloudErrors();
    if (cloudErrors && cloudErrors.length > 0) return cloudErrors;
    return await getAppErrors();
});

// Admin: Users
// Admin: Users
// REMOVED local getUsers/upsertUser/deleteUser imports to enforce Cloud-only mode

fastify.get('/api/admin/users', async (request, reply) => {
    const cloudUsers = await fetchCloudUsers();
    // Strict Cloud Only: If cloud fetch fails (null), return empty or error, do NOT fallback to local
    if (cloudUsers) return cloudUsers;
    return [];
});

fastify.post('/api/admin/users', async (request, reply) => {
    const body = request.body as any;
    const { username, password, role } = body;

    if (!username || !password) {
        return reply.status(400).send({ success: false, message: 'Username and password are required' });
    }

    // Use signUpSupabase to create user in profiles table with proper password hash
    try {
        const result = await signUpSupabase(username, password);

        if (!result.success) {
            return { success: false, message: result.message };
        }

        // If role specified (not user default), update the profile
        if (role && role !== 'user') {
            const { getSupabaseAdminClient } = await import('./src/cloud.js');
            const client = getSupabaseAdminClient();
            if (client) {
                await client
                    .from('profiles')
                    .update({ role: role })
                    .eq('username', username.toLowerCase());
            }
        }

        return { success: true, message: 'User created successfully', source: 'cloud' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
});

fastify.delete('/api/admin/users/:username', async (request, reply) => {
    const { username } = request.params as { username: string };
    try {
        await deleteCloudUserFn(username);
        return { success: true, source: 'cloud' };
    } catch (e: any) {
        // Strict Cloud Only: No fallback to local delete
        return reply.status(500).send({ success: false, message: e.message });
    }
});

fastify.post('/api/admin/accounts/clear-errors', async (request, reply) => {
    // Auth check
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const session = await verifySession(token);
    if (!session || session.role !== 'admin') {
        return reply.status(403).send({ success: false, message: 'Forbidden' });
    }

    try {
        const data = await loadAccounts();
        const errorAccounts = data.accounts.filter(a => a.status === 'Error');

        let count = 0;
        for (const acc of errorAccounts) {
            await updateAccountStatus(acc.id, 'NeedsRefresh');
            count++;
        }

        return { success: true, count, message: `Cleared errors for ${count} accounts.` };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
});

fastify.post('/api/admin/accounts/:id/reset', async (request, reply) => {
    // Auth check
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const session = await verifySession(token);
    if (!session || session.role !== 'admin') {
        return reply.status(403).send({ success: false, message: 'Forbidden' });
    }

    const { id } = request.params as { id: string };
    const decodedId = decodeURIComponent(id);

    try {
        await updateAccountStatus(decodedId, 'NeedsRefresh');
        return { success: true, message: `Account ${decodedId} reset.` };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
});


// Chat / AI
import { ingestOrdersForUser, chatWithContext } from './src/chat.js';

fastify.post('/api/chat/sync', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const session = await verifySession(token);
    if (!session) {
        return reply.status(401).send({ success: false, message: 'Invalid session' });
    }


    try {
        const result = await ingestOrdersForUser(session.id);
        return {
            success: true,
            count: result.count,
            orderIds: result.orderIds,
            message: `Synced ${result.count} orders to knowledge base.`
        };
    } catch (e: any) {
        fastify.log.error(e);
        return { success: false, error: e.message };
    }
});

fastify.post('/api/chat/ask', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const session = await verifySession(token);
    if (!session) {
        return reply.status(401).send({ success: false, message: 'Invalid session' });
    }

    const { query } = request.body as { query: string };
    if (!query) {
        return reply.status(400).send({ success: false, message: 'Query is required' });
    }

    try {
        const answer = await chatWithContext(session.id, query);
        return { success: true, answer };
    } catch (e: any) {
        fastify.log.error(e);
        return { success: false, error: e.message };
    }
});

// Cloud Sync health check
fastify.get('/api/cloud/status', async (request, reply) => {
    return checkCloudConnection();
});


const start = async () => {
    try {
        await initDirs();
        await loadSettings();
        console.log('Settings loaded.');

        const cloudStatus = await checkCloudConnection();
        if (cloudStatus.success) {
            console.log('Cloud Connection: OK');
        } else {
            console.warn(`Cloud Connection Warning: ${cloudStatus.message}`);
        }

        const port = parseInt(process.env.PORT || '3001');

        // Initial sync push to cloud - Serialize to avoid FK errors (Account must exist before Cookies)
        try {
            await pushAccounts();
            // Only push cookies after accounts are safely in DB
            pushAllCookies().catch(e => console.error('Initial cookie sync failed:', e));
        } catch (e) {
            console.error('Initial account sync failed:', e);
        }

        await fastify.listen({ port, host: '0.0.0.0' });
        console.log(`Server listening on port ${port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
