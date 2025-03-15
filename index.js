const express = require("express");
const PORT = process.env.PORT || 4040;
const {handler} = require("./controller")

const app = express();

app.use(express.json())
// GET route
app.get("*", async (req, res) => {
  res.send("Hello get");
  res.send(await handler(req))

});

// POST route
app.post("*", async (req, res) => {
  console.log("Request received", req.body);
  // res.send(await handler(req))
  const response = await handler(req)
  res.send(response)
});

// Start server
app.listen(PORT, function (err) {
  console.log(`Server running on http://localhost:${PORT}`);
});
