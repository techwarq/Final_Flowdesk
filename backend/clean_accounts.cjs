const fs = require('fs');
const path = require('path');

const accountsPath = path.join(__dirname, 'data/accounts.json');

try {
    const data = fs.readFileSync(accountsPath, 'utf8');
    const db = JSON.parse(data);
    let modified = false;

    db.accounts = db.accounts.map(acc => {
        let accModified = false;
        // Check all fields for massive text
        for (const [key, value] of Object.entries(acc)) {
            if (typeof value === 'string' && value.length > 500) {
                console.log(`Found huge text in account [${acc.id}] field [${key}]. Length: ${value.length}`);
                // If it's the identifier or id, we probably want to revert to a safe default if possible, or just truncate
                // But if it's 'hophatap@nemomo.org', we know the ID.
                
                // Truncate to 50 chars as a safety measure
                acc[key] = value.substring(0, 50) + '...FIXED';
                accModified = true;
                modified = true;
            }
        }
        return acc;
    });

    if (modified) {
        fs.writeFileSync(accountsPath, JSON.stringify(db, null, 2));
        console.log('Successfully cleaned accounts.json');
    } else {
        console.log('No corrupted fields found.');
    }

} catch (e) {
    console.error('Error cleaning accounts:', e);
}
