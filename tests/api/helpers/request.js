/**
 * Common request patterns and helpers for k6 tests
 */

import http from 'k6/http';
import { Trend, Rate, Counter } from 'k6/metrics';

const metrics = {};

function getOrCreateMetrics(service) {
    const prefix = service.replace(/-/g, '_');
    if (!metrics[service]) {
        metrics[service] = {
            duration: new Trend(`${prefix}_duration`, true),
            errors: new Rate(`${prefix}_errors`),
            requests: new Counter(`${prefix}_requests`),
        };
    }
    return metrics[service];
}

export function instrumentedGet(service, url, params = {}) {
    const m = getOrCreateMetrics(service);
    const start = Date.now();
    
    const res = http.get(url, params);
    
    const duration = Date.now() - start;
    m.duration.add(duration);
    m.errors.add(res.status >= 400 ? 1 : 0);
    m.requests.add(1);
    
    return res;
}

export function instrumentedPost(service, url, body, params = {}) {
    const m = getOrCreateMetrics(service);
    const start = Date.now();
    
    if (!params.headers) params.headers = {};
    if (!params.headers['Content-Type']) {
        params.headers['Content-Type'] = 'application/json';
    }
    
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const res = http.post(url, payload, params);
    
    const duration = Date.now() - start;
    m.duration.add(duration);
    m.errors.add(res.status >= 400 ? 1 : 0);
    m.requests.add(1);
    
    return res;
}

export function instrumentedPut(service, url, body, params = {}) {
    const m = getOrCreateMetrics(service);
    const start = Date.now();
    
    if (!params.headers) params.headers = {};
    if (!params.headers['Content-Type']) {
        params.headers['Content-Type'] = 'application/json';
    }
    
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const res = http.put(url, payload, params);
    
    const duration = Date.now() - start;
    m.duration.add(duration);
    m.errors.add(res.status >= 400 ? 1 : 0);
    m.requests.add(1);
    
    return res;
}

export function instrumentedDelete(service, url, params = {}) {
    const m = getOrCreateMetrics(service);
    const start = Date.now();
    
    const res = http.del(url, null, params);
    
    const duration = Date.now() - start;
    m.duration.add(duration);
    m.errors.add(res.status >= 400 ? 1 : 0);
    m.requests.add(1);
    
    return res;
}

export function parseJsonSafe(res) {
    try {
        return res.json();
    } catch (e) {
        return null;
    }
}

export function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

export default {
    instrumentedGet,
    instrumentedPost,
    instrumentedPut,
    instrumentedDelete,
    parseJsonSafe,
    randomElement,
};
