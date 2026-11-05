const jwt = require("jsonwebtoken");

/**
 * Authentication Middleware
 * Validates JWT bearer token and injects authenticated user payload into req.user
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    return res.status(401).json({ error: "Access token required. Please log in." });
  }

  const secret = process.env.JWT_SECRET || "electrohub_default_secret_dev_key";

  jwt.verify(token, secret, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired access token." });
    }
    req.user = decodedUser;
    next();
  });
}

module.exports = {
  authenticateToken
};
