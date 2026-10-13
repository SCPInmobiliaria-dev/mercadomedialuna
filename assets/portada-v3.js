/* =========================================================================
   Mercado Media Luna — capa v3 de la portada (13/10/2026)
   Todo se engancha ALREDEDOR del motor del hero (app.js §2: heroProgress,
   requestSeek, tick, cargarBlob, variante), sin tocarlo.
   1 · Gancho de progreso: CustomEvent "mml:hero-progress" {progress, frame}
       en cada cambio de cuadro, calculado como lo hace el motor. Mientras el
       hero está a la vista, body.en-hero: el botón del menú calla y el ámbar
       del hero queda en luna + palabra clave + botón del final (Manual §3.3).
   2 · Rail de capítulos (config.js → heroCapitulos): cinco puntos con el
       título de cada banda como nombre accesible; clic y teclado. 🔵 Propuesta.
   3 · Módulo de evidencia (config.js → evidencia): solo lo que está activo.
   4 · Transiciones ligadas al scroll (--vp) sobre contenido que ya existe.
   5 · En vertical, el riel de fotos (#obra) y el de proyecciones (#proyecto)
       se mueven juntos: es scroll, no animación.
   6 · Un elemento vivo por sección, solo mientras está a la vista (.vivo).
   Con movimiento reducido no se engancha nada de lo que se mueve.
   ========================================================================= */
(function () {
  'use strict';

  var CFG = window.MML || {};
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var reducido = window.matchMedia('(prefers-reduced-motion: reduce)');
  var hayIO = 'IntersectionObserver' in window;

  /* ---------------------------------------------------------------------
     1 · Progreso del hero, emitido como evento para las capas de encima
     --------------------------------------------------------------------- */
  var hero = $('.hero');
  var track = $('.hero-track');
  var stage = $('.stage');
  var CAP = CFG.heroCapitulos || {};
  var CUADROS = Math.max(2, parseInt(CAP.cuadros, 10) || 240);

  function progreso() {
    if (!track) return 0;
    var r = track.getBoundingClientRect();
    var total = track.offsetHeight - window.innerHeight;
    if (total <= 0) return 0;
    return clamp(-r.top / total, 0, 1);
  }

  var ultimoCuadro = -1, raf = null;
  function emitir() {
    raf = null;
    var p = progreso();
    var f = Math.round(p * (CUADROS - 1));
    if (f === ultimoCuadro) return;
    ultimoCuadro = f;
    document.dispatchEvent(new CustomEvent('mml:hero-progress', { detail: { progress: p, frame: f } }));
  }
  function alMover() { if (raf === null) raf = requestAnimationFrame(emitir); }

  if (hero) {
    document.body.classList.add('en-hero');
    if (hayIO) {
      new IntersectionObserver(function (es) {
        document.body.classList.toggle('en-hero', es[0].isIntersecting);
      }, { rootMargin: '-64px 0px 0px 0px' }).observe(hero);
    }
  }

  /* ---------------------------------------------------------------------
     2 · Rail de capítulos
     --------------------------------------------------------------------- */
  var caps = Array.isArray(CAP.lista) ? CAP.lista.filter(function (c) { return c && c.titulo; }) : [];
  var botones = [], activo = -1;

  function irA(c) {
    if (!track) return;
    var total = track.offsetHeight - window.innerHeight;
    var p = (Number(c.desde) + Number(c.hasta)) / 2;
    var top = Math.round(track.getBoundingClientRect().top + window.scrollY + total * clamp(p, 0, 1));
    window.scrollTo({ top: top, behavior: reducido.matches ? 'instant' : 'smooth' });
  }

  function marcarActivo(p) {
    var act = -1;
    for (var i = 0; i < caps.length; i++) {
      if (p >= Number(caps[i].desde) - 0.02 && p <= Number(caps[i].hasta) + 0.02) act = i;
    }
    if (act === activo) return;
    activo = act;
    botones.forEach(function (b, i) {
      b.classList.toggle('activo', i === act);
      if (i === act) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
  }

  if (track && stage && caps.length && !reducido.matches) {
    var rail = document.createElement('nav');
    rail.className = 'hero-rail';
    rail.setAttribute('aria-label', 'Capítulos del recorrido');
    var ol = document.createElement('ol');
    caps.forEach(function (c) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'hero-rail-b';
      b.setAttribute('aria-label', c.titulo);
      var t = document.createElement('span');
      t.className = 'hero-rail-t';
      t.setAttribute('aria-hidden', 'true');
      t.textContent = c.titulo;
      var punto = document.createElement('span');
      punto.className = 'hero-rail-p';
      punto.setAttribute('aria-hidden', 'true');
      b.appendChild(t);
      b.appendChild(punto);
      b.addEventListener('click', function () { irA(c); });
      li.appendChild(b);
      ol.appendChild(li);
      botones.push(b);
    });
    rail.appendChild(ol);
    /* con las flechas se recorre el rail sin salir de él */
    rail.addEventListener('keydown', function (e) {
      var i = botones.indexOf(document.activeElement);
      if (i < 0) return;
      var j = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? botones.length - 1 : -1;
      if (j < 0 || j >= botones.length) return;
      e.preventDefault();
      botones[j].focus();
    });
    stage.appendChild(rail);
    document.addEventListener('mml:hero-progress', function (e) { marcarActivo(e.detail.progress); });
  }

  if (track && !reducido.matches) {
    window.addEventListener('scroll', alMover, { passive: true });
    window.addEventListener('resize', alMover);
    emitir();
    marcarActivo(progreso());
  }

  /* ---------------------------------------------------------------------
     3 · Módulo de evidencia: solo lo activo, nunca un hueco
     --------------------------------------------------------------------- */
  var caja = $('#evidencia');
  var EV = CFG.evidencia || {};
  var activos = Array.isArray(EV.items) ? EV.items.filter(function (it) { return it && it.activo === true && it.nombre; }) : [];
  if (caja && activos.length) {
    var rot = $('.evidencia-rotulo', caja);
    var soloReclamos = activos.length === 1 && activos[0].id === 'reclamos';
    if (rot) rot.textContent = (soloReclamos && EV.rotuloMinimo) || EV.rotulo || 'Para comprobar';
    var lista = $('.evidencia-lista', caja);
    if (lista) {
      lista.textContent = '';
      activos.forEach(function (it) {
        var li = document.createElement('li');
        li.className = 'evidencia-item';
        var n = document.createElement('span');
        n.className = 'evidencia-nombre';
        n.textContent = it.nombre;
        li.appendChild(n);
        if (it.enlace && it.texto) {
          var a = document.createElement('a');
          a.className = 'evidencia-enlace';
          a.href = it.enlace;
          a.textContent = it.texto;
          li.appendChild(a);
        } else if (it.texto) {
          var s = document.createElement('span');
          s.className = 'evidencia-texto';
          s.textContent = it.texto;
          li.appendChild(s);
        }
        lista.appendChild(li);
      });
      caja.hidden = false;
    }
  } else if (caja) {
    caja.remove();
  }

  /* ---------------------------------------------------------------------
     4 · Transiciones ligadas al scroll: cada [data-vp] recibe --vp de 0 a 1
         mientras sube desde el borde inferior hasta el 45 % de la pantalla.
         Solo escribe cuando cambia; descansa cuando nada está a la vista.
     --------------------------------------------------------------------- */
  var vps = $$('[data-vp]').map(function (el) { return { el: el, v: -1, visible: false }; });
  if (vps.length && !reducido.matches && hayIO) {
    var pendiente = null;
    var pintarVp = function () {
      pendiente = null;
      var h = window.innerHeight;
      for (var i = 0; i < vps.length; i++) {
        var o = vps[i];
        if (!o.visible) continue;
        var r = o.el.getBoundingClientRect();
        var v = clamp((h - r.top) / (h * 0.55), 0, 1);
        v = Math.round(v * 100) / 100;
        if (v !== o.v) { o.v = v; o.el.style.setProperty('--vp', v); }
      }
    };
    var pedirVp = function () { if (pendiente === null) pendiente = requestAnimationFrame(pintarVp); };
    var ioVp = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var o = vps.filter(function (x) { return x.el === e.target; })[0];
        if (o) o.visible = e.isIntersecting;
      });
      pedirVp();
    }, { rootMargin: '10% 0px 10% 0px' });
    vps.forEach(function (o) { ioVp.observe(o.el); });
    window.addEventListener('scroll', pedirVp, { passive: true });
    window.addEventListener('resize', pedirVp);
    pedirVp();
  }

  /* ---------------------------------------------------------------------
     5 · En vertical, los dos rieles (fotos de hoy / proyecciones) van juntos.
         Solo cuando ambos desplazan de verdad (en escritorio son retículas).
     --------------------------------------------------------------------- */
  var rielA = $('#obra .obra-grid'), rielB = $('#proyecto .proyecto-pares');
  if (rielA && rielB) {
    var enCurso = null;
    var espejo = function (de, a) {
      return function () {
        if (enCurso && enCurso !== de) return;
        if (de.scrollWidth <= de.clientWidth + 1) return;
        enCurso = de;
        var razon = (a.scrollWidth - a.clientWidth) / Math.max(1, de.scrollWidth - de.clientWidth);
        var destino = Math.round(de.scrollLeft * razon);
        if (Math.abs(a.scrollLeft - destino) > 1) a.scrollLeft = destino;
        requestAnimationFrame(function () { enCurso = null; });
      };
    };
    rielA.addEventListener('scroll', espejo(rielA, rielB), { passive: true });
    rielB.addEventListener('scroll', espejo(rielB, rielA), { passive: true });
  }

  /* ---------------------------------------------------------------------
     6 · Elementos vivos: la clase .vivo solo mientras están a la vista
     --------------------------------------------------------------------- */
  var vivos = $$('[data-vivo]');
  if (vivos.length && !reducido.matches && hayIO) {
    var ioVivo = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle('vivo', e.isIntersecting); });
    }, { rootMargin: '0px 0px -10% 0px' });
    vivos.forEach(function (el) { ioVivo.observe(el); });
  }

  /* si el visitante activa el movimiento reducido con la página abierta, las
     capas de encima se quedan quietas en su estado final */
  function onReducido(e) {
    if (!e.matches) return;
    vps.forEach(function (o) { o.el.style.setProperty('--vp', 1); });
    vivos.forEach(function (el) { el.classList.remove('vivo'); });
    var r = $('.hero-rail');
    if (r) r.remove();
  }
  if (reducido.addEventListener) reducido.addEventListener('change', onReducido);
  else if (reducido.addListener) reducido.addListener(onReducido);

  /* para las pruebas: funciones, ningún dato del visitante */
  window.__portadaV3 = { progreso: progreso, capitulos: caps, evidenciaActiva: activos.length };
})();
