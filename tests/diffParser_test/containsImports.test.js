const { containsImports } = require('../../src/services/diffParser');
require('jest').test;

test('containsImports correctly identifies if a diff contains import statements', () => {
    const diffWithImports = `
        diff --git a/src/api/routes/userRoutes.ts b/src/api/routes/userRoutes.ts
        index a18d7f2..f8c4ab9 100644
        --- a/src/api/routes/userRoutes.ts
        +++ b/src/api/routes/userRoutes.ts
        @@ -4,6 +4,7 @@ import express from 'express';
        import { getUserProfile } from '../../services/userService';
        import { requireAuth } from '../middleware/requireAuth';
        import rateLimit from 'express-rate-limit';
        +import { validateBody } from '../middleware/validateBody';

        const router = express.Router();
    `;

    const diffWithoutImports = `
        diff --git a/file.txt b/file.txt
        index e69de29..4b825dc 100644
        --- a/file.txt
        +++ b/file.txt
        @@ -1,3 +0,0 @@
        -This is a line that was deleted.
        -This is another line that was deleted.
        -This line was also removed in the diff.
    `;

    expect(containsImports(diffWithImports, 'ts')).toBe(true);
    expect(containsImports(diffWithoutImports, 'txt')).toBe(false);
});