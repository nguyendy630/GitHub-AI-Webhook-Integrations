const diffParser = require("../../src/services/diffParser");
const logger = require("../../src/utils/logger");

describe("unsupported language warnings", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("analyzeDiff logs one contextual warning when parser support is limited", () => {
        jest.spyOn(logger, "info").mockImplementation(() => {});
        const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});

        const patch = `diff --git a/notes.txt b/notes.txt
index e69de29..4b825dc 100644
--- a/notes.txt
+++ b/notes.txt
@@ -0,0 +1,1 @@
+plain text
`;

        const analysis = diffParser.analyzeDiff(patch, "notes.txt");

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith("Limited diff parsing support", {
            filename: "notes.txt",
            language: "txt",
            missingPatterns: ["functions", "imports"],
        });
        expect(analysis).toEqual(expect.objectContaining({
            language: "txt",
            missingPatterns: ["functions", "imports"],
        }));
    });

    test("analyzeDiff includes test patterns when an unsupported test file is parsed", () => {
        jest.spyOn(logger, "info").mockImplementation(() => {});
        const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});

        const patch = `diff --git a/notes.test.txt b/notes.test.txt
index e69de29..4b825dc 100644
--- a/notes.test.txt
+++ b/notes.test.txt
@@ -0,0 +1,1 @@
+plain text
`;

        const analysis = diffParser.analyzeDiff(patch, "notes.test.txt");

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith("Limited diff parsing support", {
            filename: "notes.test.txt",
            language: "txt",
            missingPatterns: ["functions", "imports", "tests"],
        });
        expect(analysis).toEqual(expect.objectContaining({
            language: "txt",
            missingPatterns: ["functions", "imports", "tests"],
            hasTestChanges: false,
        }));
    });

    test("analyzeDiff detects language from the filename when the patch has no file header", () => {
        jest.spyOn(logger, "info").mockImplementation(() => {});
        const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});
        const patch = `@@ -0,0 +1,1 @@
+import logger from "./logger";
`;

        const analysis = diffParser.analyzeDiff(patch, "src/example.js");

        expect(analysis.language).toBe("js");
        expect(analysis.missingPatterns).toEqual([]);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    test("analyzeDiff returns a boolean and details for new functions", () => {
        jest.spyOn(logger, "info").mockImplementation(() => {});
        jest.spyOn(logger, "warn").mockImplementation(() => {});
        const patch = `@@ -0,0 +1,1 @@
+function greet(name) {
`;

        const analysis = diffParser.analyzeDiff(patch, "src/example.js");

        expect(analysis.hasNewFunctions).toBe(true);
        expect(analysis.functionChanges).toEqual({
            hasNewFunctions: true,
            newFunctions: ["function greet(name) {"],
            lineNumbers: [1],
            language: "js",
        });
    });
});
