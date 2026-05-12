const { detectLanguage } = require('../src/services/diffParser');
require('jest').test

test('detectLanguage correctly identifies the programming language based on the file extension', () => {

    const diff = `
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

        @@ -14,7 +15,17 @@ const profileLimiter = rateLimit({
        max: 30,
        });

        -router.get('/profile', requireAuth, async (req, res) => {
        +router.get(
        +  '/profile',
        +  requireAuth,
        +  async (req, res) => {
        +    const profile = await getUserProfile(req.user.id);
        +
        +    return res.json(profile);
        +  }
        +);
        +
        +router.post('/preferences', requireAuth, validateBody, async (req, res) => {
        +  // TODO: persist preferences in settings service
        const profile = await getUserProfile(req.user.id);

        return res.json(profile);
    `
    const language = detectLanguage(diff);
    expect(language).toBe('ts');
});
