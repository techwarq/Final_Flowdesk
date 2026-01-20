import { chromium, BrowserContext } from 'playwright';
import path from 'path';
import fs from 'fs-extra';
import { PROFILES_DIR } from './config.js';
import { generateFingerprint } from './fingerprint.js';
import { getAccountLogger } from './log.js';
import { loadCookiesFromDisk } from './cookies.js';
import { upsertAccount, getAccount } from './accounts.js';

// Helper for human-like pauses
// Helper for human-like pauses
const humanDelay = async (page: any, min = 1000, max = 3000) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await page.waitForTimeout(delay);
};

// Extracted scraping logic
// Extracted scraping logic
async function scrapeGVBalance(page: any): Promise<string> {
    // Wait for any likely content
    await page.waitForTimeout(3000);

    // DEBUG: Save HTML to file to inspect structure
    try {
        const content = await page.content();
        const debugPath = path.resolve(process.cwd(), 'gv_debug.html');
        await fs.writeFile(debugPath, content);
        console.log(`[GV DEBUG] Saved HTML to ${debugPath}`);
    } catch (err) {
        console.error('[GV DEBUG] Failed to save HTML:', err);
    }

    let gvBalance = '';

    // Targeted Selectors based on gv_debug.html analysis:

    // 1. Sidebar: "Gift Cards ... ₹50"
    // HTML: <div class="aHEnsO POpXL2">Gift Cards<span class="lOBLTK">₹50</span></div>
    const sidebarBalance = await page.$eval('.aHEnsO.POpXL2 .lOBLTK', (el: any) => el.innerText).catch(() => null);
    if (sidebarBalance) {
        gvBalance = sidebarBalance;
    }

    // 2. Main Card: "1 ACTIVE GIFT CARD ... ₹50"
    // HTML: <div class="JPsLgX">...<div class="fxwOp_">₹50</div></div>
    if (!gvBalance) {
        const mainCardBalance = await page.$eval('.JPsLgX .fxwOp_', (el: any) => el.innerText).catch(() => null);
        if (mainCardBalance) {
            gvBalance = mainCardBalance;
        }
    }

    // Fallback: Generic active card search (slightly refined)
    if (!gvBalance) {
        const activeCardBalance = await page.evaluate(() => {
            const allDivs = Array.from(document.querySelectorAll('div'));
            // Look for "ACTIVE GIFT CARD" text specifically in the card header format
            const activeHeader = allDivs.find(d => d.innerText && d.innerText.includes('ACTIVE GIFT CARD'));

            if (activeHeader) {
                // The price class in the dump is 'fxwOp_' which is a sibling of the cloud icon inside 'JPsLgX'
                // Let's traverse up to the common container 'JPsLgX' or 'DDZB8E's parent
                const container = activeHeader.closest('.JPsLgX') || activeHeader.parentElement?.parentElement;
                if (container) {
                    // Try to find the price div which often has a currency symbol
                    const priceDiv = Array.from(container.querySelectorAll('div')).find(el => (el as HTMLElement).innerText.match(/^₹[\d,]+$/));
                    if (priceDiv) return (priceDiv as HTMLElement).innerText;
                }
            }
            return null;
        });

        if (activeCardBalance) {
            gvBalance = activeCardBalance;
        }
    }

    // Final clean up
    if (gvBalance) {
        gvBalance = gvBalance.trim();
        // Ensure it starts with ₹ if it's just a number (though likely it has it)
        if (!gvBalance.startsWith('₹') && /^\d/.test(gvBalance)) {
            gvBalance = '₹' + gvBalance;
        }
    }

    return gvBalance;
}

export async function fetchGiftCardBalance(accountId: string) {
    const log = getAccountLogger(accountId);
    const platform = 'flipkart';
    const fingerprint = generateFingerprint(platform, accountId);

    log.info(`[GV] Starting GV Fetch for ${accountId}`);

    const cookies = await loadCookiesFromDisk(accountId, platform);
    if (cookies.length === 0) {
        throw new Error('No saved cookies found. Please log in first.');
    }

    // const { getChromiumPath } = await import('./browserManager.js'); 
    // Manual path resolution to avoid import issues for now
    // Note: getChromiumPath might not be exported, we might need to duplicate path logic or fix imports. 
    // To be safe and quick, I will use same path logic as fetchOrders.

    // START: Path Logic Duplication (Temporary safety)
    const __filename = new URL(import.meta.url).pathname;
    const __dirname = path.dirname(__filename);
    const browsersPath = path.resolve(__dirname, '..', 'browsers');
    const chromiumDir = fs.readdirSync(browsersPath).find(d => d.startsWith('chromium-'));
    if (!chromiumDir) throw new Error(`Chromium not found in ${browsersPath}`);
    let browserExecPath = '';
    if (process.platform === 'darwin') {
        browserExecPath = path.join(browsersPath, chromiumDir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
    } else if (process.platform === 'win32') {
        browserExecPath = path.join(browsersPath, chromiumDir, 'chrome-win64/chrome.exe');
    } else {
        browserExecPath = path.join(browsersPath, chromiumDir, 'chrome-linux/chrome');
    }
    // END: Path Logic

    const browser = await chromium.launch({
        headless: true,
        executablePath: browserExecPath,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });

    try {
        const context = await browser.newContext({
            userAgent: fingerprint.userAgent,
            locale: fingerprint.locale,
            timezoneId: fingerprint.timezoneId,
            viewport: { width: 1280, height: 720 }
        });

        await context.addCookies(cookies);
        const page = await context.newPage();

        await page.goto('https://www.flipkart.com/account/giftcard', { waitUntil: 'domcontentloaded', timeout: 30000 });

        const gvBalance = await scrapeGVBalance(page);

        if (gvBalance) {
            log.info(`[GV] Balance found: ${gvBalance}`);
            const acc = await getAccount(accountId);
            if (acc) {
                await upsertAccount({
                    id: accountId,
                    platform: platform,
                    details: { ...acc.details, gvBalance }
                });
            }
        } else {
            log.info('[GV] No confirmed balance found.');
        }

        return { success: true, balance: gvBalance };

    } catch (e: any) {
        log.error(`[GV] Error: ${e.message}`);
        throw e;
    } finally {
        await browser.close();
    }
}

export async function fetchOrders(accountId: string, platform: 'flipkart' | 'shopsy') {
    const log = getAccountLogger(accountId);
    const normalizedId = accountId.toLowerCase().trim();
    const profilePath = path.join(PROFILES_DIR, platform, normalizedId, 'userDataDir');
    const fingerprint = generateFingerprint(platform, accountId);

    // Check if there is an active session
    let context: BrowserContext | undefined;

    log.info(`[Orders] Starting on-demand fetch for ${accountId}`);

    let browser = null;

    try {
        // Shopsy uses the same auth as Flipkart - always load Flipkart cookies
        const cookiePlatform = 'flipkart'; // Shopsy shares auth with Flipkart
        const cookies = await loadCookiesFromDisk(accountId, cookiePlatform);
        if (cookies.length === 0) {
            throw new Error('No saved cookies found. Please log in first.');
        }

        // Resolve correct executable path locally
        const __filename = new URL(import.meta.url).pathname;
        const __dirname = path.dirname(__filename);
        const browsersPath = path.resolve(__dirname, '..', 'browsers');
        // Find existing chromium folder
        const chromiumDir = fs.readdirSync(browsersPath).find(d => d.startsWith('chromium-'));
        if (!chromiumDir) {
            throw new Error(`Chromium not found in ${browsersPath}`);
        }

        let execPath = '';
        if (process.platform === 'darwin') {
            execPath = path.join(browsersPath, chromiumDir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
        } else if (process.platform === 'win32') {
            execPath = path.join(browsersPath, chromiumDir, 'chrome-win64/chrome.exe');
        } else {
            execPath = path.join(browsersPath, chromiumDir, 'chrome-linux/chrome');
        }

        browser = await chromium.launch({
            headless: true, // Headless mode for batch fetching
            executablePath: execPath,
            args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
        });

        context = await browser.newContext({
            userAgent: fingerprint.userAgent,
            locale: fingerprint.locale,
            timezoneId: fingerprint.timezoneId,
            viewport: { width: 1280, height: 720 }
        });

        await context.addCookies(cookies);

        // Determine base domain based on platform
        const baseDomain = platform === 'shopsy' ? 'https://www.shopsy.in/mobile-view-page?url=%2Frv%2Forders' : 'https://www.flipkart.com';

        // 1. Fetch GV Balance (Quickly in separate tab) - only for Flipkart, Shopsy doesn't have GV
        if (platform === 'flipkart') {
            try {
                const gvPage = await context.newPage();
                log.info('[Orders] Checking GV Balance...');
                await gvPage.goto(`${baseDomain}/account/giftcard`, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Use shared scraping logic
                const gvBalance = await scrapeGVBalance(gvPage);

                if (gvBalance) {
                    log.info(`[Orders] GV Balance found: ${gvBalance}`);
                    // Update account details immediately
                    const acc = await getAccount(accountId);
                    if (acc) {
                        await upsertAccount({
                            id: accountId,
                            platform: platform,
                            details: { ...acc.details, gvBalance }
                        });
                    }
                }
                await gvPage.close();
            } catch (e: any) {
                log.warn(`[Orders] Failed to fetch GV Balance: ${e.message}`);
                // Don't fail the whole process
            }
        }

        const page = await context.newPage();
        log.info('[Orders] Navigating to orders page...');

        // DEBUG: Wait to let user see
        await page.waitForTimeout(4000);

        const currentUrl = page.url(); // Restore variable
        const currentTitle = await page.title();
        log.info(`[Orders] Current URL: ${currentUrl}`);
        log.info(`[Orders] Current Title: ${currentTitle}`);

        // Basic check if logged in
        if (currentUrl.includes('/login')) {
            throw new Error('Cookies expired. Please log in again.');
        }

        // Determine if we are on List or Details page (User might have navigated)
        const isDetailsPage = currentUrl.includes('order_details') || currentUrl.includes('order_id');
        let orders: any[] = [];

        if (isDetailsPage) {
            log.info('[Orders] Detected Details Page. Scraping single order...');
            const order = await page.evaluate(() => {
                const urlParams = new URLSearchParams(window.location.search);
                const orderId = urlParams.get('order_id');
                if (!orderId) return null;

                const text = document.body.innerText;

                // Price
                const priceMatch = text.match(/₹\d+(?:,\d+)*/);
                const price = priceMatch ? priceMatch[0] : '';

                // Name
                const name = document.title.replace('Flipkart.com:', '').trim() || 'Order Details';
                const status = 'Ordered'; // Default

                // OTP
                let otp = '';
                const otpMatch = text.match(/OTP\s*[:\-]?\s*(\d{4,6})/i);
                if (otpMatch) otp = otpMatch[1];

                // Receiver Name (Address section)
                let receiverName = '';
                // Look for "Delivery Address" header then the name
                const addressHeader = Array.from(document.querySelectorAll('div, span')).find(el => el.textContent?.includes('Delivery Address'));
                if (addressHeader) {
                    // The name is usually in a bold div immediately following or inside the container
                    const container = addressHeader.closest('div[class*="row"]')?.parentElement;
                    if (container) {
                        const nameEl = container.querySelector('.__name_class_candidate, ._33RNHZ, div[style*="font-weight: 600"]'); // Hypothetical classes
                        // Fallback: look for 6-digit pin code and take lines before it
                        const lines = container.innerText.split('\n');
                        const addrIdx = lines.findIndex(l => l.includes('Delivery Address'));
                        if (addrIdx !== -1 && lines[addrIdx + 1]) receiverName = lines[addrIdx + 1];
                    }
                }

                // Tracking ID
                let trackingId = '';
                const items = Array.from(document.querySelectorAll('*'));
                const trackEl = items.find(el => el.textContent?.includes('Tracking ID') || el.textContent?.startsWith('FMPC') || el.textContent?.startsWith('FMPP'));
                if (trackEl) {
                    const match = trackEl.textContent?.match(/(FMPC|FMPP)\w+/);
                    if (match) trackingId = match[0];
                }

                return {
                    orderId,
                    productName: name,
                    price: price,
                    status: status,
                    deliveryDate: '',
                    imageUrl: '',
                    orderUrl: window.location.href,
                    otp,
                    receiverName,
                    trackingId
                };
            });
            if (order) orders.push(order);

        } else {
            // LIST PAGE STRATEGY
            log.info('[Orders] List page detected. Scrolling to load all items...');

            // Human-like scroll to bottom to trigger lazy loading
            try {
                let previousHeight = 0;
                let sameHeightCount = 0;
                while (sameHeightCount < 3) {
                    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
                    if (currentHeight === previousHeight) {
                        sameHeightCount++;
                    } else {
                        sameHeightCount = 0;
                        previousHeight = currentHeight;
                    }

                    // Scroll down in chunks
                    await page.mouse.wheel(0, 600);
                    await humanDelay(page, 500, 1500);

                    // Check if "Show More" exists and click it? (Flipkart usually infinite scrolls or paginates)
                    // But usually just scrolling works for recent 10-20.
                }
            } catch (e) {
                log.warn('[Orders] Scrolling error: ' + e);
            }

            // Wait for list items (updated selectors based on dump: .ZcgLRi, .kok32b)
            try {
                // Expanded selectors
                await page.waitForSelector('.ZcgLRi, .kok32b, .Ao4Ooo, ._2aFisS, a[href*="order_details"]', { timeout: 10000 });
            } catch (e) {
                log.warn('[Orders] Timeout waiting for specific list selectors.');
            }

            // Scrape - flexible approach
            orders = await page.evaluate(() => {
                const results: any[] = [];

                // Strategy: Find all potential "cards"
                // Class .ZcgLRi seems to be a wrapper for Minutes items.
                // Standard items use anchors.
                const cards = Array.from(document.querySelectorAll('.ZcgLRi, .kok32b, ._2aFisS, a[href*="order_details"]'));

                const processed = new Set();

                cards.forEach(card => {
                    const cardEl = card as HTMLElement;
                    // Deduplicate
                    if (processed.has(cardEl)) return;
                    processed.add(cardEl);

                    // Try to find href
                    let href = '';
                    if (cardEl.tagName === 'A') {
                        href = cardEl.getAttribute('href') || '';
                    } else {
                        const parentA = cardEl.closest('a');
                        if (parentA) {
                            href = parentA.getAttribute('href') || '';
                        } else {
                            // Fallback: Look for ANY anchor inside the card
                            const childA = cardEl.querySelector('a');
                            if (childA) href = childA.getAttribute('href') || '';
                        }
                    }

                    // Normalize URL immediately - use window.location.origin since we're in browser context
                    const fullUrl = href && href !== '' ? (href.startsWith('/') ? `${window.location.origin}${href}` : href) : '';

                    // Extract ID
                    let orderId = '';
                    if (fullUrl) {
                        try {
                            const urlObj = new URL(fullUrl);
                            orderId = urlObj.searchParams.get('order_id') || '';
                        } catch (e) {
                            // href might be relative in some weird parsing cases, but usually standardized above
                            if (href.includes('order_id=')) {
                                orderId = href.split('order_id=')[1]?.split('&')[0] || '';
                            }
                        }
                    }

                    // If no ID from href, check text (fallback)
                    if (!orderId) {
                        const idMatch = cardEl.innerText.match(/OD\d{16,}/);
                        if (idMatch) orderId = idMatch[0];
                    }

                    // Scrape details text
                    const textLines = cardEl.innerText.split('\n').filter(s => s.trim());

                    let price = '';
                    let name = '';
                    let status = '';
                    let otp = '';

                    const priceMatch = textLines.find(s => s.includes('₹'));
                    if (priceMatch) price = priceMatch;

                    const statusMatch = textLines.find(s => /(Delivered|Cancelled|Returned|Shipped|Out for delivery)/i.test(s));
                    if (statusMatch) status = statusMatch;

                    // OTP in list view?
                    const otpMatch = cardEl.innerText.match(/OTP\s*[:\-]?\s*(\d{4,6})/i);
                    if (otpMatch) otp = otpMatch[1];

                    const nameCandidates = textLines.filter(s => s !== price && s !== status && !s.includes('Exchange') && !s.includes('more items'));
                    if (nameCandidates.length > 0) name = nameCandidates[0];

                    // Fallback selectors relative to card
                    const explicitName = cardEl.querySelector('.KzDlHZ, ._213eRC, div[class*="product-name"]');
                    if (explicitName) name = explicitName.textContent?.trim() || name;

                    // If still no ID, generate one so we don't lose the item
                    // (Common for Grocery/Minutes items that might not have a link exposed simply)
                    if (!orderId) {
                        // Create a simple hash from name + price + status to be somewhat consistent
                        const safeName = (name || 'Order').replace(/[^a-z0-9]/gi, '_');
                        const safePrice = price.replace(/[^0-9]/g, '');
                        // If we have nothing, skip
                        if (safeName === 'Order' && !safePrice) return;

                        orderId = `gen_${safeName}_${safePrice}_${status}`;
                    }

                    if (orderId) {
                        // Avoid duplicate pushes for same ID in this run
                        if (results.find(r => r.orderId === orderId)) return;

                        results.push({
                            orderId: orderId,
                            productName: name || 'Unknown Product',
                            price: price,
                            status: status || 'Ordered',
                            deliveryDate: '',
                            imageUrl: cardEl.querySelector('img')?.src || '',
                            orderUrl: fullUrl || 'https://www.flipkart.com/account/orders',
                            otp: otp,
                        });
                    }
                });

                return results.slice(0, 20); // Get last 20
            });
        }

        log.info(`[Orders] List scraping done. Found ${orders.length} items. Starting deep scrape...`);

        for (let i = 0; i < orders.length; i++) {
            const order = orders[i];

            // Artificial delay between processing orders
            if (i > 0) await humanDelay(page, 2000, 5000);

            // Case 1: We have a valid URL (Standard Orders)
            if (order.orderUrl && !order.orderUrl.includes('account/orders') && !order.orderId.startsWith('gen_')) {
                try {
                    log.info(`[Orders] Deep scraping URL order ${i + 1}/${orders.length}: ${order.orderId}`);
                    await page.goto(order.orderUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await scrapeDetails(page, order, log);
                } catch (e: any) {
                    log.warn(`[Orders] Failed to deep scrape URL ${order.orderId}: ${e.message}`);
                }
            }
            // Case 2: We need to CLICK (Minutes/Grocery with 'gen_' ID or no URL)
            else if (order.orderId.startsWith('gen_') || !order.orderUrl || order.orderUrl.includes('account/orders')) {
                try {
                    log.info(`[Orders] Deep scraping CLICK order ${i + 1}/${orders.length}: ${order.productName}`);

                    // We must go to the list page fresh to ensure index alignment
                    await page.goto(`${baseDomain}/account/orders`, { waitUntil: 'domcontentloaded' });
                    await page.waitForTimeout(2000);

                    // Re-select all cards using the SAME strategy as scraping to match indices
                    // Note: current scraping uses logic to dedup. We need to reproduce that selector logic purely?
                    // Or effectively just query the same broad selectors and hope order is preserved (it usually is).
                    const cards = await page.$$('.ZcgLRi, .kok32b, ._2aFisS, a[href*="order_details"]');

                    // BUT, our scraped list might be deduplicated (20 max). 
                    // The 'index' from the scrape would be best, but we didn't save it. 
                    // Let's assume the scraped order 'i' corresponds to the 'i-th' *valid* card? 
                    // Actually, the scrape logic used 'results.push' inside a forEach with dedup.
                    // Order should be preserved if we just iterate the same DOM elements.
                    // Ideally we pass 'data-index' or something? 
                    // Let's try matching text content if index is risky?
                    // Or just click the i-th element if we assume 1:1?
                    // Wait, 'processed' set in evaluate might skip some DOM nodes.
                    // Better to find by text match? "4 more items" etc.

                    let cardToClick = null;

                    // Strategy: Find card with matching price/name text
                    const targets = await page.$$('.ZcgLRi, .kok32b, ._2aFisS, a[href*="order_details"]');
                    for (const target of targets) {
                        const tText = await target.innerText();
                        // Simple heuristic: match price and partial name
                        if (tText.includes(order.price) && (tText.includes(order.productName) || order.productName === 'Unknown Product' || order.productName.includes('More Items'))) {
                            cardToClick = target;
                            break;
                        }
                    }

                    if (cardToClick) {
                        await cardToClick.click();
                        await page.waitForTimeout(3000); // Wait for nav
                        // Check if we moved?
                        if (page.url().includes('order_details')) {
                            await scrapeDetails(page, order, log);
                        } else {
                            log.warn(`[Orders] Clicked but didn't navigate for ${order.orderId}`);
                        }
                    } else {
                        log.warn(`[Orders] Could not find card to click for ${order.orderId}`);
                    }

                } catch (e: any) {
                    log.warn(`[Orders] Failed to click-scrape ${order.orderId}: ${e.message}`);
                }
            }
        }


        if (orders.length > 0) {
            // Update Account
            await upsertAccount({
                id: accountId,
                platform: platform,
                orders: orders
            });
        }

        return { success: true, count: orders.length, orders };

    } catch (e: any) {
        log.error(`[Orders] Fetch failed: ${e.message}`);
        return { success: false, error: e.message };
    } finally {
        if (context) await context.close();
        if (browser) await browser.close();
    }
}

// Helper to scrape details from the current page (Details View)
async function scrapeDetails(page: any, order: any, log: any) {
    // Initial wait for page settle
    await humanDelay(page, 1000, 2000);

    const details = await page.evaluate(() => {
        const text = document.body.innerText;
        const result: any = {};

        // 1. Order ID (Real)
        // ... (unchanged)
        const idLabel = Array.from(document.querySelectorAll('div, span, p')).find(el => el.textContent?.trim() === 'Order Id' || el.textContent?.trim() === 'Order ID');
        if (idLabel) {
            const val = idLabel.nextElementSibling?.textContent?.trim() || idLabel.parentElement?.textContent?.replace(/Order I[Dd]/, '').trim();
            if (val) result.orderId = val;
        }

        // 2. OTP - Enhanced for "Open box delivery"
        let otpMatch = text.match(/OTP\s*[:\-]?\s*(\d{4,6})/i);
        if (!otpMatch) {
            // Look for "Open box delivery" context
            const obd = Array.from(document.querySelectorAll('div, span, p')).find(el =>
                el.textContent?.toLowerCase().includes('open box delivery')
            );
            if (obd) {
                // Usually the OTP is near this text or in the same container
                const container = obd.closest('div[class*="row"]') || obd.parentElement;
                if (container) {
                    const cText = (container as HTMLElement).innerText;
                    otpMatch = cText.match(/(\d{4,6})/); // Just digits if strictly inside OBD container
                }
            }
        }
        if (otpMatch) result.otp = otpMatch[1];

        // 3. Receiver Name ... (unchanged)
        const deliveryHeader = Array.from(document.querySelectorAll('div, span, h3')).find(el => el.textContent?.trim().toLowerCase() === 'delivery details');
        if (deliveryHeader) {
            const container = deliveryHeader.closest('div[class*="row"]')?.parentElement || deliveryHeader.parentElement?.parentElement;
            if (container) {
                const texts = (container as HTMLElement).innerText.split('\n').map(l => l.trim()).filter(l => l && l.toLowerCase() !== 'delivery details');
                if (texts.length > 0) {
                    const nameLine = texts[0];
                    const phoneMatch = nameLine.match(/\d{10}$/);
                    if (phoneMatch) {
                        result.receiverName = nameLine.replace(phoneMatch[0], '').trim();
                    } else {
                        result.receiverName = nameLine;
                    }
                }
            }
        }

        // 4. Tracking ID
        const trackEl = Array.from(document.querySelectorAll('*')).find(el =>
            el.textContent && (el.textContent.includes('Tracking ID') || el.textContent.startsWith('FMPC') || el.textContent.startsWith('FMPP'))
        );
        if (trackEl) {
            const text = trackEl.textContent || '';
            const match = text.match(/(FMPC|FMPP)[a-zA-Z0-9]+/);
            if (match) result.trackingId = match[0];
        }

        // 5. Delivery Details - Full timeline text capture
        const deliveryEl = document.querySelector('._2U7eD9, ._2sKzGF, ._30jeq3');
        // Capture everything relevant for parsing
        result.deliveryDetails = document.body.innerText; // Fallback to full text for robust parsing if specific selector fails

        if (deliveryEl) {
            // If we found a specific status element, prioritize it but keep full context
            // Actually, let's stick to full text parsing in frontend which is more robust
            // matching the screenshot "Seller is processing..." etc.
        }

        return result;
    });

    // 5. CLICK "See All Updates" for detailed timeline
    try {
        const seeUpdatesBtn = await page.$('div:has-text("See All Updates"), span:has-text("See All Updates"), a:has-text("See All Updates")');
        if (seeUpdatesBtn) {
            if (log) log.info(`[Orders] Clicking 'See All Updates' for ${order.orderId}...`);
            await seeUpdatesBtn.click();
            await page.waitForTimeout(1500);

            const timelineText = await page.evaluate(() => {
                const modals = Array.from(document.querySelectorAll('div[role="dialog"], ._3MAXQU, ._10YZ-w'));
                const modal = modals.find(m => (m as HTMLElement).innerText.includes('Order Confirmed') || (m as HTMLElement).innerText.includes('Shipped'));

                if (modal) {
                    const lines = (modal as HTMLElement).innerText.split('\n').filter((line: string) =>
                        line.trim().length > 0 &&
                        !line.includes('See All Updates') &&
                        !line.includes('Cancel')
                    );
                    return lines.slice(0, 10).join(' | ');
                }
                return '';
            });

            if (timelineText && details.deliveryDetails) {
                details.deliveryDetails += ` [Updates: ${timelineText}]`;
            } else if (timelineText) {
                details.deliveryDetails = `Updates: ${timelineText}`;
            }
        }
    } catch (e: any) {
        if (log) log.warn(`[Orders] Failed to click 'See All Updates': ${e.message}`);
    }

    if (details.orderId) order.orderId = details.orderId;
    if (details.otp) order.otp = details.otp;
    if (details.receiverName) order.receiverName = details.receiverName;
    if (details.trackingId) order.trackingId = details.trackingId;
    if (details.deliveryDetails) order.deliveryDetails = details.deliveryDetails;
}
