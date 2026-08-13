const express = require("express");

const app = express();

app.get("/", (req, res) => {
    res.json({
        ok: true,
        mensaje: "EXPRESS FUNCIONA",
        url: req.url
    });
});

app.get("/api/test", (req, res) => {
    res.json({
        ok: true,
        mensaje: "API TEST FUNCIONA",
        url: req.url
    });
});

module.exports = app;