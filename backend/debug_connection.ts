import { createClient } from '@supabase/supabase-js';

// process.env populated by runner (npx tsx --env-file=.env ...)
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLIC_KEY || process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('--- Debug Connection Suite (Strict Config) ---');
console.log('URL:', url);
console.log('Anon Key:', anonKey ? (anonKey.substring(0, 5) + '...' + anonKey.substring(anonKey.length - 5)) : 'MISSING');
console.log('Service Key:', serviceRoleKey ? (serviceRoleKey.substring(0, 5) + '...' + serviceRoleKey.substring(serviceRoleKey.length - 5)) : 'MISSING');

if (!url || !anonKey || !serviceRoleKey) {
    console.error('Missing one or more required env vars. Cannot run full test.');
    process.exit(1);
}

// MATCHING APP CONFIG EXACTLY
const supabaseAnon = createClient(url, anonKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
    }
});
const supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const TEST_EMAIL = 'debug_strict_user@flowdesk.internal';
const TEST_PASSWORD = 'debug_password_123';
const TARGET_EMAIL = 'admin@flowdesk.internal';

async function cleanup() {
    console.log('Cleaning up test user...');
    try {
        const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        const user = list?.users.find(u => u.email === TEST_EMAIL);
        if (user) {
            await supabaseAdmin.auth.admin.deleteUser(user.id);
        }
    } catch (e) {
        // ignore
    }
}

async function checkTargetUser() {
    console.log(`\nChecking status of ${TARGET_EMAIL}...`);
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) {
        console.error('Failed to list users:', error);
        return;
    }
    const targetUser = list?.users.find(u => u.email === TARGET_EMAIL);
    if (targetUser) {
        console.log('Target User Found:', {
            id: targetUser.id,
            email: targetUser.email,
            last_sign_in: targetUser.last_sign_in_at,
            created: targetUser.created_at,
            banned: targetUser.banned_until
        });
    } else {
        console.log('Target User NOT FOUND.');
    }
}

async function runTest() {
    await checkTargetUser();
    await cleanup();

    console.log('\n1. Creating Test User (Admin)...');
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true
    });

    if (createError) {
        console.error('Create User Failed:', JSON.stringify(createError, null, 2));
        return;
    }
    console.log('User Created OK:', createData.user.id);

    console.log('\n2. Attempting Login (Anon) with strict config...');
    try {
        const { data: loginData, error: loginError } = await supabaseAnon.auth.signInWithPassword({
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });

        if (loginError) {
            console.error('>>> LOGIN FAILED (CRITICAL) <<<');
            console.error('Error Full JSON:', JSON.stringify(loginError, null, 2));
        } else {
            console.log('>>> LOGIN SUCCESS <<<');
            console.log('Session created.');
        }
    } catch (e) {
        console.error('Login Exception:', e);
    }

    await cleanup();
}

runTest();
