/* ==========================================================================
   ESTADO GLOBAL Y AUTENTICACIÓN
========================================================================== */

const API_BASE_URL = "https://www.krymtattoo.com";

let adminToken = localStorage.getItem("adminKrymToken") || "";
let isLogged = !!adminToken;

async function adminFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});

    if (adminToken) {
        headers.set("Authorization", `Bearer ${adminToken}`);
    }

    const apiUrl =
        /^https?:\/\//i.test(url)
            ? url
            : `${API_BASE_URL}${url}`;

    return fetch(apiUrl, {
        ...options,
        headers
    });
}

function controlLoginGlobal() {

    if (isLogged) {

        localStorage.removeItem("adminKrymToken");
        localStorage.removeItem("adminKrym");

        adminToken = "";
        isLogged = false;

        document.body.classList.remove("admin-mode");

        actualizarBotonNav();

        alert("Sesión de administrador cerrada.");

        window.location.reload();

        return;
    }

    const password = prompt(
        "Introduce la clave de acceso de administrador:"
    );

    if (!password) return;

    fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            password
        })
    })
        .then(async response => {

            const data =
                await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "Clave incorrecta."
                );
            }

            return data;
        })
        .then(data => {

            if (!data.success || !data.token) {
                throw new Error(
                    "El servidor no devolvió un token válido."
                );
            }

            adminToken = data.token;

            localStorage.setItem(
                "adminKrymToken",
                adminToken
            );

            localStorage.setItem(
                "adminKrym",
                "true"
            );

            isLogged = true;

            document.body.classList.add(
                "admin-mode"
            );

            actualizarBotonNav();

            alert(
                "¡Acceso concedido! Ahora puedes añadir, borrar y mover contenido."
            );

            window.location.reload();
        })
        .catch(error => {

            console.error(error);

            alert(
                error.message ||
                "Error al conectar con el servidor."
            );
        });
}


function actualizarBotonNav() {

    const button =
        document.getElementById("btnStatusLogin");

    if (!button) return;

    button.textContent =
        isLogged
            ? "Cerrar Panel"
            : "Iniciar Sesión";

    button.style.color =
        isLogged
            ? "#d4b58a"
            : "#fff";
}


function escaparHtml(valor) {

    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ==========================================================================
   NAVEGACIÓN
========================================================================== */

function navegarA(id) {

    document
        .querySelectorAll("section")
        .forEach(section => {
            section.classList.remove(
                "active-section"
            );
        });

    document
        .querySelectorAll(".nav-link")
        .forEach(link => {
            link.classList.remove("active");
        });


    const section =
        document.getElementById(id);

    if (section) {
        section.classList.add(
            "active-section"
        );
    }


    document
        .querySelectorAll(".nav-link")
        .forEach(link => {

            const onclick =
                link.getAttribute("onclick") || "";

            if (
                onclick.includes(
                    `'${id}'`
                )
            ) {
                link.classList.add("active");
            }

        });


    const toggle =
        document.getElementById("menu-toggle");

    if (toggle) {
        toggle.checked = false;
    }


    window.scrollTo(0, 0);


    if (id === "contacto") {
        renderCalendar();
    }


    if (id === "inicio") {

        try {
            moveToSlide(
                currentIndex,
                false
            );
        } catch (error) {}
    }
}


function abrirModal(id) {

    const element =
        document.getElementById(id);

    if (element) {
        element.style.display = "flex";
    }
}


function cerrarModal(id) {

    const element =
        document.getElementById(id);

    if (element) {
        element.style.display = "none";
    }
}


/* ==========================================================================
   DRAG & DROP
========================================================================== */

function activarDrag(
    card,
    containerId,
    endpoint
) {

    if (!isLogged) return;

    card.draggable = true;


    card.addEventListener(
        "dragstart",
        event => {

            card.classList.add(
                "dragging"
            );

            event.dataTransfer.effectAllowed =
                "move";

            event.dataTransfer.setData(
                "text/plain",
                card.dataset.id
            );
        }
    );


    card.addEventListener(
        "dragend",
        async () => {

            card.classList.remove(
                "dragging"
            );


            const container =
                document.getElementById(
                    containerId
                );

            if (!container) return;


            const orden =
                Array.from(
                    container.querySelectorAll(
                        "[data-id]"
                    )
                )
                .map(element =>
                    Number(element.dataset.id)
                )
                .filter(id =>
                    Number.isInteger(id)
                );


            if (!orden.length) return;


            try {

                const response =
                    await adminFetch(
                        endpoint,
                        {
                            method: "PUT",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                orden
                            })
                        }
                    );


                const data =
                    await response
                        .json()
                        .catch(() => ({}));


                if (!response.ok) {
                    throw new Error(
                        data.error ||
                        "No se pudo guardar el orden."
                    );
                }


                console.log(
                    "Orden guardado:",
                    orden
                );

            } catch (error) {

                console.error(error);

                alert(
                    error.message ||
                    "No se pudo guardar el nuevo orden."
                );

                window.location.reload();
            }
        }
    );


    card.addEventListener(
        "dragover",
        event => {

            event.preventDefault();


            const dragging =
                document.querySelector(
                    ".dragging"
                );


            if (
                !dragging ||
                dragging === card
            ) {
                return;
            }


            const rectangle =
                card.getBoundingClientRect();


            const antes =
                event.clientY <
                rectangle.top +
                rectangle.height / 2;


            const container =
                document.getElementById(
                    containerId
                );


            if (!container) return;


            if (antes) {

                container.insertBefore(
                    dragging,
                    card
                );

            } else {

                container.insertBefore(
                    dragging,
                    card.nextSibling
                );
            }
        }
    );
}


/* ==========================================================================
   BORRAR
========================================================================== */

async function eliminarElemento(
    endpoint,
    id,
    mensaje
) {

    if (!isLogged || !adminToken) {

        alert(
            "Debes iniciar sesión como administrador."
        );

        return;
    }


    if (!confirm(mensaje)) {
        return;
    }


    try {

        const response =
            await adminFetch(
                `${endpoint}/${id}`,
                {
                    method: "DELETE"
                }
            );


        const data =
            await response
                .json()
                .catch(() => ({}));


        if (!response.ok) {

            throw new Error(
                data.error ||
                "No se pudo eliminar."
            );
        }


        window.location.reload();

    } catch (error) {

        console.error(error);

        alert(
            error.message ||
            "No se pudo eliminar."
        );
    }
}


function eliminarPortfolio(id) {

    eliminarElemento(
        "/api/portfolio",
        id,
        "¿Seguro que quieres eliminar este trabajo?"
    );
}


function eliminarOferta(id) {

    eliminarElemento(
        "/api/ofertas",
        id,
        "¿Seguro que quieres eliminar esta oferta?"
    );
}


function eliminarFaq(id) {

    eliminarElemento(
        "/api/faq",
        id,
        "¿Seguro que quieres eliminar esta pregunta?"
    );
}


/* ==========================================================================
   PORTFOLIO
========================================================================== */

function appendFotoHtml(item) {

    const grid =
        document.getElementById("portfolioGrid");

    if (!grid) return;


    const card =
        document.createElement("div");

    card.className =
        "portfolio-card admin-draggable";

    card.dataset.id =
        item.id;

    card.dataset.category =
        item.estilo || "";


    const cleanSrc =
        String(item.imagen || "")
            .replace(/\\/g, "/");

    const imageSrc =
        /^https?:\/\//i.test(cleanSrc)
            ? cleanSrc
            : `/${cleanSrc.replace(/^\/+/, "")}`;


    card.innerHTML = `

        <img
            class="portfolio-img"
            src="${escaparHtml(imageSrc)}"
            alt="Trabajo de ${escaparHtml(
                item.estilo || "tatuaje"
            )}"
            loading="lazy"
        >

        ${
            isLogged
                ? `
                    <div class="admin-card-actions">

                        <span
                            class="drag-handle"
                            title="Arrastrar para mover">
                            ☷
                        </span>

                        <button
                            type="button"
                            class="admin-delete-btn"
                            title="Eliminar">
                            🗑
                        </button>

                    </div>
                `
                : ""
        }

    `;


    const image =
        card.querySelector(".portfolio-img");

    const lightbox =
        document.getElementById("lightbox");

    const lightboxImg =
        document.getElementById("lightboxImg");


    if (
        image &&
        lightbox &&
        lightboxImg
    ) {

        image.style.cursor =
            "zoom-in";


        image.addEventListener(
            "click",
            event => {

                event.stopPropagation();


                lightboxImg.src =
                    image.src;


                lightboxImg.alt =
                    image.alt;


                lightbox.style.display =
                    "flex";


                setTimeout(
                    () => {

                        lightbox.classList.add(
                            "active"
                        );

                    },
                    10
                );
            }
        );
    }


    if (isLogged) {

        const deleteButton =
            card.querySelector(
                ".admin-delete-btn"
            );


        if (deleteButton) {

            deleteButton.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    event.stopPropagation();


                    eliminarPortfolio(
                        item.id
                    );
                }
            );
        }


        activarDrag(
            card,
            "portfolioGrid",
            "/api/portfolio/reordenar"
        );
    }


    grid.appendChild(card);
}


function savePortfolioItem(event) {

    event.preventDefault();


    if (!isLogged || !adminToken) {

        alert(
            "Debes iniciar sesión como administrador."
        );

        return;
    }


    const formData =
        new FormData(
            event.target
        );


    adminFetch(
        "/api/guardarPortfolio",
        {
            method: "POST",
            body: formData
        }
    )
        .then(async response => {

            const text =
                await response.text();

            if (!response.ok) {
                throw new Error(
                    text ||
                    "Error al subir la imagen."
                );
            }

            return text;
        })
        .then(message => {

            alert(message);

            cerrarModal(
                "modalPortfolio"
            );

            event.target.reset();

            window.location.reload();
        })
        .catch(error => {

            console.error(error);

            alert(
                error.message ||
                "Error al subir la imagen."
            );
        });
}


function cargarPortfolioDesdeBD() {

    const grid =
        document.getElementById(
            "portfolioGrid"
        );

    const filterContainer =
        document.getElementById(
            "filterContainer"
        );


    if (!grid) return;


    fetch(`${API_BASE_URL}/api/portfolio`)
        .then(response => {

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            return response.json();
        })
        .then(data => {

            grid.innerHTML = "";


            if (
                !Array.isArray(data) ||
                data.length === 0
            ) {

                grid.innerHTML =
                    `<p style="
                        color:#fff;
                        grid-column:1/-1;
                        text-align:center;
                    ">
                        No hay trabajos disponibles.
                    </p>`;

                return;
            }


            const estilosUnicos =
                new Set();


            data.forEach(item => {

                appendFotoHtml(item);


                if (item.estilo) {
                    estilosUnicos.add(
                        item.estilo.trim()
                    );
                }
            });


            if (filterContainer) {

                filterContainer.innerHTML =
                    `<button
                        class="filter-btn active"
                        onclick="filtrarEstilo('all', this)">
                        Todos
                    </button>`;


                estilosUnicos.forEach(
                    estilo => {

                        const button =
                            document.createElement(
                                "button"
                            );


                        button.className =
                            "filter-btn";


                        button.textContent =
                            estilo
                                .charAt(0)
                                .toUpperCase() +
                            estilo.slice(1);


                        button.onclick =
                            function () {

                                filtrarEstilo(
                                    estilo,
                                    this
                                );
                            };


                        filterContainer.appendChild(
                            button
                        );
                    }
                );
            }
        })
        .catch(error => {

            console.error(
                "Error cargando portfolio:",
                error
            );


            grid.innerHTML =
                `<p style="
                    color:#fff;
                    grid-column:1/-1;
                    text-align:center;
                ">
                    No se pudo cargar el portafolio.
                </p>`;
        });
}


function filtrarEstilo(
    filterValue,
    button
) {

    document
        .querySelectorAll(".filter-btn")
        .forEach(btn =>
            btn.classList.remove("active")
        );


    if (button) {
        button.classList.add("active");
    }


    document
        .querySelectorAll(
            ".portfolio-card"
        )
        .forEach(card => {

            if (
                filterValue === "all" ||
                card.dataset.category ===
                    filterValue
            ) {
                card.style.display =
                    "block";
            } else {
                card.style.display =
                    "none";
            }
        });
}


/* ==========================================================================
   OFERTAS
========================================================================== */

function saveOfertaItem() {

    if (!isLogged || !adminToken) {

        alert(
            "Debes iniciar sesión como administrador."
        );

        return;
    }


    const titulo =
        document.getElementById(
            "ofTitle"
        ).value;


    const precio =
        document.getElementById(
            "ofPrice"
        ).value;


    const file =
        document.getElementById(
            "ofFile"
        ).files[0];


    if (!titulo || !precio || !file) {

        alert(
            "Completa todos los campos."
        );

        return;
    }


    const formData =
        new FormData();


    formData.append(
        "titulo",
        titulo
    );

    formData.append(
        "precio",
        precio
    );

    formData.append(
        "imagen",
        file
    );


    adminFetch(
        "/api/guardarOferta",
        {
            method: "POST",
            body: formData
        }
    )
        .then(async response => {

            const text =
                await response.text();

            if (!response.ok) {
                throw new Error(
                    text ||
                    "Error al guardar la oferta."
                );
            }

            return text;
        })
        .then(message => {

            alert(message);

            cerrarModal(
                "modalOfertas"
            );

            window.location.reload();
        })
        .catch(error => {

            console.error(error);

            alert(
                error.message ||
                "Error al guardar la oferta."
            );
        });
}


function cargarOfertasDesdeServidor() {

    const container =
        document.getElementById(
            "ofertasContainer"
        );


    if (!container) return;


    fetch(`${API_BASE_URL}/api/ofertas`)
        .then(response => {

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            return response.json();
        })
        .then(ofertas => {

            container.innerHTML = "";


            if (
                !Array.isArray(ofertas) ||
                ofertas.length === 0
            ) {

                container.innerHTML =
                    `<p class="error-msg"
                        style="
                            grid-column:1/-1;
                            text-align:center;
                        ">
                        No hay ofertas disponibles.
                    </p>`;

                return;
            }


            ofertas.forEach(
                oferta => {

                    const card =
                        document.createElement(
                            "div"
                        );


                    card.className =
                        "flash-card admin-draggable";


                    card.dataset.id =
                        oferta.id;


                    const ruta =
                        String(
                            oferta.imagen || ""
                        ).replace(
                            /\\/g,
                            "/"
                        );


                    const imagenUrl =
                        /^https?:\/\//i.test(
                            ruta
                        )
                            ? ruta
                            : `/${ruta.replace(
                                /^\/+/,
                                ""
                            )}`;


                    card.innerHTML = `

                        <img
                            src="${escaparHtml(
                                imagenUrl
                            )}"
                            class="flash-img"
                            alt="${escaparHtml(
                                oferta.titulo
                            )}"
                        >

                        <div class="flash-info">

                            <span class="flash-tag">
                                Disponible
                            </span>

                            <h3 class="flash-title">
                                ${escaparHtml(
                                    oferta.titulo
                                )}
                            </h3>

                            <div class="flash-price">
                                ${escaparHtml(
                                    oferta.precio
                                )}€
                            </div>

                            <button
                                class="btn-principal"
                                onclick="navegarA('contacto')">
                                Reservar
                            </button>

                        </div>

                        ${
                            isLogged
                                ? `
                                    <div class="admin-card-actions">

                                        <span
                                            class="drag-handle"
                                            title="Arrastrar para mover">
                                            ☷
                                        </span>

                                        <button
                                            type="button"
                                            class="admin-delete-btn"
                                            title="Eliminar">
                                            🗑
                                        </button>

                                    </div>
                                `
                                : ""
                        }

                    `;


                    const img =
                        card.querySelector(
                            ".flash-img"
                        );


                    if (img) {

                        img.style.cursor =
                            "zoom-in";


                        img.addEventListener(
                            "click",
                            () => {

                                const lightbox =
                                    document.getElementById(
                                        "lightbox"
                                    );

                                const lightboxImg =
                                    document.getElementById(
                                        "lightboxImg"
                                    );


                                if (
                                    lightbox &&
                                    lightboxImg
                                ) {

                                    lightboxImg.src =
                                        imagenUrl;

                                    lightbox.style.display =
                                        "flex";

                                    setTimeout(
                                        () =>
                                            lightbox.classList.add(
                                                "active"
                                            ),
                                        10
                                    );
                                }
                            }
                        );
                    }


                    if (isLogged) {

                        const deleteButton =
                            card.querySelector(
                                ".admin-delete-btn"
                            );


                        if (deleteButton) {

                            deleteButton.addEventListener(
                                "click",
                                event => {

                                    event.stopPropagation();

                                    eliminarOferta(
                                        oferta.id
                                    );
                                }
                            );
                        }


                        activarDrag(
                            card,
                            "ofertasContainer",
                            "/api/ofertas/reordenar"
                        );
                    }


                    container.appendChild(card);
                }
            );
        })
        .catch(error => {

            console.error(
                "Error cargando ofertas:",
                error
            );


            container.innerHTML =
                `<p class="error-msg"
                    style="
                        grid-column:1/-1;
                        text-align:center;
                    ">
                    No se pudieron cargar las ofertas.
                </p>`;
        });
}


/* ==========================================================================
   FAQ
========================================================================== */

let todasLasPreguntas = [];


async function cargarFaqsDesdeServidor() {

    const faqList =
        document.getElementById(
            "faqList"
        );


    if (!faqList) return;


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/api/faq`,
                {
                    method: "GET",
                    headers: {
                        Accept:
                            "application/json"
                    }
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const faqs =
            await response.json();


        todasLasPreguntas =
            Array.isArray(faqs)
                ? faqs
                : [];


        renderizarFaqs(
            todasLasPreguntas
        );

    } catch (error) {

        console.error(
            "Error cargando FAQ:",
            error
        );


        faqList.innerHTML =
            `<p class="error-msg"
                style="
                    text-align:center;
                    color:#ff6b6b;
                ">
                No se pudieron cargar las preguntas frecuentes.
            </p>`;
    }
}


function renderizarFaqs(listaFaqs) {

    const faqList =
        document.getElementById(
            "faqList"
        );


    if (!faqList) return;


    faqList.innerHTML = "";


    if (
        !Array.isArray(listaFaqs) ||
        listaFaqs.length === 0
    ) {

        faqList.innerHTML =
            `<p class="error-msg"
                style="
                    text-align:center;
                    color:#888;
                ">
                No se encontraron preguntas.
            </p>`;

        return;
    }


    listaFaqs.forEach(faq => {

        const item =
            document.createElement(
                "div"
            );


        item.className =
            "faq-item admin-draggable";


        item.dataset.id =
            faq.id;


        const pregunta =
            String(
                faq.pregunta ?? ""
            );


        const respuesta =
            String(
                faq.respuesta ?? ""
            );


        item.innerHTML = `

            <div class="faq-question">

                ${escaparHtml(
                    pregunta
                )}

                <span>+</span>

            </div>

            <div class="faq-answer">

                ${escaparHtml(
                    respuesta
                ).replace(
                    /\n/g,
                    "<br>"
                )}

            </div>

            ${
                isLogged
                    ? `
                        <div class="admin-card-actions">

                            <span
                                class="drag-handle"
                                title="Arrastrar para mover">
                                ☷
                            </span>

                            <button
                                type="button"
                                class="admin-delete-btn"
                                title="Eliminar">
                                🗑
                            </button>

                        </div>
                    `
                    : ""
            }

        `;


        const question =
            item.querySelector(
                ".faq-question"
            );


        if (question) {

            question.addEventListener(
                "click",
                () => {

                    item.classList.toggle(
                        "open"
                    );
                }
            );
        }


        if (isLogged) {

            const deleteButton =
                item.querySelector(
                    ".admin-delete-btn"
                );


            if (deleteButton) {

                deleteButton.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        eliminarFaq(
                            faq.id
                        );
                    }
                );
            }


            activarDrag(
                item,
                "faqList",
                "/api/faq/reordenar"
            );
        }


        faqList.appendChild(item);
    });
}


function buscarPreguntas() {

    const input =
        document.getElementById(
            "faqSearch"
        );


    if (!input) return;


    const query =
        input.value
            .toLowerCase()
            .trim();


    const filtradas =
        todasLasPreguntas.filter(
            faq => {

                const pregunta =
                    String(
                        faq.pregunta ?? ""
                    ).toLowerCase();


                const respuesta =
                    String(
                        faq.respuesta ?? ""
                    ).toLowerCase();


                return (
                    pregunta.includes(query) ||
                    respuesta.includes(query)
                );
            }
        );


    renderizarFaqs(
        filtradas
    );
}


function saveFaqItem() {

    if (!isLogged || !adminToken) {

        alert(
            "Debes iniciar sesión como administrador."
        );

        return;
    }


    const pregunta =
        document.getElementById(
            "faqQ"
        ).value.trim();


    const respuesta =
        document.getElementById(
            "faqA"
        ).value.trim();


    if (!pregunta || !respuesta) {

        alert(
            "Completa todos los campos."
        );

        return;
    }


    adminFetch(
        "/api/guardarFaq",
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({
                pregunta,
                respuesta
            })
        }
    )
        .then(async response => {

            const data =
                await response
                    .json()
                    .catch(() => ({}));


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "No se pudo guardar la FAQ."
                );
            }


            return data;
        })
        .then(() => {

            alert(
                "Pregunta guardada correctamente."
            );

            cerrarModal(
                "modalFaq"
            );

            window.location.reload();
        })
        .catch(error => {

            console.error(error);

            alert(
                error.message ||
                "Error al guardar la pregunta."
            );
        });
}


/* ==========================================================================
   CALENDARIO
========================================================================== */

let currentYear = 2026;
let currentMonth = 6;

let festivos = [];

try {

    festivos =
        JSON.parse(
            localStorage.getItem(
                "kFestivos"
            ) || "[]"
        );

} catch (error) {

    festivos = [];
}


let modoGestionFestivos = false;


const mesesNombres = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre"
];


function activarModoGestionFestivos() {

    modoGestionFestivos =
        !modoGestionFestivos;


    const helper =
        document.getElementById(
            "adminHollidayHelper"
        );


    if (helper) {

        helper.style.display =
            modoGestionFestivos
                ? "block"
                : "none";
    }


    alert(
        modoGestionFestivos
            ? "Modo de gestión de festivos activado."
            : "Modo gestión cerrado."
    );
}


function renderCalendar() {

    const grid =
        document.getElementById(
            "calendarGrid"
        );


    if (!grid) return;


    const title =
        document.getElementById(
            "calendarMonthTitle"
        );


    if (title) {

        title.textContent =
            `${mesesNombres[currentMonth]} ${currentYear}`;
    }


    grid.innerHTML = "";


    const diasSemana = [
        "L",
        "M",
        "X",
        "J",
        "V",
        "S",
        "D"
    ];


    diasSemana.forEach(day => {

        const element =
            document.createElement(
                "div"
            );

        element.className =
            "calendar-day-name";

        element.textContent =
            day;

        grid.appendChild(element);
    });


    let firstDay =
        new Date(
            currentYear,
            currentMonth,
            1
        ).getDay();


    firstDay =
        firstDay === 0
            ? 6
            : firstDay - 1;


    const totalDays =
        new Date(
            currentYear,
            currentMonth + 1,
            0
        ).getDate();


    for (
        let i = 0;
        i < firstDay;
        i++
    ) {

        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "calendar-day empty";

        grid.appendChild(empty);
    }


    for (
        let day = 1;
        day <= totalDays;
        day++
    ) {

        const dayBox =
            document.createElement(
                "div"
            );


        dayBox.className =
            "calendar-day";


        dayBox.textContent =
            day;


        const dateString =
            `${currentYear}-${String(
                currentMonth + 1
            ).padStart(2, "0")}-${String(
                day
            ).padStart(2, "0")}`;


        if (
            festivos.includes(
                dateString
            )
        ) {

            dayBox.classList.add(
                "festivo"
            );
        }


        dayBox.addEventListener(
            "click",
            () => {

                if (
                    modoGestionFestivos
                ) {

                    if (
                        festivos.includes(
                            dateString
                        )
                    ) {

                        festivos =
                            festivos.filter(
                                date =>
                                    date !==
                                    dateString
                            );

                    } else {

                        festivos.push(
                            dateString
                        );
                    }


                    localStorage.setItem(
                        "kFestivos",
                        JSON.stringify(
                            festivos
                        )
                    );


                    renderCalendar();

                    return;
                }


                if (
                    festivos.includes(
                        dateString
                    )
                ) {

                    alert(
                        "Este día es festivo/no laborable."
                    );

                    return;
                }


                document
                    .querySelectorAll(
                        ".calendar-day"
                    )
                    .forEach(
                        element =>
                            element.classList.remove(
                                "selected"
                            )
                    );


                dayBox.classList.add(
                    "selected"
                );


                const input =
                    document.getElementById(
                        "selectedDateInput"
                    );


                if (input) {
                    input.value =
                        dateString;
                }


                const display =
                    document.getElementById(
                        "formDateDisplay"
                    );


                if (display) {

                    display.value =
                        `Día seleccionado: ${day} de ${mesesNombres[currentMonth]}`;
                }
            }
        );


        grid.appendChild(
            dayBox
        );
    }
}


function cambiarMes(dir) {

    currentMonth += dir;


    if (currentMonth > 11) {

        currentMonth = 0;
        currentYear++;
    }


    if (currentMonth < 0) {

        currentMonth = 11;
        currentYear--;
    }


    renderCalendar();
}


/* ==========================================================================
   CORREO
========================================================================== */

function enviarCorreoCita(event) {

    event.preventDefault();


    const fileInput =
        document.getElementById("formFile") ||
        document.getElementById("formFoto");


    const file =
        fileInput &&
        fileInput.files
            ? fileInput.files[0]
            : null;


    const formData =
        new FormData();


    formData.append(
        "nombre",
        document.getElementById(
            "formName"
        ).value
    );


    formData.append(
        "email",
        document.getElementById(
            "formEmail"
        ).value
    );


    formData.append(
        "idea",
        document.getElementById(
            "formIdea"
        ).value
    );


    const fechaInput = document.getElementById("selectedDateInput");
    if (fechaInput) {
        formData.append("fecha", fechaInput.value);
    }


    if (file) {

        formData.append(
            "imagen",
            file
        );
    }


    fetch(
        `${API_BASE_URL}/api/citas-correo`,
        {
            method: "POST",
            body: formData
        }
    )
        .then(async response => {

            const data =
                await response
                    .json()
                    .catch(() => ({}));


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Error al enviar el correo."
                );
            }


            return data;
        })
        .then(() => {

            alert(
                "¡Tu propuesta de diseño ha sido enviada con éxito! Nos pondremos en contacto contigo pronto."
            );


            const form =
                document.getElementById(
                    "appointmentForm"
                );


            if (form) {
                form.reset();
            }
        })
        .catch(error => {

            console.error(
                "Error en el envío:",
                error
            );


            alert(
                error.message ||
                "Hubo un inconveniente al enviar tu idea."
            );
        });
}


/* ==========================================================================
   CARRUSEL (CENTRADO DINÁMICO Y ESTADO ACTIVO)
========================================================================== */

let currentIndex = 0;
let carouselTouchStartX = 0;
let carouselTouchStartY = 0;
let carouselTouchEndX = 0;
let carouselTouching = false;

function cargarCarruselDestacados() {

    const track = document.getElementById("carouselTrack") || document.querySelector(".carousel-track");
    const lightbox = document.getElementById("lightbox");
    const lightboxImg = document.getElementById("lightboxImg");
    const lightboxClose = document.querySelector(".lightbox-close");

    if (!track) return;

    fetch(`${API_BASE_URL}/api/portfolio`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(tattoos => {
            track.innerHTML = "";

            if (!Array.isArray(tattoos) || tattoos.length === 0) {
                track.innerHTML = '<p class="error-msg">No hay trabajos destacados.</p>';
                return;
            }

            // Cinco copias: siempre hay fotos a ambos lados de la central.
            const repeated = [];
            for (let r = 0; r < 5; r++) tattoos.forEach(t => repeated.push(t));

            repeated.forEach((tattoo, index) => {
                const item = document.createElement("div");
                item.className = "carousel-item";
                item.dataset.originalIndex = index % tattoos.length;

                const image = document.createElement("img");
                const clean = String(tattoo.imagen || "").replace(/\\/g, "/");
                image.src = /^https?:\/\//i.test(clean) ? clean : `/${clean.replace(/^\/+/, "")}`;
                image.alt = `Tatuaje ${tattoo.estilo || "Krym"}`;
                image.draggable = false;

                if (lightbox && lightboxImg) {
                    image.addEventListener("click", event => {
                        event.stopPropagation();
                        lightboxImg.src = image.src;
                        lightbox.style.display = "flex";
                        setTimeout(() => lightbox.classList.add("active"), 10);
                    });
                }

                item.appendChild(image);
                track.appendChild(item);
            });

            // Arrancamos en la copia central, nunca en un extremo.
            currentIndex = tattoos.length * 2;
            iniciarLogicaCarrusel();
        })
        .catch(error => {
            console.error("Error cargando carrusel:", error);
            track.innerHTML = '<p class="error-msg">No se pudieron cargar los trabajos.</p>';
        });

    if (lightbox && lightboxClose) {
        lightboxClose.onclick = cerrarLightbox;
        lightbox.addEventListener("click", event => {
            if (event.target !== lightboxImg && event.target !== lightboxClose) cerrarLightbox();
        });
    }
}

function cerrarLightbox() {
    const lightbox = document.getElementById("lightbox");
    const image = document.getElementById("lightboxImg");
    if (!lightbox) return;
    lightbox.classList.remove("active");
    setTimeout(() => {
        lightbox.style.display = "none";
        if (image) image.src = "";
    }, 300);
}

function iniciarLogicaCarrusel() {
    const container = document.getElementById("carouselContainer") || document.querySelector(".carousel-container");
    const track = document.getElementById("carouselTrack") || document.querySelector(".carousel-track");
    if (!container || !track) return;

    const items = Array.from(track.querySelectorAll(".carousel-item"));
    if (!items.length) return;

    const nextButton = document.querySelector(".next-btn");
    const prevButton = document.querySelector(".prev-btn");

    if (nextButton) nextButton.onclick = () => moveToSlide(currentIndex + 1);
    if (prevButton) prevButton.onclick = () => moveToSlide(currentIndex - 1);

    // Swipe móvil.
    container.ontouchstart = event => {
        if (!event.touches.length) return;
        carouselTouchStartX = event.touches[0].clientX;
        carouselTouchStartY = event.touches[0].clientY;
        carouselTouchEndX = carouselTouchStartX;
        carouselTouching = true;
    };

    container.ontouchmove = event => {
        if (!carouselTouching || !event.touches.length) return;
        carouselTouchEndX = event.touches[0].clientX;
    };

    container.ontouchend = () => {
        if (!carouselTouching) return;
        carouselTouching = false;
        const deltaX = carouselTouchEndX - carouselTouchStartX;
        if (Math.abs(deltaX) < 45) return;
        moveToSlide(currentIndex + (deltaX < 0 ? 1 : -1));
    };

    requestAnimationFrame(() => moveToSlide(currentIndex, false));
}

function moveToSlide(index, animate = true) {
    const container = document.getElementById("carouselContainer") || document.querySelector(".carousel-container");
    const track = document.getElementById("carouselTrack") || document.querySelector(".carousel-track");
    if (!track || !container) return;

    const items = Array.from(track.querySelectorAll(".carousel-item"));
    if (!items.length) return;

    // El track contiene 5 copias del portfolio.
    const originalCount = Math.max(1, Math.floor(items.length / 5));

    // Si llegamos a un extremo, saltamos al bloque central equivalente.
    // El salto es invisible porque la imagen es la misma.
    if (index < originalCount) index += originalCount * 2;
    if (index >= originalCount * 4) index -= originalCount * 2;

    index = ((index % items.length) + items.length) % items.length;
    currentIndex = index;

    items.forEach((item, i) => item.classList.toggle("active-center", i === currentIndex));

    const activeItem = items[currentIndex];
    if (!activeItem) return;

    const containerWidth = container.offsetWidth || container.clientWidth;
    const itemCenter = activeItem.offsetLeft + activeItem.offsetWidth / 2;
    const targetTranslate = containerWidth / 2 - itemCenter;

    track.style.transition = animate
        ? "transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)"
        : "none";
    track.style.transform = `translate3d(${targetTranslate}px, 0, 0)`;
}

/* ==========================================================================
   INICIALIZACIÓN
========================================================================== */

function inicializarApp() {

    actualizarBotonNav();


    if (isLogged) {

        document.body.classList.add(
            "admin-mode"
        );
    }


    const formPortfolio =
        document.getElementById(
            "form-portfolio"
        );


    if (formPortfolio) {

        formPortfolio.addEventListener(
            "submit",
            savePortfolioItem
        );
    }


    renderCalendar();

    cargarPortfolioDesdeBD();

    cargarOfertasDesdeServidor();

    cargarFaqsDesdeServidor();

    cargarCarruselDestacados();
}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        inicializarApp
    );

} else {

    inicializarApp();
}