// Intentar EmailJS de forma segura
try {
    emailjs.init("4u42C2_23AP6nOlI3"); 
} catch(e) { console.log("EmailJS no cargado aún."); }

/* --------------------------------------------------------------------------
    LOGIN / LOGOUT GLOBAL (Sincronizado con API Backend)
    -------------------------------------------------------------------------- */
const IS_ADMIN_PAGE = /(^|\/)admin\.html$/i.test(window.location.pathname);
let adminToken = sessionStorage.getItem('adminToken') || '';
let isLogged = IS_ADMIN_PAGE && !!adminToken;

// Añadir cargador de eventos iniciales seguro
document.addEventListener('DOMContentLoaded', () => {
    actualizarBotonNav();
    if(IS_ADMIN_PAGE && isLogged) document.body.classList.add('admin-mode');
    
    // Escuchador dinámico para el formulario del portfolio (evita error tipo MIME / ?imagen=...)
    const formPortfolio = document.getElementById('form-portfolio');
    if(formPortfolio) {
        formPortfolio.addEventListener('submit', savePortfolioItem);
    }
    
    renderCalendar();
});

function controlLoginGlobal() {
    if (!IS_ADMIN_PAGE) return;

    if (isLogged) {
        sessionStorage.removeItem('adminToken');
        adminToken = '';
        isLogged = false;
        document.body.classList.remove('admin-mode');
        actualizarBotonNav();
        window.location.reload();
        return;
    }

    const p = prompt('Introduce la clave de acceso de administrador:');
    if (!p) return;

    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: p })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success && data.token) {
            sessionStorage.setItem('adminToken', data.token);
            adminToken = data.token;
            isLogged = true;
            document.body.classList.add('admin-mode');
            actualizarBotonNav();
            window.location.reload();
        } else {
            alert('Clave incorrecta.');
        }
    })
    .catch(() => alert('Error al intentar conectar con el servidor de autenticación.'));
}

function actualizarBotonNav() {
    const btn = document.getElementById('btnStatusLogin');
    if(btn) {
        btn.textContent = isLogged ? "Cerrar Panel" : "Iniciar Sesión";
        btn.style.color = isLogged ? "#d4b58a" : "#fff";
    }
}

/* --------------------------------------------------------------------------
    NAVEGACIÓN DE SECCIONES
    -------------------------------------------------------------------------- */
function navegarA(id) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-section'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    const targetSection = document.getElementById(id);
    if(targetSection) targetSection.classList.add('active-section');
    
    document.querySelectorAll('.nav-link').forEach(link => {
        if(link.getAttribute('onclick') && link.getAttribute('onclick').includes(`'${id}'`)) {
            link.classList.add('active');
        }
    });

    const toggle = document.getElementById('menu-toggle');
    if(toggle) toggle.checked = false;

    window.scrollTo(0,0);
    if(id === 'contacto') renderCalendar();
    if(id === 'inicio') {
        try { moveToSlide(currentIndex, false); } catch(err) {}
    }
}

function abrirModal(id) { document.getElementById(id).style.display = 'flex'; }
function cerrarModal(id) { document.getElementById(id).style.display = 'none'; }

/* --------------------------------------------------------------------------
    ENVÍO DE DATOS AL BACKEND (MYSQL) Y RENDERIZADOS
    -------------------------------------------------------------------------- */
function appendFotoHtml(item) {
    const grid = document.getElementById('portfolioGrid');
    if (!grid) return;
    const card = document.createElement('div');
    card.className = 'portfolio-card admin-draggable';
    card.dataset.id = item.id;
    card.dataset.category = item.estilo || '';
    card.draggable = isLogged;
    const cleanSrc = (item.imagen || '').replace(/\\/g, '/');
    const imageUrl = cleanSrc.startsWith('http') ? cleanSrc : `/${cleanSrc}`;
    card.innerHTML = `<img src="${imageUrl}" alt="Trabajo de ${item.estilo || 'tatuaje'}">
        <div class="admin-card-actions">
          <span class="drag-handle" title="Arrastrar">☷</span>
          <button type="button" class="admin-delete-btn" title="Eliminar">🗑</button>
        </div>`;
    if (isLogged) {
        card.querySelector('.admin-delete-btn').addEventListener('click', e => { e.stopPropagation(); eliminarPortfolio(item.id); });
        activarDrag(card, 'portfolioGrid', '/api/portfolio/reordenar');
    }
    grid.appendChild(card);
}

function adminFetch(url, options = {}) {
    if (!IS_ADMIN_PAGE || !adminToken) {
        return Promise.reject(new Error('No autorizado'));
    }

    const opts = { ...options };
    opts.headers = {
        ...(options.headers || {}),
        'Authorization': `Bearer ${adminToken}`
    };

    return fetch(url, opts).then(async response => {
        if (response.status === 401) {
            sessionStorage.removeItem('adminToken');
            adminToken = '';
            isLogged = false;
            document.body.classList.remove('admin-mode');
            throw new Error('Sesión de administrador no válida');
        }
        return response;
    });
}

// 1. Guardar Portfolio usando AJAX / FormData real (Corrige las recargas erróneas del navegador)
function savePortfolioItem(e) {
    e.preventDefault(); 
    
    const formData = new FormData(e.target);

    adminFetch('/guardarPortfolio', {
        method: 'POST',
        body: formData
    })
    .then(res => {
        if(!res.ok) throw new Error();
        return res.text();
    })
    .then(msg => {
        alert(msg);
        cerrarModal('modalPortfolio');
        e.target.reset();
        window.location.reload(); // Recarga la vista para pintar la base de datos limpia
    })
    .catch(() => alert('Error al subir el trabajo al servidor MySQL.'));
}

// 2. Guardar Oferta (Flash) usando Multer hacia Node.js
function activarDrag(card, containerId, endpoint) {
    card.addEventListener('dragstart', e => {
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.id);
    });
    card.addEventListener('dragend', async () => {
        card.classList.remove('dragging');
        const container = document.getElementById(containerId);
        const orden = Array.from(container.querySelectorAll('[data-id]')).map(x => Number(x.dataset.id));
        try {
            const r = await adminFetch(endpoint, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({orden}) });
            if (!r.ok) throw new Error();
        } catch(e) { alert('No se pudo guardar el nuevo orden.'); location.reload(); }
    });
    card.addEventListener('dragover', e => {
        e.preventDefault();
        const dragging = document.querySelector('.dragging');
        if (!dragging || dragging === card) return;
        const rect = card.getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        const container = document.getElementById(containerId);
        container.insertBefore(dragging, before ? card : card.nextSibling);
    });
}

async function eliminarElemento(endpoint, id, mensaje) {
    if (!isLogged) return alert('Debes iniciar sesión como administrador.');
    if (!confirm(mensaje)) return;
    try {
        const r = await adminFetch(`${endpoint}/${id}`, { method:'DELETE' });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Error');
        location.reload();
    } catch(e) { console.error(e); alert('No se pudo eliminar.'); }
}

function eliminarOferta(id) { eliminarElemento('/api/ofertas', id, '¿Eliminar esta oferta? Esta acción no se puede deshacer.'); }
function eliminarFaq(id) { eliminarElemento('/api/faq', id, '¿Eliminar esta pregunta? Esta acción no se puede deshacer.'); }

function saveOfertaItem() {
    const t = document.getElementById('ofTitle').value;
    const p = document.getElementById('ofPrice').value;
    const f = document.getElementById('ofFile').files[0];
    if(!t || !p || !f) return alert('Completa todos los campos.');

    const formData = new FormData();
    formData.append('titulo', t);
    formData.append('precio', p);
    formData.append('imagen', f);

    adminFetch('/guardarOferta', {
        method: 'POST',
        body: formData
    })
    .then(res => {
        if(!res.ok) throw new Error();
        return res.text();
    })
    .then(msg => {
        alert(msg);
        cerrarModal('modalOfertas');
        window.location.reload();
    })
    .catch(() => alert('Error al guardar el flash en el servidor.'));
}

function appendOfertaHtml(t, p, src) {
    const div = document.createElement('div'); div.className = 'flash-card';
    div.innerHTML = `<img src="${src}" class="flash-img"><div class="flash-info"><span class="flash-tag">Disponible</span><h3 class="flash-title">${t}</h3><div class="flash-price">${p}€</div><button class="btn-principal" onclick="navegarA('contacto')">Reservar</button></div>`;
    document.getElementById('ofertasContainer').insertBefore(div, document.getElementById('ofertasContainer').firstChild);
}

// 3. Guardar Preguntas (FAQ)
function saveFaqItem() {
    const q = document.getElementById('faqQ').value;
    const a = document.getElementById('faqA').value;
    if(!q || !a) return alert('Completa los campos.');

    adminFetch('/guardarFaq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: q, respuesta: a })
    })
    .then(res => {
        if(!res.ok) throw new Error();
        return res.text();
    })
    .then(msg => {
        alert(msg);
        cerrarModal('modalFaq');
        window.location.reload();
    })
    .catch(() => alert('Error al guardar la duda en el servidor.'));
}

function appendFaqHtml(q, a) {
    const div = document.createElement('div'); div.className = 'faq-item';
    div.innerHTML = `<div class="faq-question" onclick="this.parentElement.classList.toggle('open')">${q} <span>+</span></div><div class="faq-answer">${a}</div>`;
    document.getElementById('faqList').appendChild(div);
}

async function eliminarPortfolio(id) {
    if (!isLogged) return alert('Debes iniciar sesión como administrador.');
    if (!confirm('¿Seguro que quieres eliminar este trabajo? Esta acción no se puede deshacer.')) return;
    try {
        const response = await adminFetch(`/api/portfolio/${id}`, { method: 'DELETE' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudo eliminar');
        cargarPortfolioDesdeBD();
    } catch (error) {
        console.error(error);
        alert('No se pudo eliminar el trabajo.');
    }
}

async function moverPortfolio(card, direccion) {
    if (!isLogged) return alert('Debes iniciar sesión como administrador.');
    const grid = document.getElementById('portfolioGrid');
    const cards = Array.from(grid.querySelectorAll('.portfolio-card'));
    const indice = cards.indexOf(card);
    const nuevoIndice = indice + direccion;
    if (nuevoIndice < 0 || nuevoIndice >= cards.length) return;

    if (direccion < 0) grid.insertBefore(card, cards[nuevoIndice]);
    else grid.insertBefore(card, cards[nuevoIndice].nextSibling);

    const orden = Array.from(grid.querySelectorAll('.portfolio-card')).map(c => Number(c.dataset.id));
    try {
        const response = await adminFetch('/api/portfolio/reordenar', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orden })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudo guardar el orden');
    } catch (error) {
        console.error(error);
        alert('No se pudo guardar el nuevo orden.');
        cargarPortfolioDesdeBD();
    }
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

function buscarPreguntas() {
    const txt = document.getElementById('faqSearch').value.toLowerCase();
    document.querySelectorAll('.faq-item').forEach(item => {
        const q = item.querySelector('.faq-question').textContent.toLowerCase();
        item.style.display = q.includes(txt) ? 'block' : 'none';
    });
}

/* --------------------------------------------------------------------------
    CALENDARIO Y FESTIVOS (Sincronizado con Base de Datos /api/citas)
    -------------------------------------------------------------------------- */
let currentYear = 2026, currentMonth = 6; 
let festivos = [];
try { festivos = JSON.parse(localStorage.getItem('kFestivos') || '[]'); } catch(e){}
let modoGestionFestivos = false;
const mesesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function activarModoGestionFestivos() {
    modoGestionFestivos = !modoGestionFestivos;
    document.getElementById('adminHollidayHelper').style.display = modoGestionFestivos ? 'block' : 'none';
    alert(modoGestionFestivos ? 'Modo de gestión de festivos activado. Toca los días para marcarlos.' : 'Modo gestión cerrado.');
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    if(!grid) return;
    document.getElementById('calendarMonthTitle').textContent = `${mesesNombres[currentMonth]} ${currentYear}`;
    grid.innerHTML = '';

    const diasSemana = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    diasSemana.forEach(d => { const box = document.createElement('div'); box.className='calendar-day-name'; box.textContent=d; grid.appendChild(box); });

    let primerDia = new Date(currentYear, currentMonth, 1).getDay();
    primerDia = primerDia === 0 ? 6 : primerDia - 1; 
    const totalDias = new Date(currentYear, currentMonth + 1, 0).getDate();

    for(let i=0; i<primerDia; i++) { const em = document.createElement('div'); em.className='calendar-day empty'; grid.appendChild(em); }

    for(let d=1; d<=totalDias; d++) {
        const dayBox = document.createElement('div'); dayBox.className = 'calendar-day'; dayBox.textContent = d;
        const dateString = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

        if(festivos.includes(dateString)) dayBox.classList.add('festivo');

        dayBox.addEventListener('click', () => {
            if(modoGestionFestivos) {
                if(festivos.includes(dateString)) {
                    festivos = festivos.filter(f => f !== dateString);
                } else {
                    festivos.push(dateString);
                }
                localStorage.setItem('kFestivos', JSON.stringify(festivos));
                renderCalendar();
            } else {
                if(festivos.includes(dateString)) return alert('Este día es festivo/no laborable.');
                document.querySelectorAll('.calendar-day').forEach(cd => cd.classList.remove('selected'));
                dayBox.classList.add('selected');
                document.getElementById('selectedDateInput').value = dateString;
                document.getElementById('formDateDisplay').value = `Día seleccionado: ${d} de ${mesesNombres[currentMonth]}`;
            }
        });
        grid.appendChild(dayBox);
    }
}
function cambiarMes(dir) { currentMonth += dir; if(currentMonth>11){currentMonth=0; currentYear++;} if(currentMonth<0){currentMonth=11; currentYear--;} renderCalendar(); }

// Enviar Cita guardando el registro en MySQL y notificando por EmailJS en simultáneo
function enviarCorreoCita(e) {
    e.preventDefault();

    const fileInput = document.getElementById('formFoto');
    const fotoArchivo = fileInput.files[0];

    // Empaquetamos exclusivamente los datos de contacto y la idea en un FormData
    const formData = new FormData();
    formData.append('nombre', document.getElementById('formName').value);
    formData.append('email', document.getElementById('formEmail').value);
    formData.append('idea', document.getElementById('formIdea').value);
    
    // Si seleccionaron una imagen, la adjuntamos al cuerpo binario
    if (fotoArchivo) {
        formData.append('imagen', fotoArchivo);
    }

    // Petición directa a tu servidor local en el puerto 3006
    fetch('/api/citas-correo', {
        method: 'POST',
        body: formData // Recuerda: No definas 'Content-Type' en los headers, el navegador lo gestiona solo
    })
    .then(res => {
        if (!res.ok) throw new Error('Error en el servidor al procesar el correo');
        return res.json();
    })
    .then(data => {
        alert('¡Tu propuesta de diseño ha sido enviada con éxito a krymgian02@gmail.com! Nos pondremos en contacto contigo pronto.');
        
        // Reseteamos el formulario por completo
        document.getElementById('appointmentForm').reset();
    })
    .catch(err => {
        console.error("Error en la solicitud fetch:", err);
        alert('Hubo un inconveniente al enviar tu idea. Por favor, revisa tu conexión o inténtalo de nuevo.');
    });
}

// Función limpia para resetear el formulario y actualizar la vista
function resetearFormularioCita() {
    document.getElementById('appointmentForm').reset();
    const dateDisplay = document.getElementById('formDateDisplay');
    if (dateDisplay) dateDisplay.value = '';
    if (typeof renderCalendar === 'function') renderCalendar();
}

/* --------------------------------------------------------------------------
    CARRUSEL INFINITO
    -------------------------------------------------------------------------- */
function inicializarCarrusel(tattoos) {
    const container = document.getElementById('carouselContainer');
    const track = document.getElementById('carouselTrack');
    const nextBtn = document.querySelector('.next-btn');
    const prevBtn = document.querySelector('.prev-btn');
    if (!container || !track || !tattoos || !tattoos.length) return;

    track.innerHTML = '';
    const SERVER_URL = '';
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');

    tattoos.forEach(tattoo => {
        const item = document.createElement('div');
        item.className = 'carousel-item';
        const img = document.createElement('img');
        const rutaLimpia = (tattoo.imagen || '').replace(/\\/g, '/');
        img.src = `${SERVER_URL}/${rutaLimpia}`;
        img.alt = `Tatuaje estilo ${tattoo.estilo || 'Microrealismo'}`;
        img.addEventListener('click', () => {
            if (!lightbox || !lightboxImg) return;
            lightboxImg.src = img.src;
            lightbox.style.display = 'flex';
            setTimeout(() => lightbox.classList.add('active'), 10);
        });
        item.appendChild(img);
        track.appendChild(item);
    });

    const originals = Array.from(track.children);
    if (originals.length === 1) { originals[0].classList.add('active-center'); return; }

    // Clones a ambos lados para conseguir un bucle visualmente infinito.
    originals.slice().reverse().forEach(item => track.insertBefore(item.cloneNode(true), track.firstChild));
    originals.forEach(item => track.appendChild(item.cloneNode(true)));

    let items = Array.from(track.children);
    let currentIndex = originals.length;
    let autoPlay;

    function actualizarCentro() {
        items.forEach((item, i) => item.classList.toggle('active-center', i === currentIndex));
    }

    function mover(index, animate = true) {
        const item = items[index];
        if (!item) return;
        const offset = item.offsetLeft + item.offsetWidth / 2 - container.clientWidth / 2;
        track.style.transition = animate ? 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
        track.style.transform = `translateX(${-offset}px)`;
        currentIndex = index;
        actualizarCentro();
    }

    track.addEventListener('transitionend', () => {
        const first = originals.length;
        const last = originals.length * 2 - 1;
        if (currentIndex > last) { currentIndex -= originals.length; mover(currentIndex, false); }
        else if (currentIndex < first) { currentIndex += originals.length; mover(currentIndex, false); }
    });

    if (nextBtn) nextBtn.onclick = () => mover(currentIndex + 1);
    if (prevBtn) prevBtn.onclick = () => mover(currentIndex - 1);

    
    
}

/* --------------------------------------------------------------------------
    RECUPERACIÓN DINÁMICA DE PORTFOLIO DESDE MYSQL
   -------------------------------------------------------------------------- */
window.addEventListener('DOMContentLoaded', () => {
    try {
        actualizarBotonNav();
        if(IS_ADMIN_PAGE && isLogged) document.body.classList.add('admin-mode');
        
        // Listener del formulario
        const formPortfolio = document.getElementById('form-portfolio');
        if(formPortfolio) formPortfolio.addEventListener('submit', savePortfolioItem);
        
        renderCalendar();
        
        // LLAMADA A TU NUEVA API
        cargarPortfolioDesdeBD();
    } catch(e) { console.error(e); }
});

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
            
            if(data.length === 0) {
                grid.innerHTML = '<p style="color: #fff; grid-column: 1/-1; text-align: center;">No hay trabajos disponibles.</p>';
                return;
            }

            // Conjunto (Set) para almacenar estilos únicos y evitar duplicados
            const estilosUnicos = new Set();

            // 1. Renderizar las imágenes y recolectar los estilos
            data.forEach(item => {
                appendFotoHtml(item);
                if(item.estilo) {
                    // Guardamos el estilo en minúsculas/limpio para el data-category
                    estilosUnicos.add(item.estilo.trim());
                }
            });

            // 2. Generar los botones dinámicamente si existe el contenedor
            if (filterContainer) {
                // Mantenemos solo el botón de "Todos" para no duplicarlo al recargar
                filterContainer.innerHTML = '<button class="filter-btn active" onclick="filtrarEstilo(\'all\', this)">Todos</button>';
                
                estilosUnicos.forEach(estilo => {
                    const boton = document.createElement('button');
                    boton.className = 'filter-btn';
                    
                    // Convertimos la primera letra en mayúscula para que quede estético en la web
                    const textoBoton = estilo.charAt(0).toUpperCase() + estilo.slice(1);
                    
                    boton.textContent = textoBoton;
                    
                    // Le asignamos la función de filtrado existente pasándole el valor real
                    boton.onclick = function() {
                        filtrarEstilo(estilo, this);
                    };
                    
                    filterContainer.appendChild(boton);
                });
            }
        })
        .catch(err => {
            console.error("Error cargando el portfolio y botones:", err);
        });
}

// Modificada para procesar correctamente las rutas de archivos de Multer (\ a /)
function appendFotoHtml(item) {
    const grid = document.getElementById('portfolioGrid');
    if (!grid) return;
    const card = document.createElement('div');
    card.className = 'portfolio-card admin-draggable';
    card.dataset.id = item.id;
    card.dataset.category = item.estilo || '';
    card.draggable = isLogged;
    const cleanSrc = (item.imagen || '').replace(/\\/g, '/');
    const imageUrl = cleanSrc.startsWith('http') ? cleanSrc : `/${cleanSrc}`;
    card.innerHTML = `<img src="${imageUrl}" alt="Trabajo de ${item.estilo || 'tatuaje'}">
        <div class="admin-card-actions">
          <span class="drag-handle" title="Arrastrar">☷</span>
          <button type="button" class="admin-delete-btn" title="Eliminar">🗑</button>
        </div>`;
    if (isLogged) {
        card.querySelector('.admin-delete-btn').addEventListener('click', e => { e.stopPropagation(); eliminarPortfolio(item.id); });
        activarDrag(card, 'portfolioGrid', '/api/portfolio/reordenar');
    }
    grid.appendChild(card);
}


// CARROUSEL DINÁMICO
document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api/portfolio';
    const track = document.getElementById('carouselTrack');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.querySelector('.lightbox-close');
    if (!track) return;

    fetch(API_URL)
        .then(response => { if (!response.ok) throw new Error('Error en la red'); return response.json(); })
        .then(tattoos => inicializarCarrusel(tattoos))
        .catch(err => {
            console.error('Error al renderizar el portfolio:', err);
            track.innerHTML = '<p class="error-msg">No se pudieron cargar los últimos trabajos.</p>';
        });

    function cerrarLightbox() {
        if (!lightbox || !lightboxImg) return;
        lightbox.classList.remove('active');
        setTimeout(() => { lightbox.style.display = 'none'; lightboxImg.src = ''; }, 300);
    }
    if (lightboxClose) lightboxClose.addEventListener('click', cerrarLightbox);
    if (lightbox) lightbox.addEventListener('click', e => { if (e.target !== lightboxImg && e.target !== lightboxClose) cerrarLightbox(); });
});


// OFERTAS
 document.addEventListener('DOMContentLoaded', () => {
    const OFERTAS_API_URL = '/api/ofertas';
    const SERVER_URL = '';
    const ofertasContainer = document.getElementById('ofertasContainer');
    if (!ofertasContainer) return;

    fetch(OFERTAS_API_URL).then(r => r.json()).then(ofertas => {
        ofertasContainer.innerHTML = '';
        if (!ofertas.length) { ofertasContainer.innerHTML = '<p class="error-msg">No hay ofertas disponibles.</p>'; return; }
        ofertas.forEach(oferta => {
            const card = document.createElement('div');
            card.className = 'flash-card admin-draggable';
            card.dataset.id = oferta.id;
            card.draggable = isLogged;
            const ruta = (oferta.imagen || '').replace(/\\/g, '/');
            card.innerHTML = `<img src="${SERVER_URL}/${ruta}" class="flash-img" alt="${oferta.titulo}">
                <div class="flash-info"><span class="flash-tag">Disponible</span><h3 class="flash-title">${oferta.titulo}</h3><div class="flash-price">${oferta.precio}€</div><button class="btn-principal" onclick="navegarA('contacto')">Reservar</button></div>
                <div class="admin-card-actions"><span class="drag-handle" title="Arrastrar">☷</span><button type="button" class="admin-delete-btn" title="Eliminar">🗑</button></div>`;
            if (isLogged) {
                card.querySelector('.admin-delete-btn').addEventListener('click', e => { e.stopPropagation(); eliminarOferta(oferta.id); });
                activarDrag(card, 'ofertasContainer', '/api/ofertas/reordenar');
            }
            ofertasContainer.appendChild(card);
        });
    }).catch(err => console.error('Error al renderizar ofertas:', err));
});

// FAQ
 document.addEventListener('DOMContentLoaded', () => {
    const faqList = document.getElementById('faqList');
    if (!faqList) return;
    let todasLasPreguntas = [];

    function renderizarFaqs(lista) {
        faqList.innerHTML = '';
        if (!lista.length) { faqList.innerHTML = '<p class="error-msg">No se encontraron preguntas.</p>'; return; }
        lista.forEach(faq => {
            const item = document.createElement('div');
            item.className = 'faq-item admin-draggable';
            item.dataset.id = faq.id;
            item.draggable = isLogged;
            item.innerHTML = `<div class="faq-question">${faq.pregunta}<span>+</span></div><div class="faq-answer">${faq.respuesta}</div><div class="admin-card-actions"><span class="drag-handle" title="Arrastrar">☷</span><button type="button" class="admin-delete-btn" title="Eliminar">🗑</button></div>`;
            item.querySelector('.faq-question').addEventListener('click', () => item.classList.toggle('open'));
            if (isLogged) {
                item.querySelector('.admin-delete-btn').addEventListener('click', e => { e.stopPropagation(); eliminarFaq(faq.id); });
                activarDrag(item, 'faqList', '/api/faq/reordenar');
            }
            faqList.appendChild(item);
        });
    }

    fetch('/api/faq').then(r => r.json()).then(faqs => { todasLasPreguntas = faqs; renderizarFaqs(faqs); }).catch(err => console.error('Error al renderizar FAQs:', err));

    window.buscarPreguntas = function() {
        const query = document.getElementById('faqSearch').value.toLowerCase().trim();
        renderizarFaqs(todasLasPreguntas.filter(f => f.pregunta.toLowerCase().includes(query) || f.respuesta.toLowerCase().includes(query)));
    };
});
