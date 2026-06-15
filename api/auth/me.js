module.exports = async (req, res) => {
  const token = req.signedCookies?.gh_token;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!userRes.ok) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await userRes.json();

    res.json({
      login: user.login,
      avatar_url: user.avatar_url,
      name: user.name,
      // Token is passed back only for client-side GitHub API calls.
      // It never appears in localStorage or JS variables beyond the request.
      token,
    });
  } catch (err) {
    console.error('/api/me error:', err);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
};