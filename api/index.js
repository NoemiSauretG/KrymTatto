const express = require("express");

const app = express();

app.get("/api/test", (req, res) => {
    res.json({
        ok: true,
        mensaje: "TEST VERCEL FUNCIONANDO",
        url: req.url
    });
});

app.get("/api", (req, res) => {
    res.json({
        ok: true,
        mensaje: "Express funcionando"
    });
});

module.exports = app;