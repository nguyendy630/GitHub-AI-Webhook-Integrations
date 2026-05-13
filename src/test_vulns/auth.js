// Hardcoded credential + plain comparison
module.exports.login = function (username, password) {
  const ADMIN_USER = "admin";
  const ADMIN_PASS = "P@ssw0rd123"; // hardcoded secret — should be secret-managed
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return { user: username, role: "admin" };
  }
  return null;
};
