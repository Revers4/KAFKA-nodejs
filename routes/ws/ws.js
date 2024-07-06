const ws = require("ws")
const pool = require("../../db")

const wsServer = new ws.Server({ noServer: true })

wsServer.on("connection", (ws, request) => {
  const userId = request.user.userId;
  ws.userId = Number(userId);

  ws.on("error", console.error);

  ws.on("message", async (dataRaw) => {
    const data = JSON.parse(dataRaw.toString("utf-8"));
    const DoesTheyHaveADialog = await pool.query(`SELECT first_person FROM dialog
    WHERE (first_person =$1 OR first_person =$2) AND (second_person =$1 OR second_person =$2)
    ORDER BY last_message_date DESC
    LIMIT 1;`,[userId,data.receiver_id])
    if(DoesTheyHaveADialog.rows.length == 0){
      await pool.query(`INSERT INTO dialog (first_person, who_wrote_last_message, second_person, last_message) VALUES ($1,$1,$2,$3);`,
      [userId,data.receiver_id,data.message])
    }
    if(DoesTheyHaveADialog.rows.length > 0){
      await pool.query(`UPDATE dialog SET last_message =$1, who_wrote_last_message =$2, last_message_date =NOW() WHERE (first_person =$2 OR first_person =$2) AND (second_person =$3 OR second_person =$3);`,
      [data.message,userId,data.receiver_id])
    }
    await pool.query(
        "INSERT INTO messages (reciver_id, sender_id, message) VALUES ($1,$2,$3)",
        [data.receiver_id, userId, data.message]
      );
    wsServer.clients.forEach((client) => {
      if (client.userId == data.receiver_id) {
        client.send(JSON.stringify(data));
      }

    });
  });

  // ws.send(JSON.stringify({ message: "Welcome!" }));
});

module.exports = wsServer