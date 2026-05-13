const { hasTestChanges } = require('../../src/services/diffParser');

require('jest').test;

test('hasTestChanges detects test declarations in JS files', () => {
    const testLines = [
        { lineNumber: 1, content: "describe('sum', () => {" },
        { lineNumber: 2, content: "  it('adds numbers', () => {" },
    ];

    const nonTestLines = [
        { lineNumber: 1, content: 'const value = 42;' },
    ];

    expect(hasTestChanges(testLines, 'js')).toBe(true);
    expect(hasTestChanges(nonTestLines, 'js')).toBe(false);
});
