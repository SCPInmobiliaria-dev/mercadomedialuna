/* =========================================================================
   Mercado Media Luna — testimonios (portada y /evento)
   Una sola tarjeta por comprador: foto, estrellas, sus palabras, nombre y
   rubro. Al tocar la foto se reproduce su video ahí mismo.
   · Las citas son textuales, sacadas del video de cada uno.
   · La foto es nuestra: hasta que alguien toca, no se le pide nada a YouTube.
   · Los datos viven en assets/config.js → testimonios. Agregar un comprador
     es agregar un objeto a esa lista.
   (Hasta el 25/09/2026 había dos apartados, "de video" y "escritos"; ahora
   van juntos.)
   ========================================================================= */
(function () {
  'use strict';

  var CFG = window.MML || {};
  var lista = (CFG.testimonios || []).filter(function (t) { return t && t.id; });
  var rail = document.getElementById('testi-rail');
  if (!rail || !lista.length) return;

  var vacio = document.querySelector('.testi-vacio');
  if (vacio) vacio.remove();
  /* regla del proyecto: si alguna autorización de imagen está pendiente, la
     página lo dice */
  var aviso = document.querySelector('.testi-aviso');
  if (aviso && lista.some(function (t) { return /PENDIENTE/.test(t.autorizacion || ''); })) aviso.hidden = false;

  var ESTRELLA = '<svg viewBox="0 0 20 20" focusable="false"><path d="M10 1.4l2.63 5.33 5.88.86-4.26 4.15 1.01 5.86L10 14.83l-5.26 2.77 1.01-5.86L1.49 7.59l5.88-.86z"/></svg>';

  function crear(tag, clase, texto) {
    var el = document.createElement(tag);
    if (clase) el.className = clase;
    if (texto != null) el.textContent = texto;
    return el;
  }

  lista.forEach(function (t) {
    var nombre = t.nombre || 'un comprador';
    var tarjeta = crear('article', 'tcard');
    tarjeta.setAttribute('role', 'listitem');

    /* ---- la foto es el botón del video ---- */
    var foto = crear('button', 'tcard-foto');
    foto.type = 'button';
    foto.setAttribute('aria-label', 'Ver el video de ' + nombre + (t.duracion ? ' (' + t.duracion + ')' : ''));
    if (t.foto) {
      var img = new Image();
      img.src = t.foto;
      img.alt = '';
      img.width = 600; img.height = 750;
      img.loading = 'lazy';
      img.decoding = 'async';
      foto.appendChild(img);
    }
    foto.insertAdjacentHTML('beforeend',
      '<span class="tcard-play" aria-hidden="true"></span>' +
      (t.duracion ? '<span class="tcard-dur" aria-hidden="true">' + t.duracion + '</span>' : ''));
    foto.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.className = 'tcard-video';
      /* playsinline: en iPhone se queda en la tarjeta, sin saltar a pantalla completa */
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(t.id) + '?autoplay=1&rel=0&playsinline=1';
      f.title = 'Testimonio de ' + nombre;
      f.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.setAttribute('allowfullscreen', '');
      foto.replaceWith(f);
      f.focus();
      if (window.MMLmedir && typeof window.MMLmedir.evento === 'function') window.MMLmedir.evento('TestimonioPlay');
    }, { once: true });
    tarjeta.appendChild(foto);

    /* ---- lo que dice ---- */
    var cuerpo = crear('div', 'tcard-cuerpo');
    var estrellas = crear('p', 'tcard-estrellas');
    estrellas.setAttribute('aria-hidden', 'true');
    estrellas.innerHTML = ESTRELLA + ESTRELLA + ESTRELLA + ESTRELLA + ESTRELLA;
    cuerpo.appendChild(estrellas);
    if (t.cita) {
      var cita = crear('blockquote', 'tcard-cita');
      cita.appendChild(crear('p', null, '«' + t.cita + '»'));
      cuerpo.appendChild(cita);
    } else {
      /* sin cita textual todavía: se invita al video, no se inventa una frase */
      cuerpo.appendChild(crear('p', 'tcard-sin-cita', 'Toca la foto para escuchar su historia.'));
    }
    cuerpo.appendChild(crear('p', 'tcard-nombre', t.nombre || 'Comprador del mercado'));
    if (t.descripcion) cuerpo.appendChild(crear('p', 'tcard-desc', t.descripcion));
    tarjeta.appendChild(cuerpo);

    rail.appendChild(tarjeta);
  });
})();
