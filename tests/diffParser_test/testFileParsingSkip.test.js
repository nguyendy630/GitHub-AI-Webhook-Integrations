const diffParser = require("../../src/services/diffParser");
const logger = require("../../src/utils/logger");

describe("analyzeDiff skips function/import parsing for test files", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("does not report new functions or imports for a JS test file, even when the content matches", () => {
        jest.spyOn(logger, "info").mockImplementation(() => {});
        jest.spyOn(logger, "warn").mockImplementation(() => {});

        const patch = `@@ -0,0 +1,3 @@
+import { greet } from '../src/greet';
+function helper() {
+describe('greet', () => {
`;

        const analysis = diffParser.analyzeDiff(patch, "src/greet.test.js");

        expect(analysis.isTestFile).toBe(true);
        expect(analysis.hasNewFunctions).toBe(false);
        expect(analysis.functionChanges).toEqual({
            hasNewFunctions: false,
            newFunctions: [],
            lineNumbers: [],
            language: "js",
        });
        expect(analysis.hasImportChanges).toBe(false);
        expect(analysis.hasTestChanges).toBe(true);
    });

    test("still parses functions and imports for non-test files with the same content", () => {
        jest.spyOn(logger, "info").mockImplementation(() => {});
        jest.spyOn(logger, "warn").mockImplementation(() => {});

        const patch = `@@ -0,0 +1,2 @@
+import { greet } from '../src/greet';
+function helper() {
`;

        const analysis = diffParser.analyzeDiff(patch, "src/greet.js");

        expect(analysis.isTestFile).toBe(false);
        expect(analysis.hasNewFunctions).toBe(true);
        expect(analysis.hasImportChanges).toBe(true);
    });
});
