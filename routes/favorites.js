const router = require("express").Router();
const authModdleware = require("../midddleware");
const pool = require("../db");

router.get("/favorites/animes/:Login", async (req, res) => {
  try {
    const page = Number(req.query.page);
    const limit = Number(req.query.limit);
    const status = req.query.status;
    const offset = (page - 1) * limit;
    const usersId = (
      await pool.query("SELECT id FROM users WHERE login = $1", [
        req.params.Login,
      ])
    ).rows[0].id;
    if (!page || !limit) {
      return res.status(400).json("Page or limit is required");
    }
    const animeArray = (
      await pool.query(
        "SELECT id FROM w_animes WHERE user_id = $1 AND status = $2 OFFSET $3 LIMIT $4",
        [usersId, status, offset, limit]
      )
    ).rows;
    const animeIds = animeArray.map((id) => {
      return id.id;
    });
    if (!animeIds.length) {
      res.json([]);
      return;
    }
    const body = {
      query: `{
                animes(ids: "${animeIds}", limit: 9) {
                english
                id
                russian
                poster {
                    mainUrl
                }
              }
            }
        }`,
    };
    const resp = await fetch(`https://shikimori.one/api/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const Bbody = await resp.json();
    res.json(Bbody.data.animes);
  } catch (error) {
    console.log(error);
  }
});

router.post("/favorites/anime", authModdleware, async (req, res) => {
  try {
    const animeId = req.body.id;
    const userId = res.locals.user.userId;
    const ExictingFAnime = await pool.query(
      "SELECT * FROM favorite_animes WHERE user_id = $1 AND id =$2",
      [userId, animeId]
    );
    if (ExictingFAnime.rows.length > 0) {
      res.json("You have been alredy added this anime!");
      return;
    }
    await pool.query(
      "INSERT INTO favorite_animes (id, user_id) VALUES ($1,$2)",
      [animeId, userId]
    );
    res.json("Saved");
    console.log(req.query);
  } catch (error) {
    console.log(error);
  }
});

router.delete("/favorites/anime", authModdleware, async (req, res) => {
  try {
    const userId = res.locals.user.userId;
    const animeId = req.body.id;
    const ExictingFAnime = await pool.query(
      "SELECT * FROM favorite_animes WHERE user_id = $1 AND id =$2",
      [userId, animeId]
    );
    if (ExictingFAnime.rows.length > 0) {
      await pool.query(
        "DELETE FROM favorite_animes WHERE user_id = $1 AND id =$2",
        [userId, animeId]
      );
      res.json("You deleted favorite anime!");
    } else {
      res.status(400).json("You didn't add that yet!");
    }
  } catch (error) {
    console.log(error);
    res.status(500).json("Something went wrong");
    return;
  }
});

router.get("/favorites/anime/:login", async (req, res) => {
  try {
    const login = req.params.login;
    const userId = (
      await pool.query("SELECT id FROM users WHERE login = $1", [login])
    ).rows[0].id;
    const favoriesAnimes = await pool.query(
      "SELECT * FROM favorite_animes WHERE user_id = $1",
      [userId]
    );
    res.json(favoriesAnimes.rows);
  } catch (error) {
    console.log(error);
  }
});

router.get(
  "/favorites/anime/check/:animeId",
  authModdleware,
  async (req, res) => {
    try {
      const anime = req.params.animeId;
      const userId = res.locals.user.userId;
      const ExictingFAnime = await pool.query(
        "SELECT * FROM favorite_animes WHERE user_id = $1 AND id =$2",
        [userId, anime]
      );
      const wathcingCondition = await pool.query(
        "SELECT status FROM w_animes WHERE user_id = $1 AND id =$2",
        [userId, anime]
      );
      if (ExictingFAnime.rows == 0) {
        return res.json([
          { Favorits: false },
          { wathcingCondition: wathcingCondition.rows[0] },
        ]);
      } else {
        return res.json([
          { Favorits: true },
          { wathcingCondition: wathcingCondition.rows[0] },
        ]);
      }
    } catch (error) {
      console.log(error);
    }
  }
);

module.exports = router;
