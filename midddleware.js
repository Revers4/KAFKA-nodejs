const jwt = require("jsonwebtoken");
const ACCESS_TOKEN_SECRET =
  "2i7NH76FhuhVYHHCLNbVZFymxqYS8uquuvmkrCmB5yxxSvujVjCXbK3i7NayQMKKp8cX92jvqKj6PbYzZRM7rRMyuPbdYznzDAkFDNerYbv7yE90JchfJ2vTvazdBECCJujub4LtkNUL8kuUf8uU6TjVtt3vKzyvgWBWJMdXmJ2YSFZnV195nicMRzBzYTMMMRzRPHAXNCLDWJxQ1GXjALN3FhBCWxReEzpvYQd3VKP8HAHbtNLpHk0rr2NwEEZ";

const authModdleware = async (req, res, next) => {
  const accessToken = req.cookies.access_token;

  if (!accessToken) {
    res.status(401).send("Unauthorized");
    return;
  }

  try {
    const payload = jwt.verify(accessToken, ACCESS_TOKEN_SECRET);
    res.locals.user = payload;
    next();
  } catch (error) {
    console.log(error);
    res.status(401).send("Unauthorized");
    return;
  }
};

module.exports = authModdleware;
