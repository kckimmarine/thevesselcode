'use strict';

const ROUTES = {
    'ship/pull': require('../_lib/handlers/syncShipPull'),
    'ship/push': require('../_lib/handlers/syncShipPush'),
    'hq/pull': require('../_lib/handlers/syncHqPull'),
    'hq/push': require('../_lib/handlers/syncHqPush'),
    'cloud/stats': require('../_lib/handlers/syncCloudStats'),
    'cloud/records': require('../_lib/handlers/syncCloudRecords'),
    'cloud/restore': require('../_lib/handlers/syncCloudRestore'),
};

function syncRouteKey(req) {
    const segments = req.query?.path;
    if (Array.isArray(segments) && segments.length) {
        return segments.map(s => String(s).trim()).filter(Boolean).join('/');
    }
    if (typeof segments === 'string' && segments.trim()) {
        return segments.trim();
    }
    const raw = String(req.url || '');
    const match = raw.match(/\/api\/sync\/([^?]+)/);
    if (match) {
        return decodeURIComponent(match[1]).replace(/\/+$/, '');
    }
    return '';
}

async function handler(req, res) {
    const key = syncRouteKey(req);
    const routeHandler = ROUTES[key];
    if (!routeHandler) {
        return res.status(404).json({
            error: 'NOT_FOUND',
            message: key ? `Unknown sync route: ${key}` : 'Sync path required (e.g. /api/sync/ship/pull).',
        });
    }
    return routeHandler(req, res);
}

module.exports = handler;
module.exports.config = {
    api: {
        bodyParser: false,
    },
};
