module.exports = (req, res) => {
  res.clearCookie('gh_token', { httpOnly: true, signed: true });
  res.redirect('/dashboard.html');
};