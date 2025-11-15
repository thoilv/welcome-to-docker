/**
 * Simple services module for a Node.js app
 * File: src/sevices.js
 *
 * Exports:
 *  - initServices(config) -> returns an object with service methods
 *
 * Usage:
 *  const services = require('./sevices').initServices();
 *  await services.getWelcomeMessage();
 */

const DEFAULT_CONFIG = {
    apiUrl: process.env.WELCOME_API_URL || 'https://api.example.com/welcome',
    timeoutMs: Number(process.env.SERVICE_TIMEOUT_MS) || 5_000,
    cacheTtlMs: Number(process.env.CACHE_TTL_MS) || 30_000,
};

function initServices(config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    let cache = { value: null, expiresAt: 0 };

    async function fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), cfg.timeoutMs);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            if (!res.ok) {
                const txt = await res.text().catch(() => '');
                throw new Error(`HTTP ${res.status}: ${txt}`);
            }
            return res.json().catch(() => ({}));
        } finally {
            clearTimeout(id);
        }
    }

    async function getWelcomeMessage(force = false) {
        const now = Date.now();
        if (!force && cache.value && cache.expiresAt > now) {
            return cache.value;
        }

        const data = await fetchWithTimeout(cfg.apiUrl);
        const message = (data && data.message) || 'Welcome';
        cache = { value: message, expiresAt: now + cfg.cacheTtlMs };
        return message;
    }

    async function healthCheck() {
        try {
            // lightweight check: HEAD or GET with short timeout
            const res = await fetchWithTimeout(cfg.apiUrl, { method: 'HEAD' });
            // if fetchWithTimeout didn't throw, consider healthy
            return { ok: true, info: 'up', endpoint: cfg.apiUrl };
        } catch (err) {
            return { ok: false, info: err.message || 'unreachable', endpoint: cfg.apiUrl };
        }
    }

    function clearCache() {
        cache = { value: null, expiresAt: 0 };
    }

    return {
        config: cfg,
        getWelcomeMessage,
        healthCheck,
        clearCache,
    };
}

module.exports = { initServices };