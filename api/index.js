const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { put, del } = require("@vercel/blob");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR));

const db = mysql.createPool({
    host: process.env.MYSQLHOST,
    port: Number(process.env.MYSQLPORT || 3306),
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    ssl: process.env.MYSQL_SSL === "true" ? {} : undefined
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

const JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function requireAdmin(req, res, next) {
    if (!JWT_SECRET) {
        return res.status(500).json({ error: "Falta ADMIN_JWT_SECRET" });
    }

    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
        return res.status(401).json({ error: "No autorizado" });
    }

    try {
        req.admin = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: "Sesión no válida" });
    }
}

function nextPosition(table) {
    return db.query(
        `SELECT COALESCE(MAX(posicion), -1) + 1 AS siguiente FROM ${table}`
    ).then(([rows]) => Number(rows[0].siguiente));
}

async function saveBlob(file, folder) {
    const safeName = file.originalname
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/-+/g, "-");

    const pathname = `${folder}/${Date.now()}-${safeName}`;

    const blob = await put(pathname, file.buffer, {
        access: "public",
        contentType: file.mimetype,
        addRandomSuffix: true
    });

    return blob.url;
}

// -----------------------------------------------------------------------------
// PUBLIC
// -----------------------------------------------------------------------------
app.get("/api/test-db", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT 1 AS conectado");

        res.json({
            ok: true,
            railway: true,
            resultado: rows
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            ok: false,
            railway: false,
            error: err.message
        });
    }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/api/portfolio", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT * FROM portfolio ORDER BY posicion ASC, id ASC"
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error del servidor" });
    }
});

app.get("/api/ofertas", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT * FROM ofertas ORDER BY posicion ASC, id ASC"
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error del servidor" });
    }
});

app.get("/api/faq", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT * FROM faq ORDER BY posicion ASC, id ASC"
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error del servidor" });
    }
});

app.post("/api/login", (req, res) => {
    const { password } = req.body;

    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            success: false,
            message: "Contraseña incorrecta"
        });
    }

    const token = jwt.sign(
        { role: "admin" },
        JWT_SECRET,
        { expiresIn: "8h" }
    );

    res.json({ success: true, token });
});

// -----------------------------------------------------------------------------
// ADMIN - CREAR
// -----------------------------------------------------------------------------
app.post("/guardarPortfolio", requireAdmin, upload.single("imagen"), async (req, res) => {
    try {
        const { estilo } = req.body;
        if (!req.file) return res.status(400).json({ error: "Falta la imagen" });

        const imagen = await saveBlob(req.file, "portfolio");
        const posicion = await nextPosition("portfolio");

        const [result] = await db.query(
            "INSERT INTO portfolio (estilo, imagen, posicion) VALUES (?, ?, ?)",
            [estilo, imagen, posicion]
        );

        res.json({ success: true, id: result.insertId, imagen, posicion });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "No se pudo guardar el trabajo" });
    }
});

app.post("/guardarOferta", requireAdmin, upload.single("imagen"), async (req, res) => {
    try {
        const { titulo, precio } = req.body;
        if (!req.file) return res.status(400).json({ error: "Falta la imagen" });

        const imagen = await saveBlob(req.file, "ofertas");
        const posicion = await nextPosition("ofertas");

        const [result] = await db.query(
            "INSERT INTO ofertas (titulo, precio, imagen, posicion) VALUES (?, ?, ?, ?)",
            [titulo, precio, imagen, posicion]
        );

        res.json({ success: true, id: result.insertId, imagen, posicion });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "No se pudo guardar la oferta" });
    }
});

app.post("/guardarFaq", requireAdmin, async (req, res) => {
    try {
        const { pregunta, respuesta } = req.body;

        if (!pregunta || !respuesta) {
            return res.status(400).json({ error: "Completa los campos" });
        }

        const posicion = await nextPosition("faq");

        const [result] = await db.query(
            "INSERT INTO faq (pregunta, respuesta, posicion) VALUES (?, ?, ?)",
            [pregunta, respuesta, posicion]
        );

        res.json({ success: true, id: result.insertId, posicion });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "No se pudo guardar la pregunta" });
    }
});

// -----------------------------------------------------------------------------
// ADMIN - ELIMINAR
// -----------------------------------------------------------------------------
app.delete("/api/portfolio/:id", requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const [rows] = await db.query(
            "SELECT imagen FROM portfolio WHERE id = ?",
            [id]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "Trabajo no encontrado" });
        }

        await db.query("DELETE FROM portfolio WHERE id = ?", [id]);

        if (rows[0].imagen && rows[0].imagen.includes("blob.vercel-storage.com")) {
            try { await del(rows[0].imagen); } catch (e) { console.error(e); }
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "No se pudo eliminar" });
    }
});

app.delete("/api/ofertas/:id", requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const [rows] = await db.query(
            "SELECT imagen FROM ofertas WHERE id = ?",
            [id]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "Oferta no encontrada" });
        }

        await db.query("DELETE FROM ofertas WHERE id = ?", [id]);

        if (rows[0].imagen && rows[0].imagen.includes("blob.vercel-storage.com")) {
            try { await del(rows[0].imagen); } catch (e) { console.error(e); }
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "No se pudo eliminar" });
    }
});

app.delete("/api/faq/:id", requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const [result] = await db.query("DELETE FROM faq WHERE id = ?", [id]);

        if (!result.affectedRows) {
            return res.status(404).json({ error: "Pregunta no encontrada" });
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "No se pudo eliminar" });
    }
});

// -----------------------------------------------------------------------------
// ADMIN - REORDENAR
// -----------------------------------------------------------------------------
async function guardarOrden(tabla, orden, res) {
    const permitidas = ["portfolio", "ofertas", "faq"];

    if (!permitidas.includes(tabla) || !Array.isArray(orden) || !orden.length) {
        return res.status(400).json({ error: "Orden no válido" });
    }

    const ids = orden.map(Number);

    if (
        ids.some(id => !Number.isInteger(id) || id <= 0) ||
        new Set(ids).size !== ids.length
    ) {
        return res.status(400).json({ error: "IDs no válidos" });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        for (let i = 0; i < ids.length; i++) {
            await connection.query(
                `UPDATE ${tabla} SET posicion = ? WHERE id = ?`,
                [i, ids[i]]
            );
        }

        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: "No se pudo guardar el orden" });
    } finally {
        connection.release();
    }
}

app.put("/api/portfolio/reordenar", requireAdmin, (req, res) =>
    guardarOrden("portfolio", req.body.orden, res)
);

app.put("/api/ofertas/reordenar", requireAdmin, (req, res) =>
    guardarOrden("ofertas", req.body.orden, res)
);

app.put("/api/faq/reordenar", requireAdmin, (req, res) =>
    guardarOrden("faq", req.body.orden, res)
);

// -----------------------------------------------------------------------------
// CITAS
// -----------------------------------------------------------------------------
app.post("/api/citas", async (req, res) => {
    try {
        const { nombre, email, fecha, idea } = req.body;

        if (!nombre || !email || !fecha || !idea) {
            return res.status(400).json({ error: "Faltan campos obligatorios" });
        }

        const [result] = await db.query(
            "INSERT INTO citas (nombre, email, fecha, idea) VALUES (?, ?, ?, ?)",
            [nombre, email, fecha, idea]
        );

        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "No se pudo guardar la cita" });
    }
});

// -----------------------------------------------------------------------------
// EMAIL DE CONTACTO
// -----------------------------------------------------------------------------
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") === "true",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});

app.post("/api/citas-correo", upload.single("imagen"), async (req, res) => {
    try {
        const { nombre, email, idea } = req.body;

        if (!nombre || !email || !idea) {
            return res.status(400).json({ error: "Faltan campos obligatorios" });
        }

        const attachments = [];

        if (req.file) {
            attachments.push({
                filename: req.file.originalname,
                content: req.file.buffer,
                contentType: req.file.mimetype
            });
        }

        await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: process.env.CONTACT_TO || process.env.SMTP_USER,
            replyTo: email,
            subject: `Nueva idea de diseño - ${nombre}`,
            text: `Nombre: ${nombre}\nEmail: ${email}\n\nIdea del diseño:\n${idea}`,
            attachments
        });

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "No se pudo enviar el correo" });
    }
});

module.exports = app;
