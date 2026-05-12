const { getDeletedLines} = require('../src/services/diffParser');
require('jest').test;

test('getDeletedLines correctly identifies deleted lines in a diff', () => {
    const diff = `diff --git a/file.txt b/file.txt
index e69de29..4b825dc 100644
--- a/file.txt
+++ b/file.txt
@@ -1,3 +0,0 @@
-This is a line that was deleted.
-This is another line that was deleted.
-This line was also removed in the diff.
`;

    const expectedDeletedLines = [{
        lineNumber: 1,
        content: "This is a line that was deleted."
    }, {
        lineNumber: 2,
        content: "This is another line that was deleted."
    }, {
        lineNumber: 3,
        content: "This line was also removed in the diff."
    }]

    const deletedLines = getDeletedLines(diff);
    expect(deletedLines).toEqual(expectedDeletedLines);
})