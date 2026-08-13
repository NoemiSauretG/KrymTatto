const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const { put } = require('@vercel/blob');

const app = express();

const app = express();

app.get("/api/test", (req, res) => {
    res.status(200).json({
        ok: true,
        mensaje: "ESTOY EN EL ÚLTIMO DEPLOYMENT"
    });
});

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
    ssl: process.env.MYSQL_SSL === "true" 
        ? { rejectUnauthorized: false } 
        : undefined,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

// Configurar multer para procesar la imagen en memoria (sin guardarla en el disco)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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
    // Diagnóstico de variables de entorno (sin mostrar tu contraseña)
    const envCheck = {
        host: process.env.MYSQLHOST || "NO DEFINIDO",
        port: process.env.MYSQLPORT || "NO DEFINIDO",
        user: process.env.MYSQLUSER || "NO DEFINIDO",
        database: process.env.MYSQLDATABASE || "NO DEFINIDO",
        ssl: process.env.MYSQL_SSL || "NO DEFINIDO"
    };

    try {
        const [rows] = await db.query("SELECT 1 AS conectado");

        res.json({
            ok: true,
            railway: true,
            config_leida: envCheck,
            resultado: rows
        });
    } catch (err) {
        console.error("Error al conectar con Railway:", err);

        res.status(500).json({
            ok: false,
            railway: false,
            config_leida: envCheck, // Te dirá qué variables está leyendo exactamente Node.js
            error: err.message,
            code: err.code
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
app.post('/guardarPortfolio', upload.single('imagen'), async (req, res) => {
    try {
        const { estilo } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).send('No se ha adjuntado ninguna imagen.');
        }

        // 1. Subir la imagen a Vercel Blob
        // 'portfolio/' crea una subcarpeta virtual en Blob
        const blob = await put(`portfolio/${Date.now()}-${file.originalname}`, file.buffer, {
            access: 'public',
        });

        // 'blob.url' contiene la URL pública y definitiva de la imagen (ej: https://...public.blob.vercel-storage.com/...)
        const imageUrl = blob.url;

        // 2. Guardar la URL resultante en MySQL (Railway)
        const sql = 'INSERT INTO portfolio (imagen, estilo) VALUES (?, ?)';
        await db.query(sql, [imageUrl, estilo]);

        res.status(200).send('Trabajo guardado correctamente en Vercel Blob y BD.');

    } catch (error) {
        console.error('Error al subir a Vercel Blob:', error);
        res.status(500).send('Error interno al guardar la imagen.');
    }
});

app.post('/guardarOferta', upload.single('imagen'), async (req, res) => {
    try {
        const { titulo, precio } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).send('Falta la imagen de la oferta.');
        }

        // Subir a la carpeta 'ofertas/' en Vercel Blob
        const blob = await put(`ofertas/${Date.now()}-${file.originalname}`, file.buffer, {
            access: 'public',
        });

        const sql = 'INSERT INTO ofertas (titulo, precio, imagen) VALUES (?, ?, ?)';
        await db.query(sql, [titulo, precio, blob.url]);

        res.status(200).send('Oferta publicada con éxito.');

    } catch (error) {
        console.error('Error al guardar la oferta:', error);
        res.status(500).send('Error al guardar la oferta.');
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

app.post("/api/citas-correo", upload.single("imagen"), async (req, res) => {
    try {
        const { nombre, email, idea } = req.body;

        if (!nombre || !email || !idea) {
            return res.status(400).json({
                error: "Faltan campos obligatorios"
            });
        }

        if (!process.env.RESEND_API_KEY) {
            console.error("Falta RESEND_API_KEY");

            return res.status(500).json({
                error: "El servicio de correo no está configurado"
            });
        }

        const attachments = [];

        if (req.file) {
            attachments.push({
                filename: req.file.originalname,
                content: req.file.buffer
            });
        }

        const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || "Krym Tattoo <onboarding@resend.dev>",
            to: [
                process.env.CONTACT_TO || "herorean5@gmail.com"
            ],
            replyTo: email,
            subject: `Nueva idea de diseño - ${nombre}`,

            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <h2>Nueva solicitud de cita</h2>

                    <p>
                        <strong>Nombre:</strong>
                        ${nombre}
                    </p>

                    <p>
                        <strong>Email:</strong>
                        ${email}
                    </p>

                    <h3>Idea del diseño</h3>

                    <p>
                        ${idea.replace(/\n/g, "<br>")}
                    </p>
                </div>
            `,

            attachments
        });

        if (error) {
            console.error("Error de Resend:", error);

            return res.status(500).json({
                error: "No se pudo enviar el correo",
                detalle: error.message || error
            });
        }

        console.log("Correo enviado:", data);

        return res.json({
            success: true,
            messageId: data?.id
        });

    } catch (err) {

        console.error("Error enviando correo:", err);

        return res.status(500).json({
            error: "No se pudo enviar el correo",
            detalle: err.message
        });
    }
});

module.exports = app;
