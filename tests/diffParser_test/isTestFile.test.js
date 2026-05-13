const isTestFile = require('../../src/services/diffParser').isTestFile;
require('jest').test;

test.each([
    'example.test.js',
    'example.spec.js',
    'src/__tests__/calculator.js',
    'calculator_test.js',
    'calculator.test',
    'calculator.spec',
    'test_example.js',
    'test_example.py',
    'src/example.test.ts',
    'src/example_test.py',
])('isTestFile returns true for %s', (filename) => {
    expect(isTestFile(filename)).toBe(true);
});

test.each([
    'example.js',
    'src/example.js',
    'src/example.specification.js',
    'src/tests/example.js',
])('isTestFile returns false for %s', (filename) => {
    expect(isTestFile(filename)).toBe(false);
});