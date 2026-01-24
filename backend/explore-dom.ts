/**
 * DOM Exploration Script for Flipkart/Shopsy
 * This script navigates to order pages and GV balance page using saved cookies
 * and exports the DOM structure for building robust selectors.
 * 
 * Run: npx tsx explore-dom.ts <accountId> <platform>
 */

import { chromium, BrowserContext } from 'playwright';
import path from 'path';
import fs from 'fs-extra';
import { loadCookiesFromDB } from './src/cookies.js';
import { PROFILES_DIR } from './src/config.js';
import { generateFingerprint } from './src/fingerprint.js';

async function exploreDom(accountId: string, platform: 'flipkart' | 'shopsy') {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`DOM EXPLORATION for ${accountId} on ${platform}`);
    console.log(`${'='.repeat(60)}\n`);

    const normalizedId = accountId.toLowerCase().trim();
    const fingerprint = generateFingerprint(platform, accountId);

    // Load cookies
    const cookies = await loadCookiesFromDB(accountId, platform);
    if (cookies.length === 0) {
        console.error('❌ No saved cookies found. Please log in first via the UI.');
        return;
    }
    console.log(`✅ Loaded ${cookies.length} cookies for ${accountId}`);

    // Find browser
    const browsersPath = path.resolve(import.meta.dirname, 'browsers');
    const chromiumDir = fs.readdirSync(browsersPath).find(d => d.startsWith('chromium-'));
    if (!chromiumDir) {
        console.error(`❌ Chromium not found in ${browsersPath}`);
        return;
    }

    let execPath = '';
    if (process.platform === 'darwin') {
        execPath = path.join(browsersPath, chromiumDir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
    } else if (process.platform === 'win32') {
        execPath = path.join(browsersPath, chromiumDir, 'chrome-win64/chrome.exe');
    } else {
        execPath = path.join(browsersPath, chromiumDir, 'chrome-linux/chrome');
    }

    const browser = await chromium.launch({
        headless: false, // Keep visible for exploration
        executablePath: execPath,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });

    const context = await browser.newContext({
        userAgent: fingerprint.userAgent,
        locale: fingerprint.locale,
        timezoneId: fingerprint.timezoneId,
        viewport: { width: 1400, height: 900 }
    });

    await context.addCookies(cookies);

    try {
        // ============================================
        // 1. ORDERS PAGE
        // ============================================
        console.log('\n📦 EXPLORING ORDERS PAGE...\n');
        const ordersPage = await context.newPage();
        await ordersPage.goto('https://www.flipkart.com/account/orders', { waitUntil: 'networkidle', timeout: 60000 });
        await ordersPage.waitForTimeout(3000);

        const ordersUrl = ordersPage.url();
        console.log(`Current URL: ${ordersUrl}`);

        if (ordersUrl.includes('/login')) {
            console.error('❌ Redirected to login - cookies may be expired');
            await browser.close();
            return;
        }

        // Capture DOM structure
        const ordersDOM = await ordersPage.evaluate(() => {
            const results: any = {
                pageTitle: document.title,
                url: window.location.href,
                orderCards: [],
                selectors: {}
            };

            // Find order containers - look for common patterns
            const potentialContainers = [
                '.ZcgLRi', '.kok32b', '._2aFisS', '.order-card',
                'a[href*="order_details"]', 'div[data-id]'
            ];

            let orderElements: Element[] = [];
            for (const sel of potentialContainers) {
                const elements = document.querySelectorAll(sel);
                if (elements.length > 0) {
                    results.selectors.orderContainer = sel;
                    orderElements = Array.from(elements);
                    break;
                }
            }

            // Analyze first 3 order cards
            orderElements.slice(0, 3).forEach((card, idx) => {
                const cardInfo: any = {
                    index: idx,
                    tagName: card.tagName,
                    className: card.className,
                    innerHTML: (card as HTMLElement).innerHTML.substring(0, 2000),
                    innerText: (card as HTMLElement).innerText.substring(0, 500),
                    href: card.getAttribute('href') || '',
                    childElements: []
                };

                // List all unique child class names
                const childClasses = new Set<string>();
                card.querySelectorAll('*').forEach(el => {
                    if (el.className && typeof el.className === 'string') {
                        el.className.split(' ').forEach(c => {
                            if (c.trim()) childClasses.add(c.trim());
                        });
                    }
                });
                cardInfo.childClasses = Array.from(childClasses).slice(0, 30);

                results.orderCards.push(cardInfo);
            });

            // Try to find specific data fields
            const bodyText = document.body.innerText;

            // Order ID pattern
            const orderIdMatch = bodyText.match(/OD\d{16,}/);
            if (orderIdMatch) results.selectors.orderIdPattern = orderIdMatch[0];

            // Price pattern
            const priceMatch = bodyText.match(/₹[\d,]+/);
            if (priceMatch) results.selectors.pricePattern = priceMatch[0];

            // Status patterns
            const statusPatterns = ['Delivered', 'Shipped', 'Out for delivery', 'Cancelled', 'Returned', 'Processing'];
            results.selectors.statusPatterns = statusPatterns.filter(s => bodyText.includes(s));

            // OTP pattern
            const otpMatch = bodyText.match(/OTP\s*[:\-]?\s*(\d{4,6})/i);
            if (otpMatch) results.selectors.otpPattern = `OTP: ${otpMatch[1]}`;

            // Find all unique class names that might be useful
            const allClasses = new Set<string>();
            document.querySelectorAll('*').forEach(el => {
                if (el.className && typeof el.className === 'string') {
                    el.className.split(' ').forEach(c => {
                        if (c.trim() && c.includes('_')) allClasses.add(c.trim());
                    });
                }
            });
            results.topLevelClasses = Array.from(allClasses).slice(0, 50);

            return results;
        });

        console.log('\n📋 ORDERS PAGE STRUCTURE:');
        console.log(JSON.stringify(ordersDOM, null, 2));

        // Save to file
        const ordersOutputPath = path.join(import.meta.dirname, 'data', 'dom_orders.json');
        await fs.ensureDir(path.dirname(ordersOutputPath));
        await fs.writeJson(ordersOutputPath, ordersDOM, { spaces: 2 });
        console.log(`\n✅ Saved orders DOM to: ${ordersOutputPath}`);

        // Take screenshot
        const ordersScreenshot = path.join(import.meta.dirname, 'data', 'screenshot_orders.png');
        await ordersPage.screenshot({ path: ordersScreenshot, fullPage: false });
        console.log(`✅ Screenshot saved to: ${ordersScreenshot}`);

        // ============================================
        // 2. GV BALANCE PAGE
        // ============================================
        console.log('\n\n💳 EXPLORING GV BALANCE PAGE...\n');
        const gvPage = await context.newPage();
        await gvPage.goto('https://www.flipkart.com/account/giftcard?type=active', { waitUntil: 'networkidle', timeout: 60000 });
        await gvPage.waitForTimeout(3000);

        const gvUrl = gvPage.url();
        console.log(`Current URL: ${gvUrl}`);

        const gvDOM = await gvPage.evaluate(() => {
            const results: any = {
                pageTitle: document.title,
                url: window.location.href,
                bodyText: document.body.innerText.substring(0, 2000),
                selectors: {}
            };

            // Look for balance text
            const balanceMatch = document.body.innerText.match(/Balance\s*[:\-]?\s*(₹[\d,]+)/i);
            if (balanceMatch) {
                results.selectors.balancePattern = balanceMatch[0];
                results.balance = balanceMatch[1];
            }

            // Total balance patterns  
            const totalMatch = document.body.innerText.match(/Total\s*(Available\s*)?Balance\s*[:\-]?\s*(₹[\d,]+)/i);
            if (totalMatch) {
                results.selectors.totalBalancePattern = totalMatch[0];
            }

            // Find elements containing balance
            const potentialBalanceSelectors = ['._30jeq3', '._3pLy-c', '.balance', '[class*="balance"]'];
            for (const sel of potentialBalanceSelectors) {
                const el = document.querySelector(sel);
                if (el && el.textContent?.includes('₹')) {
                    results.selectors.balanceElement = sel;
                    results.selectors.balanceText = el.textContent?.trim();
                    break;
                }
            }

            // List all classes
            const allClasses = new Set<string>();
            document.querySelectorAll('*').forEach(el => {
                if (el.className && typeof el.className === 'string') {
                    el.className.split(' ').forEach(c => {
                        if (c.trim() && c.includes('_')) allClasses.add(c.trim());
                    });
                }
            });
            results.topLevelClasses = Array.from(allClasses).slice(0, 50);

            return results;
        });

        console.log('\n📋 GV BALANCE PAGE STRUCTURE:');
        console.log(JSON.stringify(gvDOM, null, 2));

        // Save to file
        const gvOutputPath = path.join(import.meta.dirname, 'data', 'dom_gvbalance.json');
        await fs.writeJson(gvOutputPath, gvDOM, { spaces: 2 });
        console.log(`\n✅ Saved GV DOM to: ${gvOutputPath}`);

        // Take screenshot
        const gvScreenshot = path.join(import.meta.dirname, 'data', 'screenshot_gvbalance.png');
        await gvPage.screenshot({ path: gvScreenshot, fullPage: false });
        console.log(`✅ Screenshot saved to: ${gvScreenshot}`);

        // ============================================
        // 3. SINGLE ORDER DETAILS PAGE (if we found an order)
        // ============================================
        if (ordersDOM.orderCards.length > 0 && ordersDOM.orderCards[0].href) {
            console.log('\n\n📄 EXPLORING ORDER DETAILS PAGE...\n');

            let detailsUrl = ordersDOM.orderCards[0].href;
            if (detailsUrl.startsWith('/')) {
                detailsUrl = `https://www.flipkart.com${detailsUrl}`;
            }

            await ordersPage.goto(detailsUrl, { waitUntil: 'networkidle', timeout: 60000 });
            await ordersPage.waitForTimeout(3000);

            const detailsDOM = await ordersPage.evaluate(() => {
                const results: any = {
                    pageTitle: document.title,
                    url: window.location.href,
                    bodyTextSample: document.body.innerText.substring(0, 3000),
                    fields: {}
                };

                const text = document.body.innerText;

                // Extract specific fields
                const patterns: Record<string, RegExp> = {
                    orderId: /OD\d{16,}/,
                    otp: /OTP\s*[:\-]?\s*(\d{4,6})/i,
                    trackingId: /(FMPC|FMPP)[A-Z0-9]+/i,
                    price: /₹[\d,]+/,
                    status: /(Delivered|Shipped|Out for delivery|Cancelled|Returned|Processing)/i,
                    deliveryDate: /(Delivered on|Expected by|Arriving)\s*[:\-]?\s*([^|]+)/i
                };

                for (const [key, pattern] of Object.entries(patterns)) {
                    const match = text.match(pattern);
                    if (match) results.fields[key] = match[0];
                }

                // Find delivery address section
                const addressHeader = Array.from(document.querySelectorAll('*')).find(
                    el => el.textContent?.trim().toLowerCase() === 'delivery address' ||
                        el.textContent?.trim().toLowerCase() === 'delivery details'
                );
                if (addressHeader) {
                    const container = addressHeader.closest('div')?.parentElement;
                    if (container) {
                        results.fields.addressSection = (container as HTMLElement).innerText.substring(0, 500);
                    }
                }

                // Look for "See All Updates" button
                const seeUpdatesBtn = Array.from(document.querySelectorAll('span, div, button')).find(
                    el => el.textContent?.includes('See All Updates')
                );
                results.hasSeeAllUpdates = !!seeUpdatesBtn;

                return results;
            });

            console.log('\n📋 ORDER DETAILS PAGE STRUCTURE:');
            console.log(JSON.stringify(detailsDOM, null, 2));

            // Save to file
            const detailsOutputPath = path.join(import.meta.dirname, 'data', 'dom_order_details.json');
            await fs.writeJson(detailsOutputPath, detailsDOM, { spaces: 2 });
            console.log(`\n✅ Saved details DOM to: ${detailsOutputPath}`);

            // Take screenshot
            const detailsScreenshot = path.join(import.meta.dirname, 'data', 'screenshot_order_details.png');
            await ordersPage.screenshot({ path: detailsScreenshot, fullPage: true });
            console.log(`✅ Screenshot saved to: ${detailsScreenshot}`);
        }

        console.log('\n\n' + '='.repeat(60));
        console.log('✅ DOM EXPLORATION COMPLETE');
        console.log('='.repeat(60));
        console.log('\nOutput files saved to backend/data/');
        console.log('Press Ctrl+C to close browser and exit...');

        // Keep browser open for manual inspection
        await new Promise(() => { }); // Never resolves - keep open

    } catch (error: any) {
        console.error('❌ Error exploring DOM:', error.message);
        await browser.close();
    }
}

// Get account ID from command line args
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: npx tsx explore-dom.ts <accountId> <platform>');
    console.log('Example: npx tsx explore-dom.ts 9876543210 flipkart');
    console.log('\nTo find account IDs, check backend/data/accounts.json');
    process.exit(1);
}

const accountId = args[0];
const platform = args[1] as 'flipkart' | 'shopsy';

exploreDom(accountId, platform);
