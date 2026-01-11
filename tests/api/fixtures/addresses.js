/**
 * Test addresses for API testing
 * Includes known addresses, edge cases, and invalid formats
 */

// Well-known exchange addresses (real, predictable behavior)
export const exchangeAddresses = {
    binanceHot: '0x28c6c06298d514db089934071355e5743bf21d60',
    binanceCold: '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8',
    coinbaseHot: '0x71660c4005ba85c37ccec55d0c4493e66fe775d3',
    krakenHot: '0x2910543af39aba0cd09dbb2d50200b3e800a63d2',
};

// Zero/null addresses
export const specialAddresses = {
    zero: '0x0000000000000000000000000000000000000000',
    dead: '0x000000000000000000000000000000000000dead',
    burn: '0xdead000000000000000000000000000000000000',
};

// Synthetic test addresses (predictable format)
export const testAddresses = {
    test1: '0x0000000000000000000000000000000000000001',
    test2: '0x0000000000000000000000000000000000000002',
    test3: '0x0000000000000000000000000000000000000003',
    test4: '0x0000000000000000000000000000000000000004',
    test5: '0x0000000000000000000000000000000000000005',
};

// Invalid address formats for error testing
export const invalidAddresses = {
    tooShort: '0x123',
    tooLong: '0x28c6c06298d514db089934071355e5743bf21d60abc',
    noPrefix: '28c6c06298d514db089934071355e5743bf21d60',
    badChars: '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
    empty: '',
    spaces: '0x28c6 06298d514db089934071355e5743bf21d60',
    upperCase: '0x28C6C06298D514DB089934071355E5743BF21D60', // valid but worth testing
};

// Default address for most tests
export const defaultTestAddress = exchangeAddresses.binanceHot;

// Pool of addresses for load testing (variety)
export const loadTestPool = [
    ...Object.values(testAddresses),
    exchangeAddresses.binanceHot,
    exchangeAddresses.coinbaseHot,
];

// Get random address from pool
export function getRandomAddress() {
    return loadTestPool[Math.floor(Math.random() * loadTestPool.length)];
}

// Get random valid address
export function getRandomValidAddress() {
    const all = [...Object.values(exchangeAddresses), ...Object.values(testAddresses)];
    return all[Math.floor(Math.random() * all.length)];
}

export default {
    exchangeAddresses,
    specialAddresses,
    testAddresses,
    invalidAddresses,
    defaultTestAddress,
    loadTestPool,
    getRandomAddress,
    getRandomValidAddress,
};
