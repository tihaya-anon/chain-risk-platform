/**
 * Test data generators for various scenarios
 */

// Generate random hex string
export function randomHex(length) {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

// Generate random Ethereum address
export function randomAddress() {
    return '0x' + randomHex(40);
}

// Generate random transaction hash
export function randomTxHash() {
    return '0x' + randomHex(64);
}

// Generate batch of random addresses
export function randomAddressBatch(count) {
    const addresses = [];
    for (let i = 0; i < count; i++) {
        addresses.push(randomAddress());
    }
    return addresses;
}

// Generate alert rule test data
export function generateAlertRule(overrides = {}) {
    return {
        name: `Test Rule ${Date.now()}`,
        description: 'Auto-generated test rule',
        rule_type: 'risk_score',
        conditions: { threshold: 0.7 },
        severity: 'high',
        enabled: true,
        ...overrides,
    };
}

// Generate subscription test data
export function generateSubscription(userId, overrides = {}) {
    return {
        user_id: userId,
        channel_type: 'webhook',
        channel_config: {
            url: 'https://example.com/webhook',
        },
        enabled: true,
        ...overrides,
    };
}

// Generate risk score request
export function generateRiskScoreRequest(address, overrides = {}) {
    return {
        address: address,
        network: 'ethereum',
        include_factors: true,
        ...overrides,
    };
}

// Generate batch risk score request
export function generateBatchRiskRequest(addresses, overrides = {}) {
    return {
        addresses: addresses,
        network: 'ethereum',
        include_factors: false,
        ...overrides,
    };
}

// Generate tag request
export function generateAddTagRequest(tags, overrides = {}) {
    return {
        tags: Array.isArray(tags) ? tags : [tags],
        source: 'test',
        confidence: 1.0,
        ...overrides,
    };
}

// Generate login request
export function generateLoginRequest(overrides = {}) {
    return {
        username: 'admin',
        password: 'admin123',
        ...overrides,
    };
}

// Timestamp helpers
export function nowISO() {
    return new Date().toISOString();
}

export function hoursAgoISO(hours) {
    const d = new Date();
    d.setHours(d.getHours() - hours);
    return d.toISOString();
}

export function daysAgoISO(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
}

export default {
    randomHex,
    randomAddress,
    randomTxHash,
    randomAddressBatch,
    generateAlertRule,
    generateSubscription,
    generateRiskScoreRequest,
    generateBatchRiskRequest,
    generateAddTagRequest,
    generateLoginRequest,
    nowISO,
    hoursAgoISO,
    daysAgoISO,
};
