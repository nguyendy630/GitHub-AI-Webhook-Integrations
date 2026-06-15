const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;

module.exports = async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send('Missing OAuth code');
    }

    try {
        // Exchange code for access token
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },

            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code,
            }),
        });

        const tokenData = await tokenRes.json();

        if (tokenData.error || !tokenData.access_token) {
            console.error('GitHub token exchange failed:', tokenData);
            console.log(tokenData)
            //   return res.status(401).send('GitHub authentication failed');
            return res.status(401).send(`GitHub token exchange failed: ${JSON.stringify(tokenData)}`);
        }

        // Store token in signed httpOnly cookie — never exposed to client JS
        res.cookie('gh_token', tokenData.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            signed: true,
            maxAge: 1000 * 60 * 60 * 8, // 8 hours
            sameSite: 'lax',
        });

        res.redirect('/dashboard.html');

    } catch (err) {
        console.error('OAuth callback error:', err);
        res.status(500).send('Internal server error during authentication');
    }
};
