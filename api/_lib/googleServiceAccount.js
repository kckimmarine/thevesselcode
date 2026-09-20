'use strict';

const { readFileSync, existsSync } = require('node:fs');

function loadServiceAccountCredentials() {
    const inline = String(
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON
            || process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON
            || '',
    ).trim();
    if (inline) {
        try {
            return JSON.parse(inline);
        } catch {
            return JSON.parse(Buffer.from(inline, 'base64').toString('utf8'));
        }
    }
    const credPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
    if (credPath && existsSync(credPath)) {
        return JSON.parse(readFileSync(credPath, 'utf8'));
    }
    return null;
}

async function getAccessToken(scopes) {
    const creds = loadServiceAccountCredentials();
    if (!creds) {
        const err = new Error('Google service account JSON not configured');
        err.code = 'GOOGLE_CREDENTIALS_MISSING';
        throw err;
    }
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({ credentials: creds, scopes });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse?.token;
    if (!token) {
        throw new Error('Failed to obtain Google access token');
    }
    return token;
}

module.exports = {
    loadServiceAccountCredentials,
    getAccessToken,
};
