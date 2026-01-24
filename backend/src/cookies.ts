import { BrowserContext } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { DATA_DIR } from './config.js';
import { pushCookies, fetchCookiesFromCloud } from './cloud.js';

const COOKIES_DIR = path.join(DATA_DIR, 'cookies');

export async function ensureCookiesDir() {
    await fs.ensureDir(COOKIES_DIR);
}

/**
 * Get cookie file path
 */
export function getCookieFilePath(accountId: string, platform: 'flipkart' | 'shopsy' = 'flipkart') {
    const id = accountId.toLowerCase().trim();
    return path.join(COOKIES_DIR, `${id}_${platform}.json`);
}

/**
 * Load cookies from database ONLY (no file fallback)
 * This is the preferred method for loading cookies.
 * 
 * Note: Flipkart and Shopsy share authentication, so if Shopsy cookies are not found,
 * we fall back to Flipkart cookies (and vice versa).
 */
export async function loadCookiesFromDB(accountId: string, platform: 'flipkart' | 'shopsy' = 'flipkart') {
    // Try cloud database - NO FALLBACK to disk
    try {
        // First try to get cookies for the requested platform
        let dbCookies = await fetchCookiesFromCloud(accountId, platform);
        if (dbCookies && dbCookies.length > 0) {
            console.log(`[Cookies] Loaded ${dbCookies.length} cookies from DB for ${accountId} (${platform})`);
            return dbCookies;
        }

        // Flipkart and Shopsy share authentication - try the other platform as fallback
        const fallbackPlatform = platform === 'shopsy' ? 'flipkart' : 'shopsy';
        dbCookies = await fetchCookiesFromCloud(accountId, fallbackPlatform);
        if (dbCookies && dbCookies.length > 0) {
            console.log(`[Cookies] Loaded ${dbCookies.length} cookies from DB for ${accountId} (fallback from ${fallbackPlatform})`);
            return dbCookies;
        }

        console.log(`[Cookies] No cookies found in DB for ${accountId} (${platform} or ${fallbackPlatform})`);
        return [];
    } catch (e: any) {
        console.error(`[Cookies] DB fetch failed for ${accountId}: ${e.message}`);
        return [];
    }
}

/**
 * Load cookies from disk and sanitize for Playwright
 */
export async function loadCookiesFromDisk(accountId: string, platform: 'flipkart' | 'shopsy' = 'flipkart') {
    const file = getCookieFilePath(accountId, platform);
    console.log(`[Cookies] loadCookiesFromDisk reading from: ${file}`);
    if (await fs.pathExists(file)) {
        const cookies = await fs.readJSON(file);
        console.log(`[Cookies] Read ${cookies.length} raw cookies from disk.`);
        // Sanitize cookies for Playwright - sameSite must be "Strict", "Lax", or "None"
        return cookies.map((c: any) => {
            const sanitized = { ...c };
            // Fix sameSite value
            // Fix sameSite value
            if (sanitized.sameSite === 'no_restriction') {
                sanitized.sameSite = 'None';
                sanitized.secure = true;
            } else if (sanitized.sameSite === 'None') {
                // Keep None, ensure Secure is true
                sanitized.secure = true;
            } else if (!sanitized.sameSite || !['Strict', 'Lax', 'None'].includes(sanitized.sameSite)) {
                sanitized.sameSite = 'Lax'; // Default to Lax if invalid
            }
            // Remove fields that Playwright doesn't accept
            delete sanitized.hostOnly;
            delete sanitized.session;
            delete sanitized.storeId;
            return sanitized;
        });
    }
    return [];
}

/**
 * Save cookies to disk
 */
export async function saveCookiesToDisk(accountId: string, cookies: any[], platform: 'flipkart' | 'shopsy' = 'flipkart') {
    await ensureCookiesDir();
    const file = getCookieFilePath(accountId, platform);
    await fs.writeJSON(file, cookies, { spaces: 2 });
    // Attempt cloud sync
    pushCookies(accountId, platform);
}

/**
 * Extracts cookies from the context and saves them directly to DB (DB-only)
 */
export async function extractAndSaveCookies(context: BrowserContext, accountId: string, platform: 'flipkart' | 'shopsy' = 'flipkart') {
    const id = accountId.toLowerCase().trim();

    let cookies: any[] = [];
    // Retry up to 5 times with a 1s delay
    for (let i = 0; i < 5; i++) {
        cookies = await context.cookies();
        // Look for common auth cookies
        if (cookies.length > 5) {
            console.log(`[Cookies] [${platform}] Found ${cookies.length} cookies on attempt ${i + 1}`);
            break;
        }
        console.log(`[Cookies] [${platform}] Attempt ${i + 1}: Only ${cookies.length} cookies found. Retrying...`);
        await new Promise(r => setTimeout(r, 1000));
    }

    if (cookies.length === 0) {
        throw new Error(`No cookies found in browser context for ${id} on ${platform}.`);
    }

    // Push directly to DB - no local file write
    await pushCookies(id, platform, cookies);
    console.log(`[Cookies] Saved ${cookies.length} cookies to Cloud DB for ${id} (${platform})`);

    return cookies;
}

/**
 * Loads Flipkart cookies, adapts them for Shopsy, and injects them.
 */
export async function injectFlipkartCookiesIntoShopsy(context: BrowserContext, accountId: string) {
    // Load from DB instead of disk
    const flipkartCookies = await loadCookiesFromDB(accountId, 'flipkart');
    if (!flipkartCookies || flipkartCookies.length === 0) return false;

    const shopsyCookies = adaptCookiesForShopsy(flipkartCookies);
    await context.addCookies(shopsyCookies);
    return true;
}

/**
 * Adapt cookies from flipkart.com to shopsy.in
 */
export function adaptCookiesForShopsy(cookies: any[]) {
    return cookies.map((c: any) => {
        const newCookie = { ...c };
        delete newCookie.hostOnly;
        delete newCookie.session;

        // Convert flipkart domains to shopsy
        if (c.domain.includes('flipkart.com')) {
            newCookie.domain = '.shopsy.in';
        }

        // Shopsy mobile web often requires Secure/None for session cookies to work across domains/subdomains
        if (['at', 'S', 'SN', 'T'].includes(c.name)) {
            newCookie.secure = true;
            newCookie.sameSite = 'None';
        }

        return newCookie;
    });
}
