const { containsNewFunctions } = require('../src/services/diffParser');

require('jest').test;

test('containsNewFunctions detects a new JS function and ignores control flow lines', () => {
    const addedLines = [
        { lineNumber: 2, content: 'if (isReady) {' },
        { lineNumber: 4, content: 'function greet(name) {' },
        { lineNumber: 5, content: '  return `Hello ${name}`;' },
    ];

    const result = containsNewFunctions(addedLines, 'js');

    expect(result).toEqual({
        hasNewFunctions: true,
        newFunctions: ['function greet(name) {'],
        lineNumbers: [4],
        language: 'js',
    });
});
