const express = require("express");
const fs = require("node:fs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const authModdleware = require("./midddleware");
const fileMiddleware = require("./middleware/file");
const cors = require("cors");
const path = require("path");
const favoritesRouter = require("./routes/favorites");
const config = require("./config");
const pool = require("./db");

app.use(
  cors({
    credentials: true,
    origin: ["http://localhost:5500", "http://localhost:5173"],
  })
);
app.use(cookieParser());
app.use(express.json({ extended: true })); // use json as data format

app.use("/images", express.static(path.join(__dirname, "images")));

app.use(favoritesRouter);

app.post(
  "/api/upload",
  authModdleware,
  fileMiddleware.single("avatar"),
  async (req, res) => {
    try {
      if (req.file) {
        const userId = res.locals.user.userId;
        await pool.query("UPDATE users SET avatar_url =$1 WHERE id =$2", [
          req.file.path,
          userId,
        ]);
        res.json("http://localhost:3000/" + req.file.path);
        console.log(res.locals.user);
      }
    } catch (error) {
      console.json(error);
      res.status(500).json("Something went wrong");
      return;
    }
  }
);

// CREATE - add new anime

// https://vovaanime.com/anime/ (post /)

//name, year, description, poster, screenshot

app.put("/anime", async (req, res) => {
  try {
    const updatedAnime = req.body;
    const ExictingAnime = await pool.query(
      "UPDATE anime SET name =$1, poster =$2 WHERE id =$3",
      [updatedAnime.name, updatedAnime.poster, updatedAnime.id]
    );
    res.send("Thanks!");
  } catch (error) {
    console.log(error);
    res.status(500).send("Something went wrong");
    return;
  }
});

app.post("/anime", async (req, res) => {
  // add new anime
  try {
    const animeData = req.body;
    const ExictingAnime = await pool.query(
      "SELECT * FROM anime WHERE name = $1",
      [animeData.name]
    );
    if (ExictingAnime.rows.length > 0) {
      res.status(400).json("This anime has already been added!");
      return;
    }
    await pool.query(
      "INSERT INTO anime(name, year, description, poster, screenshot) VALUES($1,$2,$3,$4,$5)",
      [
        animeData.name,
        animeData.year,
        animeData.description,
        animeData.poster,
        animeData.screenshot,
      ]
    );
    res.json("Thanks bro");
  } catch (error) {
    console.json(error);
    res.status(500).json("Something went wrong");
    return;
  }
});

app.get("/anime", async function (req, res) {
  try {
    const alAnime = await pool.query("SELECT * FROM anime");
    res.send(alAnime.rows);
  } catch (error) {
    console.log(error);
    res.status(500).send("Something went wrong");
    return;
  }
});

app.delete("/anime", async (req, res) => {
  try {
    const animeData = req.body;
    const ExictingAnime = await pool.query(
      "SELECT * FROM anime WHERE name = $1 OR id =$2",
      [animeData.name, animeData.id]
    );
    if (ExictingAnime.rows.length > 0) {
      await pool.query("DELETE FROM anime WHERE name = $1 OR id =$2", [
        animeData.name,
        animeData.id,
      ]);
      res.send("You deleted anime!");
    } else {
      res.status(400).send("This anime does not exist!");
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Something went wrong");
    return;
  }
});

//Register
app.post("/registration", async (req, res) => {
  const accountData = req.body;
  const ExictingAccount = await pool.query(
    "SELECT * FROM users WHERE email = $1 OR login = $2",
    [accountData.email, accountData.login]
  );
  if (ExictingAccount.rows.length > 0) {
    res.status(400).send("This login or email has already been taken!");
    return;
  }
  const passwodRegEx = /^(?=.*[0-9])(?=.*[^!@#$%^&*])[a-zA-Z0-9]{6,26}$/;

  if (passwodRegEx.test(accountData.password) === false) {
    res
      .status(400)
      .send(
        "Password length must be between 6 to 26, must have at least one lowercase, one uppercase letters, one digit and no special characters."
      );
    // console.log(accountData);

    return;
  }
  if (accountData.login.length < 4 || accountData.login.length > 16) {
    res.status(400).send("Login length must be between 4 to 16.");
    return;
  }

  const hashedPassword = await bcrypt.hash(accountData.password, 10);

  await pool.query(
    "INSERT INTO users(email, login, password, avatar_url) VALUES($1,$2,$3,$4)",
    [
      accountData.email,
      accountData.login,
      hashedPassword,
      accountData.avatar_url,
    ]
  );
  res.send("Welcome to my server!");
});

app.put("/profile", authModdleware, async (req, res) => {
  try {
    const userId = res.locals.user.userId;
    updatedProfile = req.body;
    const ExictingLogin = await pool.query(
      "SELECT * FROM users WHERE login = $1",
      [updatedProfile.login]
    );
    if (ExictingLogin.rows.length > 0) {
      res.status(400).json("This login has already been taken!");
      return;
    } else {
      const profile = await pool.query(
        "UPDATE users SET login =$1 WHERE id =$2",
        [updatedProfile.login, userId]
      );
      res.json("Thanks");
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Something went wrong");
    return;
  }
});

app.post("/login", async (req, res) => {
  // Log in
  const accountData = req.body;

  const ExictingAccount = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [accountData.email]
  );
  if (ExictingAccount.rows.length == 0) {
    res.status(400).json("Sorry! Your username or password is incorrect!");
    return;
  }
  const arePasswordsame = await bcrypt.compare(
    accountData.password,
    ExictingAccount.rows[0].password
  );

  if (!arePasswordsame) {
    res.status(400).json("Sorry! Your username or password is incorrect!");
    return;
  }
  const accessToken = await jwt.sign(
    { userId: ExictingAccount.rows[0].id },
    config.ACCESS_TOKEN_SECRET,
    { expiresIn: "5s" }
  );
  const refreshToken = await jwt.sign(
    { userId: ExictingAccount.rows[0].id },
    config.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );
  res.cookie("access_token", accessToken, { maxAge: 10 * 60 * 1000 });
  res.cookie("refresh_token", refreshToken, {
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json("Welcome home, " + ExictingAccount.rows[0].login + "!");
  // window.location.reload();
  // res.json(ExictingAccount.rows[0].login);
});

app.post("/refresh-token", function (req, res) {
  const refreshToken = req.cookies.refresh_token;

  try {
    const payload = jwt.verify(refreshToken, config.REFRESH_TOKEN_SECRET);
    const newAccessToken = jwt.sign(
      { userId: payload.userId },
      config.ACCESS_TOKEN_SECRET,
      { expiresIn: "10m" }
    );
    const newRefreshToken = jwt.sign(
      { userId: payload.userId },
      config.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );
    res.cookie("access_token", newAccessToken, { maxAge: 10 * 60 * 1000 });
    res.cookie("refresh_token", newRefreshToken, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json("Tokens refreshed");
  } catch (error) {
    console.log(error);
    res.status(401).json("Unauthorized");
  }
});

app.get("/profile", authModdleware, async (req, res) => {
  const userId = res.locals.user.userId;
  const userProfile = await pool.query(
    "SELECT login, avatar_url FROM users WHERE id = $1",
    [userId]
  );
  const profile = userProfile.rows[0];
  profile.avatar_url = "http://localhost:3000/" + profile.avatar_url;
  res.json(profile);
});

app.post("/profilee", async (req, res) => {
  try {
    const userLogin = req.body;
    const getProfile = await pool.query(
      "SELECT login, avatar_url FROM users WHERE login = $1",
      [userLogin.login]
    );
    if (getProfile.rows.length == 0) {
      res.status(400).json("Sorry! This profile doesn't exist");
      return;
    }
    const profile = getProfile.rows[0];
    profile.avatar_url = "http://localhost:3000/" + profile.avatar_url;
    res.json(profile);
  } catch (error) {
    console.log(error);
    res.status(500).json("Something went");
  }
});

app.post("/watch/anime", authModdleware, async (req, res) => {
  try {
    const animeId = req.body.id;
    const userId = res.locals.user.userId;
    const status = req.body.status;
    const ExictingWAnime = await pool.query(
      "SELECT * FROM w_animes WHERE user_id = $1 AND id =$2",
      [userId, animeId]
    );
    if (ExictingWAnime.rows.length == 0) {
      await pool.query(
        "INSERT INTO w_animes (id, user_id, status) VALUES ($1,$2,$3)",
        [animeId, userId, status]
      );
      res.json("Added");
      return;
    } else {
      const profile = await pool.query(
        "UPDATE w_animes SET status =$1 WHERE user_id =$2 AND id =$3 ",
        [status, userId, animeId]
      );
      res.json("Updated");
    }
  } catch (error) {
    console.log(error);
  }
});

app.get("/comments/:animeId", async (req, res) => {
  try {
    const anime = req.params.animeId;
    const page = Number(req.query.page);
    const limit = Number(req.query.limit);
    const offset = (page - 1) * limit;
    if (!page || !limit) {
      return res.status(400).json("Page or limit is required");
    }
    const animeComments = await pool.query(
      `SELECT comments.id as id, comments.user_id, comments.comment_id, comments.comment,
      comments.created_at, users.login, users.avatar_url
      FROM comments
      LEFT JOIN users ON comments.user_id = users.id
      WHERE comments.id = $1
      ORDER BY created_at DESC
      OFFSET $2
      LIMIT $3
      `,
      [anime, offset, limit]
    );
    animeComments.rows.forEach((comment) => {
      comment.avatar_url = "http://localhost:3000/" + comment.avatar_url;
    });
    res.json(animeComments.rows);
  } catch (error) {
    console.log(error);
  }
});

app.delete("/comment/anime", authModdleware, async (req, res) => {
  try {
    const userId = res.locals.user.userId;
    const commentId = req.body.id;
    const ExictingComment = await pool.query(
      "SELECT * FROM comments WHERE user_id = $1 AND comment_id =$2",
      [userId, commentId]
    );
    if (ExictingComment.rows.length > 0) {
      await pool.query(
        "DELETE FROM comments WHERE user_id = $1 AND comment_id =$2",
        [userId, commentId]
      );
      res.json("You deleted comment anime!");
    } else {
      res.status(400).json("This comment doesnot exist!");
    }
  } catch (error) {
    console.log(error);
    res.status(500).json("Something went wrong");
    return;
  }
});

app.put("/comment/anime", authModdleware, async (req, res) => {
  try {
    const userId = res.locals.user.userId;
    const commentId = req.body.id;
    const comment = req.body.comment;
    const ExictingComment = await pool.query(
      "SELECT * FROM comments WHERE comment_id = $1 AND user_id = $2",
      [commentId, userId]
    );
    if (ExictingComment.rows.length > 0) {
      const profile = await pool.query(
        "UPDATE comments SET comment =$1 WHERE comment_id =$2",
        [comment, commentId]
      );
      console.log(commentId, comment);
      res.json("You edited your comment!");
    } else {
      res.status(400).json("There is no your comment!");
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Something went wrong");
    return;
  }
});

app.post("/comment/anime", authModdleware, async (req, res) => {
  try {
    const animeId = req.body.id;
    const userId = res.locals.user.userId;
    const comment = req.body.comment;
    await pool.query(
      "INSERT INTO comments (id, user_id, comment, created_at) VALUES ($1,$2,$3,$4)",
      [animeId, userId, comment, new Date()]
    );
    const data = await pool.query(
      `SELECT comments.id as id, comments.user_id, comments.comment_id, comments.comment,
      comments.created_at, users.login, users.avatar_url
      FROM comments
      LEFT JOIN users ON comments.user_id = users.id
      WHERE comments.id = $1 AND comments.user_id = $2 AND comments.comment = $3`,
      [animeId, userId, comment]
    );
    res.json(data.rows);
  } catch (error) {
    console.log(error);
  }
});

app.post("/friend/requests/add", authModdleware, async (req, res) => {
  try {
    const condition = req.body.condition;
    const login = req.body.login;
    const userId = res.locals.user.userId;
    const friendId = await pool.query("SELECT id FROM users WHERE login = $1", [
      login,
    ]);
    const DidHeSendAReq = await pool.query(
      "SELECT * FROM friend_requests WHERE user_id = $1 AND friend_id = $2",
      [friendId.rows[0].id, userId]
    );
    if (condition) {
      const AreTheyFriend = await pool.query(
        "SELECT * FROM friends WHERE user_id = $1 AND friend_id = $2",
        [userId, friendId.rows[0].id]
      );
      if (AreTheyFriend.rows.length == 0) {
        if (DidHeSendAReq.rows.length > 0) {
          await pool.query(
            "DELETE FROM friend_requests WHERE user_id = $1 AND friend_id =$2",
            [friendId.rows[0].id, userId]
          );
          await pool.query(
            "INSERT INTO friends (user_id, friend_id) VALUES ($1, $2)",
            [userId, friendId.rows[0].id]
          );
          await pool.query(
            "INSERT INTO friends (user_id, friend_id) VALUES ($1, $2)",
            [friendId.rows[0].id, userId]
          );
          res.json("Added!");
        }
      } else {
        res.status(400).json("You are already friends!");
        return;
      }
    } else {
      await pool.query(
        "DELETE FROM friend_requests WHERE user_id = $1 AND friend_id =$2",
        [friendId.rows[0].id, userId]
      );
      res.json("Canceled!");
    }
    console.log(login, condition, userId, friendId.rows[0].id);
  } catch (error) {
    console.log(error);
  }
});

app.post("/friend/requests", authModdleware, async (req, res) => {
  try {
    const login = req.body.login;
    const userId = res.locals.user.userId;
    const friendId = await pool.query("SELECT id FROM users WHERE login = $1", [
      login,
    ]);
    const AreTheyFriend = await pool.query(
      "SELECT * FROM friends WHERE user_id = $1 AND friend_id = $2",
      [userId, friendId.rows[0].id]
    );
    const DidHeSendAReq = await pool.query(
      "SELECT * FROM friend_requests WHERE user_id = $1 AND friend_id = $2",
      [friendId.rows[0].id, userId]
    );
    if (DidHeSendAReq.rows.length > 0) {
      await pool.query(
        "DELETE FROM friend_requests WHERE user_id = $1 AND friend_id =$2",
        [friendId.rows[0].id, userId]
      );
      await pool.query(
        "INSERT INTO friends (user_id, friend_id) VALUES ($1, $2)",
        [userId, friendId.rows[0].id]
      );
      await pool.query(
        "INSERT INTO friends (user_id, friend_id) VALUES ($1, $2)",
        [friendId.rows[0].id, userId]
      );
      res.json("Added!");
      return;
    } else {
      if (AreTheyFriend.rows.length > 0) {
        res.status(400).json("You are already friends!");
        return;
      } else {
        await pool.query(
          "INSERT INTO friend_requests (user_id, friend_id) VALUES ($1,$2)",
          [userId, friendId.rows[0].id]
        );
        res.json("Request sended!");
      }
    }
  } catch (error) {
    console.log(error);
  }
});

app.get("/friend/requests", authModdleware, async (req, res) => {
  try {
    const userId = res.locals.user.userId;
    const myRequestsTo = await pool.query(
      `SELECT users.login, users.avatar_url
      FROM friend_requests
      LEFT JOIN users ON friend_requests.friend_id = users.id 
      WHERE friend_requests.user_id = $1
      `,
      [userId]
    );
    const myRequests = await pool.query(
      `SELECT users.login, users.avatar_url, have_seen, created_at, users.id
      FROM friend_requests
      LEFT JOIN users ON friend_requests.user_id = users.id 
      WHERE friend_requests.friend_id = $1
      `,
      [userId]
    );
    const myFriends = await pool.query(
      `SELECT users.login, users.avatar_url
      FROM friends
      LEFT JOIN users ON friends.friend_id = users.id 
      WHERE friends.user_id = $1
      `,
      [userId]
    );
    const allRequests = {
      sent: myRequestsTo.rows,
      received: myRequests.rows,
      friends: myFriends.rows,
    };
    res.json(allRequests);
  } catch (error) {
    console.log(error);
  }
});

app.put("/friend-requests", authModdleware, async (req, res) => {
  try {
    const userId = res.locals.user.userId;
    const friendIds = req.body.ids;
    console.log(userId, friendIds);
    await pool.query(
      `
      UPDATE friend_requests
      SET have_seen = TRUE
      WHERE
          friend_id = $1
          AND
          have_seen = FALSE
          AND
          user_id = ANY($2::int[])
          `,
      [userId, friendIds]
    );
    res.json({ message: "OK" });
  } catch (error) {
    console.log(error);
    res.status(500).send("Something went wrong");
    return;
  }
});

app.delete("/friend", authModdleware, async (req, res) => {
  try {
    const userId = res.locals.user.userId;
    const friend_id = req.body.id;
    const AreTheyFriend = await pool.query(
      "SELECT * FROM friends WHERE user_id = $1 AND friend_id =$2",
      [userId, friend_id]
    );
    if (AreTheyFriend.rows.length > 0) {
      await pool.query(
        "DELETE FROM friends WHERE user_id = $1 AND friend_id =$2",
        [userId, friend_id]
      );
      await pool.query(
        "DELETE FROM friends WHERE user_id = $1 AND friend_id =$2",
        [friend_id, userId]
      );
      res.json("Друг вам больше не друг!");
    } else {
      res.status(400).json("You are not friends!!");
    }
  } catch (error) {
    console.log(error);
    res.status(500).json("Something went wrong");
    return;
  }
});

app.get("/friends-list/:Login", async (req, res) => {
  try {
    const login = req.params.Login;
    const userId = (
      await pool.query("SELECT id FROM users WHERE login = $1", [login])
    ).rows[0].id;
    const data = await pool.query(
      `SELECT users.login, users.avatar_url, users.id
      FROM friends
      LEFT JOIN users ON friends.user_id = users.id
      WHERE friends.friend_id = $1`,
      [userId]
    );
    res.json(data.rows);
  } catch (error) {
    console.log(error);
  }
});

app.delete("/logout", async (req, res) => {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
  res.json("You are logged out");
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});

/* CREATE TABLE Comments (
  comment_id INT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id SERIAL,
  user_id INT NOT NULL,
  comment VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
 * 
CREATE TABLE friend_requests (
    user_id INT NOT NULL,
    friend_id INT NOT NULL,
    have_seen BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id)
) 

CREATE TABLE friends (
    user_id INT NOT NULL,
    friend_id INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id)
)


 */
