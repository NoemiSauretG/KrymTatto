/* ==========================================================================
    ESTADO GLOBAL Y AUTENTICACIÓN
========================================================================== */
let isLogged = localStorage.getItem('adminKrym') === 'true';

function controlLoginGlobal() {
    if (isLogged) {
        localStorage.removeItem('adminKrym');
        isLogged = false;
        document.body.classList.remove('admin-mode');

        if (document.getElementById('adminHollidayHelper')) {
            document.getElementById('adminHollidayHelper').style.display = 'none';
        }

        actualizarBotonNav();
        alert('Sesión de administrador cerrada.');
        window.location.reload();
    } else {
        let p = prompt('Introduce la clave de acceso de administrador:');
        if (!p) return;

        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: p })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    localStorage.setItem('adminKrym', 'true');
                    isLogged = true;
                    document.body.classList.add('admin-mode');
                    actualizarBotonNav();
                    alert('¡Acceso concedido! Las opciones de edición han sido desbloqueadas.');
                } else {
                    alert('Clave incorrecta.');
                }
            })
            .catch(() => {
                alert('Error al intentar conectar con el servidor de autenticación.');
            });
    }
}

function actualizarBotonNav() {
    const btn = document.getElementById('btnStatusLogin');
    if (btn) {
        btn.textContent = isLogged ? "Cerrar Panel" : "Iniciar Sesión";
        btn.style.color = isLogged ? "#d4b58a" : "#fff";
    }
}


/* ==========================================================================
    NAVEGACIÓN Y MODALES
========================================================================== */
function navegarA(id) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-section'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const targetSection = document.getElementById(id);
    if (targetSection) {
        targetSection.classList.add('active-section');
    }

    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(`'${id}'`)) {
            link.classList.add('active');
        }
    });

    const toggle = document.getElementById('menu-toggle');
    if (toggle) {
        toggle.checked = false;
    }

    window.scrollTo(0, 0);

    if (id === 'contacto') {
        renderCalendar();
    }

    if (id === 'inicio') {
        try {
            moveToSlide(currentIndex, false);
        } catch (err) {}
    }
}

function abrirModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
}

function cerrarModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}


/* ==========================================================================
    PORTFOLIO (DOM Y GUARDADO)
========================================================================== */
function appendFotoHtml(src, cat) {
    const grid = document.getElementById('portfolioGrid');
    if (!grid) return;

    const card = document.createElement('div');
    card.className = 'portfolio-card';
    card.setAttribute('data-category', cat);

    const cleanSrc = String(src || '').replace(/\\/g, '/');
    const imageSrc = /^https?:\/\//i.test(cleanSrc)
        ? cleanSrc
        : `/${cleanSrc.replace(/^\/+/, '')}`;

    card.innerHTML = `<img src="${imageSrc}" alt="Trabajo de ${cat}">`;
    grid.insertBefore(card, grid.firstChild);
}

function savePortfolioItem(e) {
    e.preventDefault();
    const formData = new FormData(e.target);

    fetch('/guardarPortfolio', {
        method: 'POST',
        body: formData // Envía tanto el archivo como los campos de texto
    })
    .then(res => {
        if (!res.ok) throw new Error();
        return res.text();
    })
    .then(msg => {
        alert(msg);
        cerrarModal('modalPortfolio');
        e.target.reset();
        window.location.reload();
    })
    .catch(() => {
        alert('Error al subir la imagen.');
    });
}

function cargarPortfolioDesdeBD() {
    const grid = document.getElementById('portfolioGrid');
    const filterContainer = document.getElementById('filterContainer');
    if (!grid) return;

    fetch('/api/portfolio')
        .then(res => {
            if (!res.ok) throw new Error("No se pudo conectar con la BD");
            return res.json();
        })
        .then(data => {
            grid.innerHTML = '';

            if (!Array.isArray(data) || data.length === 0) {
                grid.innerHTML = '<p style="color: #fff; grid-column: 1/-1; text-align: center;">No hay trabajos disponibles.</p>';
                return;
            }

            const estilosUnicos = new Set();

            data.forEach(item => {
                appendFotoHtml(item.imagen, item.estilo);
                if (item.estilo) {
                    estilosUnicos.add(item.estilo.trim());
                }
            });

            if (filterContainer) {
                filterContainer.innerHTML = '<button class="filter-btn active" onclick="filtrarEstilo(\'all\', this)">Todos</button>';

                estilosUnicos.forEach(estilo => {
                    const boton = document.createElement('button');
                    boton.className = 'filter-btn';
                    boton.textContent = estilo.charAt(0).toUpperCase() + estilo.slice(1);
                    boton.onclick = function () {
                        filtrarEstilo(estilo, this);
                    };
                    filterContainer.appendChild(boton);
                });
            }
        })
        .catch(err => {
            console.error("Error cargando el portfolio:", err);
            grid.innerHTML = '<p style="color: #fff; grid-column: 1/-1; text-align: center;">No se pudo cargar el portafolio.</p>';
        });
}

function filtrarEstilo(filterValue, button) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    document.querySelectorAll('.portfolio-card').forEach(card => {
        if (filterValue === 'all' || card.getAttribute('data-category') === filterValue) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}


/* ==========================================================================
    OFERTAS (DOM Y GUARDADO)
========================================================================== */
function saveOfertaItem() {
    const t = document.getElementById('ofTitle').value;
    const p = document.getElementById('ofPrice').value;
    const f = document.getElementById('ofFile').files[0];

    if (!t || !p || !f) {
        return alert('Completa todos los campos.');
    }

    const formData = new FormData();
    formData.append('titulo', t);
    formData.append('precio', p);
    formData.append('imagen', f);

    fetch('/guardarOferta', {
        method: 'POST',
        body: formData
    })
        .then(res => {
            if (!res.ok) throw new Error();
            return res.text();
        })
        .then(msg => {
            alert(msg);
            cerrarModal('modalOfertas');
            window.location.reload();
        })
        .catch(() => {
            alert('Error al guardar la oferta.');
        });
}

function cargarOfertasDesdeServidor() {
    const ofertasContainer = document.getElementById('ofertasContainer');
    if (!ofertasContainer) return;

    fetch('/api/ofertas')
        .then(response => {
            if (!response.ok) throw new Error('Error al conectar con la API de ofertas');
            return response.json();
        })
        .then(ofertas => {
            ofertasContainer.innerHTML = '';

            if (!Array.isArray(ofertas) || ofertas.length === 0) {
                ofertasContainer.innerHTML = '<p class="error-msg" style="grid-column: 1/-1; text-align: center;">No hay ofertas disponibles en este momento.</p>';
                return;
            }

            ofertas.forEach(oferta => {
                const card = document.createElement('div');
                card.className = 'flash-card';

                const rutaLimpia = String(oferta.imagen || '').replace(/\\/g, '/');
                const imagenUrl = /^https?:\/\//i.test(rutaLimpia)
                    ? rutaLimpia
                    : `/${rutaLimpia.replace(/^\/+/, '')}`;

                card.innerHTML = `
                    <img src="${imagenUrl}" class="flash-img" alt="${oferta.titulo}">
                    <div class="flash-info">
                        <span class="flash-tag">Disponible</span>
                        <h3 class="flash-title">${oferta.titulo}</h3>
                        <div class="flash-price">${oferta.precio}€</div>
                        <button class="btn-principal" onclick="navegarA('contacto')">Reservar</button>
                    </div>
                `;

                const imgElement = card.querySelector('.flash-img');
                imgElement.style.cursor = 'zoom-in';
                imgElement.addEventListener('click', () => {
                    const lightbox = document.getElementById('lightbox');
                    const lightboxImg = document.getElementById('lightboxImg');
                    if (lightbox && lightboxImg) {
                        lightboxImg.src = imagenUrl;
                        lightbox.style.display = 'flex';
                        setTimeout(() => lightbox.classList.add('active'), 10);
                    }
                });

                ofertasContainer.appendChild(card);
            });
        })
        .catch(err => {
            console.error('Error al renderizar ofertas:', err);
            ofertasContainer.innerHTML = '<p class="error-msg" style="grid-column: 1/-1; text-align: center;">No se pudieron cargar las ofertas.</p>';
        });
}


/* ==========================================================================
    FAQ (DESDE RAILWAY / MYSQL)
========================================================================== */
let todasLasPreguntas = [];

async function cargarFaqsDesdeServidor() {
    const faqList = document.getElementById('faqList');
    if (!faqList) return;

    try {
        const response = await fetch('/api/faq', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}`);
        }

        const faqs = await response.json();
        todasLasPreguntas = Array.isArray(faqs) ? faqs : [];
        renderizarFaqs(todasLasPreguntas);

    } catch (err) {
        console.error('Error al renderizar las FAQs:', err);
        faqList.innerHTML = '<p class="error-msg" style="text-align: center; color:#ff6b6b;">No se pudieron cargar las preguntas frecuentes.</p>';
    }
}

function renderizarFaqs(listaFaqs) {
    const faqList = document.getElementById('faqList');
    if (!faqList) return;

    faqList.innerHTML = '';

    if (!Array.isArray(listaFaqs) || listaFaqs.length === 0) {
        faqList.innerHTML = '<p class="error-msg" style="text-align: center; color: #888;">No se encontraron preguntas.</p>';
        return;
    }

    listaFaqs.forEach(faq => {
        const faqItem = document.createElement('div');
        faqItem.className = 'faq-item';

        const pregunta = String(faq.pregunta ?? '');
        const respuesta = String(faq.respuesta ?? '').replace(/\n/g, '<br>');

        faqItem.innerHTML = `
            <div class="faq-question">
                ${pregunta}
                <span>+</span>
            </div>
            <div class="faq-answer">
                ${respuesta}
            </div>
        `;

        faqItem.querySelector('.faq-question').addEventListener('click', () => {
            faqItem.classList.toggle('open');
        });

        faqList.appendChild(faqItem);
    });
}

function buscarPreguntas() {
    const input = document.getElementById('faqSearch');
    if (!input) return;

    const query = input.value.toLowerCase().trim();

    const faqsFiltradas = todasLasPreguntas.filter(faq => {
        const pregunta = String(faq.pregunta ?? '').toLowerCase();
        const respuesta = String(faq.respuesta ?? '').toLowerCase();
        return pregunta.includes(query) || respuesta.includes(query);
    });

    renderizarFaqs(faqsFiltradas);
}

function saveFaqItem() {
    const q = document.getElementById('faqQ').value;
    const a = document.getElementById('faqA').value;

    if (!q || !a) {
        return alert('Completa todos los campos.');
    }

    fetch('/guardarFaq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: q, respuesta: a })
    })
        .then(res => {
            if (!res.ok) throw new Error();
            return res.text();
        })
        .then(msg => {
            alert(msg);
            cerrarModal('modalFaq');
            window.location.reload();
        })
        .catch(() => {
            alert('Error al guardar la duda en el servidor.');
        });
}


/* ==========================================================================
    CALENDARIO Y FORMULARIO DE RESERVA
========================================================================== */
let currentYear = 2026;
let currentMonth = 6;
let festivos = [];

try {
    festivos = JSON.parse(localStorage.getItem('kFestivos') || '[]');
} catch (e) {}

let modoGestionFestivos = false;
const mesesNombres = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function activarModoGestionFestivos() {
    modoGestionFestivos = !modoGestionFestivos;
    const helper = document.getElementById('adminHollidayHelper');
    if (helper) {
        helper.style.display = modoGestionFestivos ? 'block' : 'none';
    }
    alert(modoGestionFestivos ? 'Modo de gestión de festivos activado.' : 'Modo gestión cerrado.');
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;

    const title = document.getElementById('calendarMonthTitle');
    if (title) {
        title.textContent = `${mesesNombres[currentMonth]} ${currentYear}`;
    }

    grid.innerHTML = '';
    const diasSemana = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

    diasSemana.forEach(d => {
        const box = document.createElement('div');
        box.className = 'calendar-day-name';
        box.textContent = d;
        grid.appendChild(box);
    });

    let primerDia = new Date(currentYear, currentMonth, 1).getDay();
    primerDia = primerDia === 0 ? 6 : primerDia - 1;
    const totalDias = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let i = 0; i < primerDia; i++) {
        const em = document.createElement('div');
        em.className = 'calendar-day empty';
        grid.appendChild(em);
    }

    for (let d = 1; d <= totalDias; d++) {
        const dayBox = document.createElement('div');
        dayBox.className = 'calendar-day';
        dayBox.textContent = d;

        const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        if (festivos.includes(dateString)) {
            dayBox.classList.add('festivo');
        }

        dayBox.addEventListener('click', () => {
            if (modoGestionFestivos) {
                if (festivos.includes(dateString)) {
                    festivos = festivos.filter(f => f !== dateString);
                } else {
                    festivos.push(dateString);
                }
                localStorage.setItem('kFestivos', JSON.stringify(festivos));
                renderCalendar();
            } else {
                if (festivos.includes(dateString)) {
                    return alert('Este día es festivo/no laborable.');
                }

                document.querySelectorAll('.calendar-day').forEach(cd => cd.classList.remove('selected'));
                dayBox.classList.add('selected');

                const inputDate = document.getElementById('selectedDateInput');
                if (inputDate) inputDate.value = dateString;

                const display = document.getElementById('formDateDisplay');
                if (display) {
                    display.value = `Día seleccionado: ${d} de ${mesesNombres[currentMonth]}`;
                }
            }
        });

        grid.appendChild(dayBox);
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

function enviarCorreoCita(e) {
    e.preventDefault();
    const fileInput = document.getElementById('formFoto');
    const fotoArchivo = fileInput && fileInput.files ? fileInput.files[0] : null;

    const formData = new FormData();
    formData.append('nombre', document.getElementById('formName').value);
    formData.append('email', document.getElementById('formEmail').value);
    formData.append('idea', document.getElementById('formIdea').value);

    if (fotoArchivo) {
        formData.append('imagen', fotoArchivo);
    }

    fetch('/api/citas-correo', {
        method: 'POST',
        body: formData
    })
        .then(res => {
            if (!res.ok) throw new Error('Error en el servidor al procesar el correo');
            return res.json();
        })
        .then(() => {
            alert('¡Tu propuesta de diseño ha sido enviada con éxito! Nos pondremos en contacto contigo pronto.');
            document.getElementById('appointmentForm').reset();
        })
        .catch(err => {
            console.error("Error en el envío:", err);
            alert('Hubo un inconveniente al enviar tu idea. Por favor, inténtalo de nuevo.');
        });
}


/* ==========================================================================
    CARRUSEL PRINCIPAL
========================================================================== */
let currentIndex = 2;
let step = 330;

function cargarCarruselDestacados() {
    const track = document.getElementById('carouselTrack');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.querySelector('.lightbox-close');

    if (!track) return;

    fetch('/api/portfolio')
        .then(response => {
            if (!response.ok) throw new Error('Error en la red');
            return response.json();
        })
        .then(tattoos => {
            track.innerHTML = '';

            if (!Array.isArray(tattoos) || tattoos.length === 0) {
                track.innerHTML = '<p class="error-msg">No hay trabajos destacados.</p>';
                return;
            }

            tattoos.forEach(tattoo => {
                const item = document.createElement('div');
                item.className = 'carousel-item';

                const img = document.createElement('img');
                const rutaLimpia = String(tattoo.imagen || '').replace(/\\/g, '/');
                const imagenUrl = /^https?:\/\//i.test(rutaLimpia)
                    ? rutaLimpia
                    : `/${rutaLimpia.replace(/^\/+/, '')}`;

                img.src = imagenUrl;
                img.alt = `Tatuaje ${tattoo.estilo || 'Krym'}`;

                if (lightbox && lightboxImg) {
                    img.addEventListener('click', () => {
                        lightboxImg.src = img.src;
                        lightbox.style.display = 'flex';
                        setTimeout(() => lightbox.classList.add('active'), 10);
                    });
                }

                item.appendChild(img);
                track.appendChild(item);
            });

            iniciarLogicaCarrusel();
        })
        .catch(err => {
            console.error('Error cargando carrusel:', err);
            track.innerHTML = '<p class="error-msg">No se pudieron cargar los trabajos.</p>';
        });

    if (lightbox && lightboxClose) {
        lightboxClose.addEventListener('click', cerrarLightbox);
        lightbox.addEventListener('click', e => {
            if (e.target !== lightboxImg && e.target !== lightboxClose) {
                cerrarLightbox();
            }
        });
    }
}

function cerrarLightbox() {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    if (!lightbox) return;

    lightbox.classList.remove('active');
    setTimeout(() => {
        lightbox.style.display = 'none';
        if (lightboxImg) lightboxImg.src = '';
    }, 300);
}

function iniciarLogicaCarrusel() {
    const container = document.getElementById('carouselContainer');
    const track = document.getElementById('carouselTrack');
    if (!track || !container) return;

    let items = Array.from(track.children);
    if (items.length === 0) return;

    const nextBtn = document.querySelector('.next-btn');
    const prevBtn = document.querySelector('.prev-btn');
    const gap = 30;
    const itemWidth = 300;
    step = itemWidth + gap;

    if (nextBtn) {
        nextBtn.onclick = () => moveToSlide(currentIndex + 1);
    }
    if (prevBtn) {
        prevBtn.onclick = () => moveToSlide(currentIndex - 1);
    }

    moveToSlide(currentIndex, false);
}

function moveToSlide(index, animate = true) {
    const container = document.getElementById('carouselContainer');
    const track = document.getElementById('carouselTrack');
    if (!track || !container) return;

    const items = Array.from(track.children);
    if (items.length === 0) return;

    if (animate) {
        track.style.transition = "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)";
    } else {
        track.style.transition = "none";
    }

    const containerWidth = container.offsetWidth;
    const offset = (index * step) - (containerWidth / 2) + (300 / 2);
    track.style.transform = `translateX(${-offset}px)`;

    currentIndex = index;

    items.forEach((item, idx) => {
        if (idx === currentIndex) {
            item.classList.add('active-center');
        } else {
            item.classList.remove('active-center');
        }
    });
}


/* ==========================================================================
    INICIALIZACIÓN SEGUIRA DE EVENTOS
========================================================================== */
function inicializarApp() {
    actualizarBotonNav();

    if (isLogged) {
        document.body.classList.add('admin-mode');
    }

    const formPortfolio = document.getElementById('form-portfolio');
    if (formPortfolio) {
        formPortfolio.addEventListener('submit', savePortfolioItem);
    }

    renderCalendar();
    cargarPortfolioDesdeBD();
    cargarOfertasDesdeServidor();
    cargarFaqsDesdeServidor();
    cargarCarruselDestacados();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarApp);
} else {
    inicializarApp();
}