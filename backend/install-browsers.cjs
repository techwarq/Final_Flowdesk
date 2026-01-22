const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const browsersPath = path.resolve(__dirname, 'browsers');

// Ensure directory exists
if (!fs.existsSync(browsersPath)) {
    fs.mkdirSync(browsersPath, { recursive: true });
}

console.log(`Installing Playwright browsers to: ${browsersPath}`);

try {
    // Set the environment variable to force installation to our local directory
    process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;

    console.log('Running Playwright install for chromium...');
    // We only need chromium for this app
    execSync('npx playwright install chromium', {
        stdio: 'inherit',
        env: process.env,
        cwd: __dirname
    });

    // Antigravity Fix: Delete setup.exe if it exists, as it causes electron-builder signing issues
    try {
        // Find the chromium folder (it might vary by version so we search)
        const chromiumDir = fs.readdirSync(browsersPath).find(d => d.startsWith('chromium-'));
        if (chromiumDir) {
            const setupPath = path.join(browsersPath, chromiumDir, 'chrome-win64', 'setup.exe');
            if (fs.existsSync(setupPath)) {
                console.log(`Removing ${setupPath} to prevent build conflicts...`);
                fs.unlinkSync(setupPath);
            }
        }

        // Antigravity Fix: Remove chromium_headless_shell if present, we don't need it and it wastes space/path length
        const headlessDir = fs.readdirSync(browsersPath).find(d => d.startsWith('chromium_headless_shell-'));
        if (headlessDir) {
            const headlessPath = path.join(browsersPath, headlessDir);
            console.log(`Removing ${headlessPath} to save space...`);
            fs.rmSync(headlessPath, { recursive: true, force: true });
        }

    } catch (e) {
        console.warn('Failed to cleanup setup.exe or headless shell:', e);
    }

    console.log('Browser installation complete.');
} catch (error) {
    console.error('Failed to install browsers:', error);
    process.exit(1);
}
