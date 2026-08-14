const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const { put, del } = require("@vercel/blob");

const app = express();

/* ============================================================
   MIDDLEWARE
============================================================ */

app.use(cors());

app.use(express.json({ limit: "2mb" }));

app.use(express.urlencoded({
    extended: true
}));


/* ============================================================
   ARCHIVOS PÚBLICOS
============================================================ */

const PUBLIC_DIR = path.join(
    __dirname,
    "..",
    "public"
);

app.use(express.static(PUBLIC_DIR));


/* ============================================================
   TEST VERCEL
============================================================ */

app.get("/api/test", (req, res) => {

    res.json({
        ok: true,
        mensaje: "Express funciona en Vercel",
        url: req.originalUrl
    });

});


/* ============================================================
   MYSQL - RAILWAY
============================================================ */

const db = mysql.createPool({

    host: process.env.MYSQLHOST,

    port: Number(
        process.env.MYSQLPORT || 3306
    ),

    user: process.env.MYSQLUSER,

    password: process.env.MYSQLPASSWORD,

    database: process.env.MYSQLDATABASE,

    ssl: {
        rejectUnauthorized: false
    },

    waitForConnections: true,

    connectionLimit: 5,

    queueLimit: 0,

    enableKeepAlive: true,

    keepAliveInitialDelay: 10000
});


/* ============================================================
   TEST MYSQL
============================================================ */

app.get("/api/test-db", async (req, res) => {

    try {

        const [rows] = await db.query(
            "SELECT 1 AS conectado"
        );

        res.json({

            ok: true,

            railway: true,

            resultado: rows

        });

    } catch (error) {

        console.error(
            "ERROR MYSQL:",
            error
        );

        res.status(500).json({

            ok: false,

            railway: false,

            error: error.message,

            code: error.code

        });
    }
});


/* ============================================================
   MULTER
============================================================ */

const upload = multer({

    storage: multer.memoryStorage(),

    limits: {
        fileSize: 10 * 1024 * 1024
    }

});


/* ============================================================
   AUTENTICACIÓN
============================================================ */

const JWT_SECRET =
    process.env.ADMIN_JWT_SECRET;

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD;


function requireAdmin(req, res, next) {

    if (!JWT_SECRET) {

        return res.status(500).json({

            error:
                "Falta ADMIN_JWT_SECRET en Vercel"

        });
    }


    const authorization =
        req.headers.authorization || "";


    const token =
        authorization.startsWith("Bearer ")
            ? authorization.substring(7)
            : "";


    if (!token) {

        return res.status(401).json({

            error:
                "No autorizado"

        });
    }


    try {

        req.admin =
            jwt.verify(
                token,
                JWT_SECRET
            );

        next();

    } catch (error) {

        return res.status(401).json({

            error:
                "Sesión no válida"

        });
    }
}


/* ============================================================
   LOGIN
============================================================ */

app.post("/api/login", (req, res) => {

    try {

        const {
            password
        } = req.body;


        if (
            !ADMIN_PASSWORD ||
            password !== ADMIN_PASSWORD
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Contraseña incorrecta"

            });
        }


        if (!JWT_SECRET) {

            return res.status(500).json({

                success: false,

                message:
                    "Falta ADMIN_JWT_SECRET"

            });
        }


        const token =
            jwt.sign(
                {
                    role: "admin"
                },

                JWT_SECRET,

                {
                    expiresIn: "8h"
                }
            );


        res.json({

            success: true,

            token

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Error del servidor"

        });
    }
});


/* ============================================================
   POSICIÓN
============================================================ */

async function nextPosition(table) {

    const allowedTables = [
        "portfolio",
        "ofertas",
        "faq"
    ];


    if (
        !allowedTables.includes(table)
    ) {

        throw new Error(
            "Tabla no permitida"
        );
    }


    const [rows] =
        await db.query(
            `SELECT COALESCE(MAX(posicion), -1) + 1 AS siguiente
             FROM ${table}`
        );


    return Number(
        rows[0].siguiente
    );
}


/* ============================================================
   VERCEL BLOB
============================================================ */

async function saveBlob(
    file,
    folder
) {

    const safeName =
        file.originalname

            .replace(
                /[^a-zA-Z0-9._-]/g,
                "-"
            )

            .replace(
                /-+/g,
                "-"
            );


    const pathname =
        `${folder}/${Date.now()}-${safeName}`;


    const blob =
        await put(
            pathname,
            file.buffer,
            {

                access: "public",

                contentType:
                    file.mimetype,

                addRandomSuffix:
                    true

            }
        );


    return blob.url;
}


/* ============================================================
   INICIO
============================================================ */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            PUBLIC_DIR,
            "index.html"
        )
    );

});


/* ============================================================
   PORTFOLIO - GET
============================================================ */

app.get(
    "/api/portfolio",
    async (req, res) => {

        try {

            const [rows] =
                await db.query(
                    `SELECT *
                     FROM portfolio
                     ORDER BY posicion ASC, id ASC`
                );


            res.json(rows);

        } catch (error) {

            console.error(
                "ERROR PORTFOLIO:",
                error
            );


            res.status(500).json({

                error:
                    "Error del servidor"

            });
        }
    }
);


/* ============================================================
   OFERTAS - GET
============================================================ */

app.get(
    "/api/ofertas",
    async (req, res) => {

        try {

            const [rows] =
                await db.query(
                    `SELECT *
                     FROM ofertas
                     ORDER BY posicion ASC, id ASC`
                );


            res.json(rows);

        } catch (error) {

            console.error(
                "ERROR OFERTAS:",
                error
            );


            res.status(500).json({

                error:
                    "Error del servidor"

            });
        }
    }
);


/* ============================================================
   FAQ - GET
============================================================ */

app.get(
    "/api/faq",
    async (req, res) => {

        try {

            const [rows] =
                await db.query(
                    `SELECT *
                     FROM faq
                     ORDER BY posicion ASC, id ASC`
                );


            res.json(rows);

        } catch (error) {

            console.error(
                "ERROR FAQ:",
                error
            );


            res.status(500).json({

                error:
                    "Error del servidor"

            });
        }
    }
);


/* ============================================================
   GUARDAR PORTFOLIO
============================================================ */

app.post(
    "/api/guardarPortfolio",
    requireAdmin,
    upload.single("imagen"),
    async (req, res) => {

        try {

            console.log("GUARDAR PORTFOLIO");
            console.log("BODY:", req.body);
            console.log("FILE:", !!req.file);


            const { estilo } = req.body;


            if (!req.file) {

                return res.status(400).json({
                    error: "Falta la imagen"
                });
            }


            const imagen =
                await saveBlob(
                    req.file,
                    "portfolio"
                );


            const posicion =
                await nextPosition(
                    "portfolio"
                );


            const [result] =
                await db.query(
                    `INSERT INTO portfolio
                    (estilo, imagen, posicion)
                    VALUES (?, ?, ?)`,
                    [
                        estilo,
                        imagen,
                        posicion
                    ]
                );


            res.json({
                success: true,
                id: result.insertId,
                imagen,
                posicion
            });


        } catch (error) {

            console.error(
                "ERROR GUARDANDO PORTFOLIO:",
                error
            );


            res.status(500).json({

                error:
                    "Error guardando portfolio",

                detalle:
                    error.message,

                code:
                    error.code || null,

                sqlMessage:
                    error.sqlMessage || null

            });
        }
    }
);


/* ============================================================
   GUARDAR OFERTA
============================================================ */

app.post(
    "/api/guardarOferta",
    requireAdmin,
    upload.single("imagen"),
    async (req, res) => {

        try {

            console.log("GUARDAR OFERTA");
            console.log("BODY:", req.body);
            console.log("FILE:", !!req.file);


            const {
                titulo,
                precio
            } = req.body;


            if (!titulo || !precio) {

                return res.status(400).json({

                    error:
                        "Faltan título o precio"

                });
            }


            if (!req.file) {

                return res.status(400).json({

                    error:
                        "Falta la imagen"

                });
            }


            const imagen =
                await saveBlob(
                    req.file,
                    "ofertas"
                );


            const posicion =
                await nextPosition(
                    "ofertas"
                );


            const [result] =
                await db.query(
                    `INSERT INTO ofertas
                    (titulo, precio, imagen, posicion)
                    VALUES (?, ?, ?, ?)`,
                    [
                        titulo,
                        precio,
                        imagen,
                        posicion
                    ]
                );


            res.json({

                success: true,

                id:
                    result.insertId,

                imagen,

                posicion

            });


        } catch (error) {

            console.error(
                "ERROR GUARDANDO OFERTA:",
                error
            );


            res.status(500).json({

                error:
                    "Error guardando oferta",

                detalle:
                    error.message,

                code:
                    error.code || null,

                sqlMessage:
                    error.sqlMessage || null

            });
        }
    }
);


/* ============================================================
   GUARDAR FAQ
============================================================ */

app.post(
    "/api/guardarFaq",
    requireAdmin,
    async (req, res) => {

        try {

            console.log("GUARDAR FAQ");
            console.log("BODY:", req.body);


            const {
                pregunta,
                respuesta
            } = req.body;


            if (!pregunta || !respuesta) {

                return res.status(400).json({

                    error:
                        "Completa los campos"

                });
            }


            const posicion =
                await nextPosition(
                    "faq"
                );


            const [result] =
                await db.query(
                    `INSERT INTO faq
                    (pregunta, respuesta, posicion)
                    VALUES (?, ?, ?)`,
                    [
                        pregunta,
                        respuesta,
                        posicion
                    ]
                );


            res.json({

                success: true,

                id:
                    result.insertId,

                posicion

            });


        } catch (error) {

            console.error(
                "ERROR GUARDANDO FAQ:",
                error
            );


            res.status(500).json({

                error:
                    "Error guardando FAQ",

                detalle:
                    error.message,

                code:
                    error.code || null,

                sqlMessage:
                    error.sqlMessage || null

            });
        }
    }
);


/* ============================================================
   BORRAR PORTFOLIO
============================================================ */

app.delete(
    "/api/portfolio/:id",

    requireAdmin,

    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {

                return res.status(400).json({

                    error:
                        "ID no válido"

                });
            }


            const [rows] =
                await db.query(
                    "SELECT imagen FROM portfolio WHERE id = ?",
                    [id]
                );


            if (!rows.length) {

                return res.status(404).json({

                    error:
                        "Trabajo no encontrado"

                });
            }


            await db.query(
                "DELETE FROM portfolio WHERE id = ?",
                [id]
            );


            if (
                rows[0].imagen &&
                rows[0].imagen.includes(
                    "blob.vercel-storage.com"
                )
            ) {

                try {

                    await del(
                        rows[0].imagen
                    );

                } catch (blobError) {

                    console.error(
                        "Error eliminando Blob:",
                        blobError
                    );
                }
            }


            res.json({

                success: true

            });

        } catch (error) {

            console.error(
                "ERROR BORRANDO PORTFOLIO:",
                error
            );


            res.status(500).json({

                error:
                    "No se pudo eliminar"

            });
        }
    }
);


/* ============================================================
   BORRAR OFERTA
============================================================ */

app.delete(
    "/api/ofertas/:id",

    requireAdmin,

    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {

                return res.status(400).json({

                    error:
                        "ID no válido"

                });
            }


            const [rows] =
                await db.query(
                    "SELECT imagen FROM ofertas WHERE id = ?",
                    [id]
                );


            if (!rows.length) {

                return res.status(404).json({

                    error:
                        "Oferta no encontrada"

                });
            }


            await db.query(
                "DELETE FROM ofertas WHERE id = ?",
                [id]
            );


            if (
                rows[0].imagen &&
                rows[0].imagen.includes(
                    "blob.vercel-storage.com"
                )
            ) {

                try {

                    await del(
                        rows[0].imagen
                    );

                } catch (blobError) {

                    console.error(
                        "Error eliminando Blob:",
                        blobError
                    );
                }
            }


            res.json({

                success: true

            });

        } catch (error) {

            console.error(
                "ERROR BORRANDO OFERTA:",
                error
            );


            res.status(500).json({

                error:
                    "No se pudo eliminar"

            });
        }
    }
);


/* ============================================================
   BORRAR FAQ
============================================================ */

app.delete(
    "/api/faq/:id",

    requireAdmin,

    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {

                return res.status(400).json({

                    error:
                        "ID no válido"

                });
            }


            const [result] =
                await db.query(
                    "DELETE FROM faq WHERE id = ?",
                    [id]
                );


            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({

                    error:
                        "Pregunta no encontrada"

                });
            }


            res.json({

                success: true

            });

        } catch (error) {

            console.error(
                "ERROR BORRANDO FAQ:",
                error
            );


            res.status(500).json({

                error:
                    "No se pudo eliminar"

            });
        }
    }
);


/* ============================================================
   REORDENAR
============================================================ */

async function guardarOrden(
    tabla,
    orden,
    res
) {

    const tablasPermitidas = [
        "portfolio",
        "ofertas",
        "faq"
    ];


    if (
        !tablasPermitidas.includes(
            tabla
        )
    ) {

        return res.status(400).json({

            error:
                "Tabla no permitida"

        });
    }


    if (
        !Array.isArray(orden) ||
        orden.length === 0
    ) {

        return res.status(400).json({

            error:
                "Orden no válido"

        });
    }


    const ids =
        orden.map(
            id => Number(id)
        );


    if (
        ids.some(
            id =>
                !Number.isInteger(id) ||
                id <= 0
        )
    ) {

        return res.status(400).json({

            error:
                "IDs no válidos"

        });
    }


    if (
        new Set(ids).size !== ids.length
    ) {

        return res.status(400).json({

            error:
                "Hay IDs duplicados"

        });
    }


    const connection =
        await db.getConnection();


    try {

        await connection.beginTransaction();


        for (
            let i = 0;
            i < ids.length;
            i++
        ) {

            await connection.query(
                `UPDATE ${tabla}
                 SET posicion = ?
                 WHERE id = ?`,
                [
                    i,
                    ids[i]
                ]
            );
        }


        await connection.commit();


        res.json({

            success: true,

            orden: ids

        });

    } catch (error) {

        await connection.rollback();

        console.error(
            "ERROR REORDENANDO:",
            error
        );


        res.status(500).json({

            error:
                "No se pudo guardar el orden"

        });

    } finally {

        connection.release();
    }
}


/* ============================================================
   REORDENAR PORTFOLIO
============================================================ */

app.put(
    "/api/portfolio/reordenar",

    requireAdmin,

    (req, res) => {

        guardarOrden(
            "portfolio",
            req.body.orden,
            res
        );

    }
);


/* ============================================================
   REORDENAR OFERTAS
============================================================ */

app.put(
    "/api/ofertas/reordenar",

    requireAdmin,

    (req, res) => {

        guardarOrden(
            "ofertas",
            req.body.orden,
            res
        );

    }
);


/* ============================================================
   REORDENAR FAQ
============================================================ */

app.put(
    "/api/faq/reordenar",

    requireAdmin,

    (req, res) => {

        guardarOrden(
            "faq",
            req.body.orden,
            res
        );

    }
);


/* ============================================================
   CITAS
============================================================ */

app.post(
    "/api/citas",
    async (req, res) => {

        try {

            const {
                nombre,
                email,
                fecha,
                idea
            } = req.body;


            if (
                !nombre ||
                !email ||
                !fecha ||
                !idea
            ) {

                return res.status(400).json({

                    error:
                        "Faltan campos obligatorios"

                });
            }


            const [result] =
                await db.query(
                    `INSERT INTO citas
                    (nombre, email, fecha, idea)
                    VALUES (?, ?, ?, ?)`,
                    [
                        nombre,
                        email,
                        fecha,
                        idea
                    ]
                );


            res.json({

                success: true,

                id:
                    result.insertId

            });

        } catch (error) {

            console.error(
                "ERROR CITA:",
                error
            );


            res.status(500).json({

                error:
                    "No se pudo guardar la cita"

            });
        }
    }
);


/* ============================================================
   CORREO
   Resend mediante API
============================================================ */

// Comprobación rápida desde el navegador.
// El envío real de correo se hace mediante POST desde el formulario.
app.get("/api/citas-correo", (req, res) => {
    res.json({
        ok: true,
        mensaje: "Endpoint de citas-correo disponible. Usa POST para enviar el formulario."
    });
});

app.post(
    "/api/citas-correo",

    upload.single("imagen"),

    async (req, res) => {

        try {

            const {
                nombre,
                email,
                fecha,
                idea
            } = req.body;


            if (
                !nombre ||
                !email ||
                !idea
            ) {

                return res.status(400).json({

                    error:
                        "Faltan campos obligatorios"

                });
            }


            if (
                !process.env.RESEND_API_KEY
            ) {

                return res.status(500).json({

                    error:
                        "Falta RESEND_API_KEY"

                });
            }


            const body = {

                from:
                    process.env.EMAIL_FROM ||
                    "Krym Tattoo <onboarding@resend.dev>",

                to: [
                    process.env.CONTACT_TO ||
                    "herorean5@gmail.com"
                ],

                reply_to:
                    email,

                subject:
                    `Nueva idea de diseño - ${nombre}`,

                html: `
                    <h2>
                        Nueva solicitud de cita
                    </h2>

                    <p>
                        <strong>Nombre:</strong>
                        ${nombre}
                    </p>

                    <p>
                        <strong>Email:</strong>
                        ${email}
                    </p>

                    <p>
                        <strong>Fecha solicitada:</strong>
                        ${fecha || "No seleccionada"}
                    </p>

                    <h3>
                        Idea del diseño
                    </h3>

                    <p>
                        ${String(idea)
                            .replace(
                                /\n/g,
                                "<br>"
                            )}
                    </p>
                `
            };


            if (req.file) {

                body.attachments = [

                    {
                        filename:
                            req.file.originalname,

                        content:
                            req.file.buffer.toString(
                                "base64"
                            )
                    }

                ];
            }


            const response =
                await fetch(
                    "https://api.resend.com/emails",
                    {

                        method: "POST",

                        headers: {

                            Authorization:
                                `Bearer ${process.env.RESEND_API_KEY}`,

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify(body)

                    }
                );


            const data =
                await response
                    .json()
                    .catch(
                        () => ({})
                    );


            if (!response.ok) {

                console.error(
                    "ERROR RESEND:",
                    data
                );


                return res.status(500).json({

                    error:
                        "No se pudo enviar el correo",

                    detalle:
                        data

                });
            }


            res.json({

                success: true,

                messageId:
                    data.id

            });

        } catch (error) {

            console.error(
                "ERROR CORREO:",
                error
            );


            res.status(500).json({

                error:
                    "No se pudo enviar el correo",

                detalle:
                    error.message

            });
        }
    }
);


/* ============================================================
   EXPORT
============================================================ */

module.exports = app;