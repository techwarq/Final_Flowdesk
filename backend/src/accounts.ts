import { BrowserContext } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { ACCOUNTS_FILE, DATA_DIR, PROFILES_DIR, ENCRYPTED_DIR } from './config.js';
import { pushAccounts, pushAccount, pushCookies, deleteCloudAccount, fetchAccountsFromCloud, deleteAccountFromCloud } from './cloud.js';

const COOKIES_DIR = path.join(DATA_DIR, 'cookies');

export type Platform = 'flipkart' | 'shopsy';
export type LoginType = 'email' | 'mobile';
export type AccountStatus =
    | 'New'           // Not yet initialized
    | 'Healthy'       // Session is valid
    | 'NeedsRefresh'  // Session may be stale
    | 'OTPRequired'   // Re-login needed
    | 'Locked'        // Account locked/suspended
    | 'Error';        // Unknown error state

export interface Account {
    id: string;
    userId?: string;            // Added for user isolation
    platform: Platform;
    loginType: LoginType;
    identifier: string;         // email or mobile number
    status: AccountStatus;
    assignedTo?: string;        // operator name
    lastLoginAt?: string;       // ISO timestamp
    lastValidateAt?: string;    // ISO timestamp
    errorCode?: string;         // last error reason
    createdAt: string;          // ISO timestamp
    updatedAt: string;          // ISO timestamp
    // For automated recovery
    emailConfig?: {
        user: string;
        passEncrypted: string;
        host: string;
    };
    details?: {
        name?: string;
        mobile?: string;
        email?: string;
        superCoins?: string;
        isPlus?: boolean;
        gvBalance?: string;
    };
    proxyOffset?: number; // Used for IP rotation
    orders?: Order[];
}

export interface Order {
    orderId: string;
    productName: string;
    status: string; // e.g., 'Delivered', 'Cancelled', 'On the way'
    deliveryDate: string; // or expected date
    imageUrl?: string;
    price?: string;
    orderUrl: string;
    otp?: string;
    receiverName?: string;
    trackingId?: string;
    deliveryDetails?: string;
}

export interface AccountsData {
    accounts: Account[];
}

/**
 * Simple Promise-based queue to serialize database operations
 */
let saveQueue: Promise<void> = Promise.resolve();

/**
 * Load all accounts from cloud database (DB-only, no file fallback)
 */
export async function loadAccounts(): Promise<AccountsData> {
    const operation = async () => {
        // Fetch from database ONLY - no file fallback
        const dbAccounts = await fetchAccountsFromCloud();
        if (dbAccounts && dbAccounts.length > 0) {
            console.log(`[Accounts] Loaded ${dbAccounts.length} accounts from DB`);
            return { accounts: dbAccounts as Account[] };
        }
        console.log('[Accounts] No accounts found in database');
        return { accounts: [] };
    };

    // Queue reads to be safe
    const result = saveQueue.then(operation);
    saveQueue = result.then(() => { }, () => { }); // Catch errors to not block the queue
    return result;
}

/**
 * Save accounts data - pushes to cloud DB directly (no local file)
 */
export async function saveAccounts(data: AccountsData): Promise<void> {
    const operation = async () => {
        // Push to cloud DB directly - no local file operations
        console.log(`[Accounts] Saving ${data.accounts.length} accounts to DB`);
    };

    saveQueue = saveQueue.then(operation).then(() => {
        // Push all accounts to cloud
        pushAccounts();
    }).catch(err => {
        console.error('[Accounts] Critical error in save queue:', err);
    });
    return saveQueue;
}

/**
 * Get a single account by ID
 */
export async function getAccount(accountId: string): Promise<Account | undefined> {
    const data = await loadAccounts();
    const id = accountId.toLowerCase().trim();
    return data.accounts.find(a => a.id.toLowerCase() === id);
}

/**
 * Create or update an account - directly in database (DB-only)
 */
export async function upsertAccount(account: Partial<Account> & { id: string; platform: Platform }): Promise<Account> {
    const id = account.id.toLowerCase().trim();
    const now = new Date().toISOString();

    // Check if account exists in DB
    const data = await loadAccounts();
    const existingIndex = data.accounts.findIndex(a => a.id.toLowerCase() === id);

    let resultAccount: Account;

    if (existingIndex >= 0) {
        // Update existing
        const existing = data.accounts[existingIndex];
        resultAccount = {
            ...existing,
            ...account,
            updatedAt: now,
            // Preserve userId if not provided in update
            userId: account.userId || existing.userId
        } as Account;
    } else {
        // Create new
        resultAccount = {
            loginType: 'mobile',
            identifier: '',
            status: 'New',
            createdAt: now,
            updatedAt: now,
            ...account,
            id: id // Force standardized ID
        } as Account;
    }

    // Push directly to DB - no local file operations
    await pushAccount(resultAccount);
    console.log(`[Accounts] ${existingIndex >= 0 ? 'Updated' : 'Created'} account ${id} in database`);

    return resultAccount;
}

/**
 * Update account status
 */
export async function updateAccountStatus(
    accountId: string,
    status: AccountStatus,
    errorCode?: string
): Promise<void> {
    const data = await loadAccounts();
    const id = accountId.toLowerCase().trim();
    const account = data.accounts.find(a => a.id.toLowerCase() === id);
    if (account) {
        account.status = status;
        account.updatedAt = new Date().toISOString();
        if (status === 'Healthy') {
            account.lastValidateAt = account.updatedAt;
            delete account.errorCode;
        } else if (errorCode) {
            account.errorCode = errorCode;
        }
        // Push directly to DB
        await pushAccount(account);
    }
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(accountId: string): Promise<void> {
    const data = await loadAccounts();
    const id = accountId.toLowerCase().trim();
    const account = data.accounts.find(a => a.id.toLowerCase() === id);
    if (account) {
        account.lastLoginAt = new Date().toISOString();
        account.lastValidateAt = account.lastLoginAt;
        account.updatedAt = account.lastLoginAt;
        account.lastValidateAt = account.lastLoginAt;
        account.status = 'Healthy';
        account.updatedAt = account.lastLoginAt;
        delete account.errorCode;
        // Push directly to DB
        await pushAccount(account);
    }
}

/**
 * Get all accounts for a specific platform
 */
export async function getAccountsByPlatform(platform: Platform): Promise<Account[]> {
    const data = await loadAccounts();
    return data.accounts.filter(a => a.platform === platform);
}

/**
 * Get all account IDs
 */
export async function getAllAccountIds(): Promise<string[]> {
    const data = await loadAccounts();
    return data.accounts.map(a => a.id);
}

/**
 * Delete an account - from database (DB-only, no local file fallback)
 */
export async function deleteAccount(accountId: string): Promise<boolean> {
    const id = accountId.toLowerCase().trim();

    try {
        // Delete from cloud DB (this also deletes cookies, local_storage in the function)
        const success = await deleteAccountFromCloud(id);

        if (success) {
            console.log(`[Accounts] Deleted account ${id} from database`);

            // Also cleanup local files if they exist (legacy cleanup)
            try {
                // Cookie files
                const cookiePath = path.join(COOKIES_DIR, `${id}_flipkart.json`);
                if (await fs.pathExists(cookiePath)) await fs.remove(cookiePath);
                const shopsyCookiePath = path.join(COOKIES_DIR, `${id}_shopsy.json`);
                if (await fs.pathExists(shopsyCookiePath)) await fs.remove(shopsyCookiePath);

                // Profile directories
                const flipkartProfilePath = path.join(PROFILES_DIR, 'flipkart', id);
                if (await fs.pathExists(flipkartProfilePath)) await fs.remove(flipkartProfilePath);
                const shopsyProfilePath = path.join(PROFILES_DIR, 'shopsy', id);
                if (await fs.pathExists(shopsyProfilePath)) await fs.remove(shopsyProfilePath);

                // Encrypted backups
                const flipkartEncPath = path.join(ENCRYPTED_DIR, 'flipkart', `${id}.zip.enc`);
                if (await fs.pathExists(flipkartEncPath)) await fs.remove(flipkartEncPath);
                const shopsyEncPath = path.join(ENCRYPTED_DIR, 'shopsy', `${id}.zip.enc`);
                if (await fs.pathExists(shopsyEncPath)) await fs.remove(shopsyEncPath);

                // Local storage files
                const lsPath = path.join(DATA_DIR, 'storage', `${id}_flipkart.json`);
                if (await fs.pathExists(lsPath)) await fs.remove(lsPath);
                const shopsyLsPath = path.join(DATA_DIR, 'storage', `${id}_shopsy.json`);
                if (await fs.pathExists(shopsyLsPath)) await fs.remove(shopsyLsPath);
            } catch (e) {
                console.warn(`[Accounts] Warning: Could not cleanup local files for ${id}:`, e);
            }

            return true;
        }

        console.warn(`[Accounts] Account ${id} not found in database`);
        return false;
    } catch (e) {
        console.error(`[Accounts] Failed to delete account ${id}:`, e);
        return false;
    }
}
