// ==========================================================================
// SERVER.JS COMPLETADO Y REVISADO
// ==========================================================================
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const adminTokens = new Set();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1234";

function requireAdmin(req, res, next) {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token || !adminTokens.has(token)) {
        return res.status(401).json({ error: "No autorizado" });
    }

    next();
}


// Crear carpeta uploads si no existe para evitar errores en Multer
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

// MIDDLEWARES CLAVE
app.use(cors());
app.use(express.json()); 
app.use(express.static(path.join(__dirname, "public")));
// Hacer la carpeta uploads accesible desde el navegador (http://localhost:3006/uploads/...)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// CONEXIÓN A MYSQL
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Ns@692674",
  database: "krymtattoo"
});

db.connect(err => {
  if (err) {
    console.error("Error conectando a MySQL:", err);
    return;
  }
  console.log("Conectado a MySQL");
});

// CONFIGURACIÓN DE MULTER PARA SUBIR IMÁGENES
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// ==========================================================================
// RUTAS DE LA API
// ==========================================================================

// Servir el HTML principal
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoint para verificar la contraseña de Administrador
app.post("/api/login", (req, res) => {
    const { password } = req.body;

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: "Contraseña incorrecta" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    adminTokens.add(token);

    res.json({ success: true, token });
});

// Guardar una Cita del Calendario en MySQL
app.post("/api/citas", (req, res) => {
    const { nombre, email, fecha, idea } = req.body;
    if (!nombre || !email || !fecha || !idea) {
        return res.status(400).json({ error: "Faltan campos obligatorios" });
    }
    const query = "INSERT INTO citas (nombre, email, fecha, idea) VALUES (?, ?, ?, ?)";
    db.query(query, [nombre, email, fecha, idea], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error");
        }
        res.json({ success: true, id: result.insertId });
    });
});

// PORTFOLIO (Guardar Trabajo)
app.post("/guardarPortfolio", requireAdmin, upload.single("imagen"), (req, res) => {
    const estilo = req.body.estilo;
    if (!req.file) return res.status(400).send("Falta la imagen");
    const imagen = req.file.path; // Guarda la ruta del archivo local

    db.query("SELECT COALESCE(MAX(posicion), -1) + 1 AS siguiente FROM portfolio", (maxErr, rows) => {
        if (maxErr) {
            console.error(maxErr);
            return res.status(500).send("Error");
        }

        const posicion = rows[0].siguiente;
        const sql = "INSERT INTO portfolio (estilo, imagen, posicion) VALUES (?, ?, ?)";

        db.query(sql, [estilo, imagen, posicion], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error");
            }
            res.json({ success: true, id: result.insertId, posicion });
        });
    });
});

// OFERTAS (Guardar Flash)
app.post("/guardarOferta", requireAdmin, upload.single("imagen"), (req, res) => {
    const { titulo, precio } = req.body;
    if (!req.file) return res.status(400).send("Falta la imagen");
    const imagen = req.file.path;

    db.query("SELECT COALESCE(MAX(posicion), -1) + 1 AS siguiente FROM ofertas", (maxErr, rows) => {
        if (maxErr) {
            console.error(maxErr);
            return res.status(500).send("Error");
        }
        const posicion = rows[0].siguiente;
        const sql = "INSERT INTO ofertas (titulo, precio, imagen, posicion) VALUES (?, ?, ?, ?)";
        db.query(sql, [titulo, precio, imagen, posicion], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error");
        }
            res.send("Oferta guardada");
        });
    });
});

// PREGUNTAS (Guardar FAQ)
app.post("/guardarFaq", requireAdmin, (req, res) => {
    const { pregunta, respuesta } = req.body;
    db.query("SELECT COALESCE(MAX(posicion), -1) + 1 AS siguiente FROM faq", (maxErr, rows) => {
        if (maxErr) {
            console.error(maxErr);
            return res.status(500).send("Error");
        }
        const posicion = rows[0].siguiente;
        const sql = "INSERT INTO faq (pregunta, respuesta, posicion) VALUES (?, ?, ?)";
        db.query(sql, [pregunta, respuesta, posicion], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error");
        }
            res.send("Pregunta guardada");
        });
    });
});

// OBTENER INFORMACION
// PORFOLIO
app.get("/api/portfolio", (req, res) => {
    const sql = "SELECT * FROM portfolio ORDER BY posicion ASC, id ASC";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error al obtener portfolio:", err);
            return res.status(500).send("Error del servidor");
        }
        res.json(results);
    });
});

// --------------------------------------------------------------------------
// GESTIÓN ADMINISTRATIVA DEL PORTFOLIO
// --------------------------------------------------------------------------
app.delete("/api/portfolio/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID no válido" });

    db.query("SELECT imagen FROM portfolio WHERE id = ?", [id], (selectErr, rows) => {
        if (selectErr) {
            console.error(selectErr);
            return res.status(500).json({ error: "Error al buscar el trabajo" });
        }
        if (rows.length === 0) return res.status(404).json({ error: "Trabajo no encontrado" });

        const imagen = rows[0].imagen;
        db.query("DELETE FROM portfolio WHERE id = ?", [id], deleteErr => {
            if (deleteErr) {
                console.error(deleteErr);
                return res.status(500).json({ error: "No se pudo eliminar el trabajo" });
            }

            if (imagen) {
                const ruta = path.resolve(__dirname, imagen);
                const uploadsDir = path.resolve(__dirname, "uploads");
                if (ruta.startsWith(uploadsDir) && fs.existsSync(ruta)) {
                    fs.unlink(ruta, unlinkErr => {
                        if (unlinkErr) console.error("No se pudo borrar la imagen:", unlinkErr);
                    });
                }
            }
            res.json({ success: true });
        });
    });
});

app.put("/api/portfolio/reordenar", requireAdmin, (req, res) => {
    const orden = req.body.orden;
    if (!Array.isArray(orden) || orden.length === 0) return res.status(400).json({ error: "Orden no válido" });

    const ids = orden.map(Number);
    if (ids.some(id => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
        return res.status(400).json({ error: "IDs no válidos" });
    }

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ error: "No se pudo iniciar la actualización" });
        let completados = 0, fallo = false;
        ids.forEach((id, index) => {
            db.query("UPDATE portfolio SET posicion = ? WHERE id = ?", [index, id], updateErr => {
                if (fallo) return;
                if (updateErr) {
                    fallo = true;
                    return db.rollback(() => res.status(500).json({ error: "No se pudo guardar el orden" }));
                }
                completados++;
                if (completados === ids.length) {
                    db.commit(commitErr => {
                        if (commitErr) return db.rollback(() => res.status(500).json({ error: "No se pudo guardar el orden" }));
                        res.json({ success: true });
                    });
                }
            });
        });
    });
});

// OFERTAS 
app.get("/api/ofertas", (req, res) => {
    const sql = "SELECT * FROM ofertas ORDER BY posicion ASC, id ASC";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error al obtener ofertas:", err);
            return res.status(500).send("Error del servidor");
        }
        res.json(results); // Envía los registros al fetch del frontend
    });
});
// FAQ
app.get("/api/faq", (req, res) => {
    const sql = "SELECT * FROM faq ORDER BY posicion ASC, id ASC";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error al obtener FAQs:", err);
            return res.status(500).send("Error del servidor");
        }
        res.json(results);
    });
});


// --------------------------------------------------------------------------
// GESTIÓN ADMINISTRATIVA DE OFERTAS Y FAQ
// --------------------------------------------------------------------------
app.delete("/api/ofertas/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID no válido" });

    db.query("SELECT imagen FROM ofertas WHERE id = ?", [id], (selectErr, rows) => {
        if (selectErr) return res.status(500).json({ error: "Error al buscar la oferta" });
        if (!rows.length) return res.status(404).json({ error: "Oferta no encontrada" });

        const imagen = rows[0].imagen;
        db.query("DELETE FROM ofertas WHERE id = ?", [id], deleteErr => {
            if (deleteErr) return res.status(500).json({ error: "No se pudo eliminar la oferta" });
            if (imagen) {
                const ruta = path.resolve(__dirname, imagen);
                const uploadsDir = path.resolve(__dirname, "uploads");
                if (ruta.startsWith(uploadsDir) && fs.existsSync(ruta)) fs.unlink(ruta, err => err && console.error(err));
            }
            res.json({ success: true });
        });
    });
});

app.put("/api/ofertas/reordenar", requireAdmin, (req, res) => {
    guardarOrden("ofertas", req.body.orden, res);
});

app.delete("/api/faq/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID no válido" });
    db.query("DELETE FROM faq WHERE id = ?", [id], err => {
        if (err) return res.status(500).json({ error: "No se pudo eliminar la pregunta" });
        res.json({ success: true });
    });
});

app.put("/api/faq/reordenar", requireAdmin, (req, res) => {
    guardarOrden("faq", req.body.orden, res);
});

function guardarOrden(tabla, orden, res) {
    const tablasPermitidas = ["portfolio", "ofertas", "faq"];
    if (!tablasPermitidas.includes(tabla) || !Array.isArray(orden) || !orden.length) {
        return res.status(400).json({ error: "Orden no válido" });
    }
    const ids = orden.map(Number);
    if (ids.some(id => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
        return res.status(400).json({ error: "IDs no válidos" });
    }

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ error: "No se pudo iniciar la actualización" });
        let done = 0, failed = false;
        ids.forEach((id, index) => {
            db.query(`UPDATE ${tabla} SET posicion = ? WHERE id = ?`, [index, id], updateErr => {
                if (failed) return;
                if (updateErr) {
                    failed = true;
                    return db.rollback(() => res.status(500).json({ error: "No se pudo guardar el orden" }));
                }
                done++;
                if (done === ids.length) {
                    db.commit(commitErr => {
                        if (commitErr) return db.rollback(() => res.status(500).json({ error: "No se pudo guardar el orden" }));
                        res.json({ success: true });
                    });
                }
            });
        });
    });
}

//FORMULARIO
const nodemailer = require('nodemailer');

// 1. Configuración del transporte (ejemplo para Gmail)
const transpor_correo = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true para puerto 465 (SSL)
    auth: {
        user: 'krymgian02@gmail.com', // El correo que enviará los mensajes
        pass: 'xbvy rswi npue fiav'     // Contraseña de aplicación generada en tu cuenta Google
    }
});

// 2. Endpoint exclusivo para la solicitud de cita por correo (sin guardar en BD)
app.post("/api/citas-correo", upload.single("imagen"), (req, res) => {
    try {
        const { nombre, email, idea } = req.body;
        const archivoAdjunto = req.file;

        if (!nombre || !email || !idea) {
            return res.status(400).json({ error: "Faltan campos obligatorios en el formulario." });
        }

        const opcionesCorreo = {
            from: '"Krym Tattoo" <krymgian02@gmail.com>',
            to: 'krymgian02@gmail.com',
            replyTo: email,
            subject: `Nueva idea de diseño - ${nombre}`,
            text: `Nombre: ${nombre}\nEmail: ${email}\n\nIdea del diseño:\n${idea}`,
            attachments: []
        };

        if (archivoAdjunto) {
            opcionesCorreo.attachments.push({
                filename: archivoAdjunto.originalname,
                path: archivoAdjunto.path
            });
        }

        // Enviamos el correo
        transpor_correo.sendMail(opcionesCorreo, (error, info) => {
            if (error) {
                console.error("Fallo interno en Nodemailer:", error);
                // Enviamos el mensaje de error real de Google al frontend
                return res.status(500).json({ error: `Fallo en SMTP: ${error.message}` });
            }
            return res.json({ success: true, message: "Correo enviado correctamente." });
        });

    } catch (err) {
        console.error("Fallo crítico en el endpoint:", err);
        return res.status(500).json({ error: `Fallo crítico: ${err.message}` });
    }
});

// ESCUCHA DEL PUERTO
app.listen(3006, () => {
  console.log("Servidor en puerto 3006");
});

