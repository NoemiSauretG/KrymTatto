const express = require("express");

const app = express();

app.get("/api/test", (req, res) => {
    res.status(200).json({
        ok: true,
        mensaje: "TEST VERCEL FUNCIONANDO",
        url: req.url
    });
});

module.exports = app;