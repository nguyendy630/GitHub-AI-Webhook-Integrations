const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;

module.exports = (req, res) => {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    scope: 'read:user repo',
    allow_signup: 'true',
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
};