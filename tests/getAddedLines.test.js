const { getAddedLines } = require('../src/services/diffParser');
require('jest').test;

test('getAddedLines correctly identifies added lines in a diff', () => {
    const diff = `
diff --git a/file.txt b/file.txt
index e69de29..4b825dc 100644
--- a/file.txt
+++ b/file.txt
@@ -0,0 +1,3 @@
+This is a new line.
+This is another new line.
+This line was added in the diff.
`;

    const expectedAddedLines = [{
        lineNumber: 1,
        content: "This is a new line."
    }, {
        lineNumber: 2,
        content: "This is another new line."
    }, {
        lineNumber: 3,
        content: "This line was added in the diff."
    }]

    const addedLines = getAddedLines(diff);
    expect(addedLines).toEqual(expectedAddedLines);
});