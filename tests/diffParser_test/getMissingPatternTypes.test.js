const { getMissingPatternTypes } = require("../../src/services/diffParser");

test("getMissingPatternTypes returns no missing patterns for supported JavaScript", () => {
    expect(getMissingPatternTypes("js", false)).toEqual([]);
});

test("getMissingPatternTypes reports unsupported production-file checks", () => {
    expect(getMissingPatternTypes("txt", false)).toEqual([
        "functions",
        "imports",
    ]);
});

test("getMissingPatternTypes includes test checks for unsupported test files", () => {
    expect(getMissingPatternTypes("txt", true)).toEqual([
        "functions",
        "imports",
        "tests",
    ]);
});
