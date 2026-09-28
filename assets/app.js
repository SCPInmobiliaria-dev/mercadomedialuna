/* =========================================================================
   Mercado Media Luna — comportamiento del sitio
   Sin dependencias. La página tiene que quedar completa aunque el video
   nunca cargue y aunque el navegador tenga el movimiento reducido activado.
   ========================================================================= */
(function () {
  'use strict';

  var CFG = window.MML || {};
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var smoothstep = function (p, e0, e1) { var t = clamp((p - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------------------------------------------------------------------
     1 · Texto: partido una sola vez, con azar sembrado (idéntico en cada carga)
     --------------------------------------------------------------------- */
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function partir(p, entrada, semilla) {
    var texto = p.getAttribute('data-text') || p.textContent;
    var r = rng(semilla);
    p.textContent = '';

    var lector = document.createElement('span');
    lector.className = 'sr';
    lector.textContent = texto;
    p.appendChild(lector);

    function construir() {
      var cont = document.createElement('span');
      cont.setAttribute('aria-hidden', 'true');
      var palabras = texto.split(' ');
      var totalChars = texto.replace(/\s/g, '').length, idx = 0;

      palabras.forEach(function (palabra, wi) {
        var w = document.createElement('span');
        w.className = 'w';
        w.style.setProperty('--th', (wi / Math.max(1, palabras.length) * 0.5 + r() * 0.06).toFixed(3));
        (palabra + (wi < palabras.length - 1 ? ' ' : '')).split('').forEach(function (ch) {
          var c = document.createElement('span');
          c.className = 'c';
          c.textContent = ch;
          if (entrada === 'ensamble') {
            c.style.setProperty('--th', (idx / Math.max(1, totalChars) * 0.35 + r() * 0.2).toFixed(3));
            c.style.setProperty('--jx', Math.round((r() - 0.5) * 90) + 'px');
            c.style.setProperty('--jy', Math.round((r() - 0.5) * 70) + 'px');
            c.style.setProperty('--jr', Math.round((r() - 0.5) * 40) + 'deg');
          }
          idx++;
          w.appendChild(c);
        });
        cont.appendChild(w);
      });
      return cont;
    }

    if (entrada === 'nitido') {
      var suave = construir(); suave.className = 'blur-copy';
      var nitido = construir(); nitido.className = 'sharp-copy';
      p.appendChild(suave); p.appendChild(nitido);
    } else {
      p.appendChild(construir());
    }
  }

  /* ---------------------------------------------------------------------
     2 · El hero con scroll
     --------------------------------------------------------------------- */
  var hero = $('.hero');
  var track = $('.hero-track');
  var stage = $('.stage');
  var video = $('#hero-video');
  var poster = $('.poster');
  var loader = $('#loader');
  var bandsEls = $$('.band');

  var bandas = bandsEls.map(function (el, i) {
    var r = (el.getAttribute('data-band') || '0,1').split(',').map(Number);
    var rampAttr = parseFloat(el.getAttribute('data-ramp'));
    partir($('.line', el), el.getAttribute('data-entrance'), 1000 + i * 77);
    var sub = $('.line-sub', el);
    if (sub) partir(sub, el.getAttribute('data-entrance'), 2000 + i * 31);
    return { el: el, a: r[0], b: r[1], ramp: isNaN(rampAttr) ? 0 : rampAttr, op: -1, k: -1 };
  });

  var target = 0, shown = 0, rafId = null, lastTick = 0;
  var heroVisible = true, scrubOn = false, cargaIniciada = false;
  var loadK = 0, loadStart = 0;

  function heroProgress() {
    if (!track) return 0;
    var rect = track.getBoundingClientRect();
    var total = track.offsetHeight - window.innerHeight;
    if (total <= 0) return 0;
    return clamp(-rect.top / total, 0, 1);
  }

  /* seeks con compuerta: nunca dos a la vez, siempre el más nuevo */
  var seekBusy = false, pendingTime = null;
  function requestSeek(t) {
    if (!video.duration || isNaN(t)) return;
    if (seekBusy) { pendingTime = t; return; }
    seekBusy = true;
    try { video.currentTime = t; } catch (e) { seekBusy = false; }
  }
  video.addEventListener('seeked', function () {
    seekBusy = false;
    if (pendingTime !== null) { var t = pendingTime; pendingTime = null; requestSeek(t); }
  });
  video.addEventListener('error', function () { seekBusy = false; pendingTime = null; fallaVideo(); });
  /* red de seguridad: cada vez que el elemento se vacía (cambio de src) */
  video.addEventListener('emptied', function () { seekBusy = false; });

  /* escrituras al DOM solo cuando algo cambia de verdad */
  function pintarBandas(p) {
    for (var i = 0; i < bandas.length; i++) {
      var b = bandas[i];
      var f = Math.min(0.02, (b.b - b.a) / 3);
      var entra = i === 0 ? 1 : smoothstep(p, b.a, b.a + f);
      var sale = i === bandas.length - 1 ? 0 : (1 - smoothstep(p, b.b - f, b.b));
      var op = entra * (i === bandas.length - 1 ? 1 : sale);
      var ramp = b.ramp || Math.min(0.025, (b.b - b.a) * 0.35);
      var k = clamp((p - b.a) / ramp, 0, 1);
      if (i === 0) k = Math.max(k, loadK);

      if (Math.abs(op - b.op) > 0.004) {
        b.el.style.opacity = op.toFixed(3); b.op = op;
        if (i === bandas.length - 1) document.body.classList.toggle('fin-hero', op > 0.5);
      }
      if (Math.abs(k - b.k) > 0.008) { b.el.style.setProperty('--k', k.toFixed(3)); b.k = k; }
    }
    var luna = document.documentElement;
    var lunaV = Math.round(p * 100) / 100;
    if (luna.style.getPropertyValue('--luna') !== String(lunaV)) luna.style.setProperty('--luna', lunaV);
  }

  function tick(now) {
    var dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    var k = 0.16;
    shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));

    if (loadStart && loadK < 1) loadK = clamp((now - loadStart) / 1100, 0, 1);

    var quieto = Math.abs(target - shown) < 0.0005 && loadK >= 1;
    if (quieto) { shown = target; rafId = null; lastTick = 0; }
    else { rafId = requestAnimationFrame(tick); }

    if (video.duration) requestSeek(shown * video.duration);
    pintarBandas(shown);
  }

  function onScroll() {
    target = heroProgress();
    if (rafId === null && heroVisible && scrubOn) { lastTick = 0; rafId = requestAnimationFrame(tick); }
  }

  /* ---- carga del video: primero el póster, luego el blob con anillo ---- */
  function conexionLenta() {
    var c = navigator.connection;
    if (!c) return false;
    if (c.saveData) return true;
    return ['slow-2g', '2g', '3g'].indexOf(c.effectiveType) !== -1;
  }

  function fallaVideo() {
    if (loader) loader.classList.add('done');
    stage.classList.add('video-failed');
  }

  /* Qué video toca. En vertical (celular, tableta de pie) va el recorte
     cuadrado del hero compacto; apaisado, el de 16:9. La versión ligera se
     usa solo con conexión lenta o ahorro de datos: un celular acostado tiene
     2500 px físicos de ancho y con la de 1280 se veía estirado al doble. */
  var mqMovil = matchMedia('(orientation: portrait)');
  var tactil = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  var varianteCargada = null, cargaCtrl = null, urlBlob = null;

  function variante() {
    var ligero = conexionLenta();
    if (mqMovil.matches && CFG.videoMovil) {
      return {
        clave: ligero ? 'movil-ligero' : 'movil',
        url: ligero ? (CFG.videoMovilLigero || CFG.videoMovil) : CFG.videoMovil,
        bytes: ligero ? (CFG.videoMovilLigeroBytes || CFG.videoMovilBytes) : CFG.videoMovilBytes,
        poster: CFG.posterMovil || CFG.poster
      };
    }
    return {
      clave: ligero ? 'ligero' : 'escritorio',
      url: ligero ? (CFG.videoLigero || CFG.video) : CFG.video,
      bytes: ligero ? (CFG.videoLigeroBytes || CFG.videoBytes) : CFG.videoBytes,
      poster: CFG.poster
    };
  }

  /* Carga la variante que corresponde. Si el teléfono gira y cambia la
     variante, se abandona la descarga anterior y se carga la otra. */
  function iniciarHero() {
    var v = variante();
    if (varianteCargada === v.clave) return;
    varianteCargada = v.clave;
    cargaIniciada = true;
    if (cargaCtrl) cargaCtrl.abort();
    stage.classList.remove('video-ready', 'video-failed');
    seekBusy = false; pendingTime = null;
    if (loader) {
      loader.classList.remove('done');
      var aro = $('.ring circle', loader);
      if (aro) aro.style.setProperty('--ld', 126);
    }
    poster.style.backgroundImage = "url('" + v.poster + "')";
    var arrancado = false;
    function arrancar() {
      if (arrancado || varianteCargada !== v.clave) return;
      arrancado = true;
      cargarBlob(v).catch(function () {
        /* una descarga abandonada por el giro no es una falla */
        if (varianteCargada === v.clave) fallaVideo();
      });
    }
    var img = new Image();
    img.onload = arrancar; img.onerror = arrancar;
    img.src = v.poster;
    setTimeout(arrancar, 4000);
    loadStart = performance.now();
  }

  function cargarBlob(v) {
    var url = v.url;
    var bytes = v.bytes;
    var ring = $('.ring circle', loader);
    var ctrl = new AbortController();
    cargaCtrl = ctrl;
    var watchdog = setTimeout(function () { ctrl.abort(); }, 20000);

    return fetch(url, { signal: ctrl.signal }).then(function (res) {
      if (!res.ok || !res.body) throw new Error('video ' + res.status);
      var total = Number(res.headers.get('Content-Length')) || bytes || 0;
      var reader = res.body.getReader();
      var chunks = [], got = 0, lastRing = 0;
      return (function leer() {
        return reader.read().then(function (r) {
          if (r.done) return chunks;
          clearTimeout(watchdog);
          watchdog = setTimeout(function () { ctrl.abort(); }, 20000);
          chunks.push(r.value); got += r.value.length;
          var frac = total ? Math.min(1, got / total) : 0;
          var now = performance.now();
          if (ring && (now - lastRing > 100 || frac === 1)) {
            lastRing = now;
            ring.style.setProperty('--ld', Math.round(126 * (1 - frac)));
          }
          return leer();
        });
      })();
    }).then(function (chunks) {
      clearTimeout(watchdog);
      if (varianteCargada !== v.clave) return;   // el teléfono giró mientras bajaba
      if (ring) ring.style.setProperty('--ld', 0);
      var anterior = urlBlob;
      urlBlob = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
      /* el seek que estaba en curso sobre el video anterior muere con load()
         y su 'seeked' no llega nunca: sin soltar la compuerta aquí, el video
         se quedaba congelado en el cuadro 0 después de girar el teléfono */
      seekBusy = false; pendingTime = null;
      video.src = urlBlob;
      video.load();
      if (anterior) URL.revokeObjectURL(anterior);
      video.addEventListener('canplay', function () {
        if (varianteCargada !== v.clave) return;
        if (loader) loader.classList.add('done');
        stage.classList.add('video-ready');
        /* Safari de iPhone no pinta los cuadros de un video que nunca se
           reprodujo, aunque se le cambie currentTime. Un play y pausa mudos
           lo despiertan. Va por dispositivo táctil y no por orientación: el
           iPhone acostado también lo necesita. */
        if (tactil && video.play) {
          var pr = video.play();
          if (pr && pr.then) pr.then(function () { video.pause(); requestSeek(heroProgress() * video.duration); }).catch(function () {});
        }
        requestSeek(heroProgress() * video.duration);
        onScroll();
      }, { once: true });
    });
  }

  /* ---- la compuerta del hero estático, idéntica al CSS ----
     Hasta el 24/09/2026 el celular, la tableta de pie y el celular acostado
     también caían al hero estático. Ahora tienen su versión compacta del
     scroll (ver styles.css, "hero compacto"): el estático queda solo para
     quien pidió menos movimiento. */
  var GATES = [
    '(prefers-reduced-motion: reduce)'
  ];
  var MQLS = GATES.map(function (q) { return matchMedia(q); });

  /* al girar el teléfono cambia el formato del hero: otra variante y otra
     altura del recorrido */
  function alCambiarFormato() {
    if (!scrubOn) return;
    iniciarHero();
    bandas.forEach(function (b) { b.op = -1; b.k = -1; });
    onScroll();
  }
  [mqMovil].forEach(function (m) {
    if (m.addEventListener) m.addEventListener('change', alCambiarFormato);
    else if (m.addListener) m.addListener(alCambiarFormato);
  });

  function activarScrub() {
    if (scrubOn) return;
    scrubOn = true;
    iniciarHero();
    window.addEventListener('scroll', onScroll, { passive: true });
    bandas.forEach(function (b) { b.op = -1; b.k = -1; });
    soltarEstadosFinales();
    pintarBandas(heroProgress());
    onScroll();
  }
  function desactivarScrub() {
    if (!scrubOn) return;
    scrubOn = false;
    window.removeEventListener('scroll', onScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }
  function aplicarModoHero() {
    if (MQLS.some(function (m) { return m.matches; })) desactivarScrub();
    else activarScrub();
  }
  MQLS.forEach(function (m) {
    if (m.addEventListener) m.addEventListener('change', aplicarModoHero);
    else if (m.addListener) m.addListener(aplicarModoHero);
  });

  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      heroVisible = es[0].isIntersecting;
      if (!heroVisible) document.body.classList.remove('fin-hero');
      if (heroVisible && scrubOn) onScroll();
      else if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    }, { rootMargin: '10px' }).observe(hero);
  }

  aplicarModoHero();

  /* Los botones del final del hero están en la página desde el principio,
     con opacidad 0 hasta el último tramo. Si el foco del teclado llega a
     ellos antes, la página baja hasta donde se ven: si no, el contorno de
     foco quedaría sobre algo invisible. */
  var bandaFinal = bandsEls[bandsEls.length - 1];
  if (bandaFinal && track) {
    bandaFinal.addEventListener('focusin', function () {
      if (!scrubOn || heroProgress() > 0.97) return;
      var r = track.getBoundingClientRect();
      window.scrollTo({ top: Math.round(window.scrollY + r.top + track.offsetHeight - window.innerHeight), behavior: 'instant' });
      onScroll();
    });
  }

  /* ---------------------------------------------------------------------
     3 · Entradas de sección y estados finales
     --------------------------------------------------------------------- */
  var reveals = $$('.reveal, .promesa');
  var io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        setTimeout(function () { e.target.classList.add('settled'); }, 1200);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in', 'settled'); });
  }

  function fijarEstadosFinales() {
    reveals.forEach(function (el) { el.classList.add('in', 'settled'); });
    document.documentElement.style.setProperty('--luna', 1);
    bandas.forEach(function (b) { b.el.style.opacity = ''; b.el.style.setProperty('--k', 1); b.op = -1; b.k = -1; });
  }
  function soltarEstadosFinales() {
    document.documentElement.style.removeProperty('--luna');
  }

  var mqMovimiento = matchMedia('(prefers-reduced-motion: reduce)');
  function onMovimiento(e) { if (e.matches) fijarEstadosFinales(); else aplicarModoHero(); }
  if (mqMovimiento.addEventListener) mqMovimiento.addEventListener('change', onMovimiento);
  else if (mqMovimiento.addListener) mqMovimiento.addListener(onMovimiento);
  if (mqMovimiento.matches) fijarEstadosFinales();

  document.addEventListener('visibilitychange', function () {
    document.body.classList.toggle('pausado', document.hidden);
  });

  /* ---------------------------------------------------------------------
     4 · La calculadora del alquiler (el momento que el visitante realiza)
     --------------------------------------------------------------------- */
  var monto = $('#calc-monto'), anios = $('#calc-anios'), aniosOut = $('#calc-anios-out');
  var resultado = $('#calc-result'), kicker = $('#calc-kicker');
  var fmt = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 });

  function calcular() {
    if (!monto || !anios) return;
    var m = parseFloat(monto.value) || 0;
    var a = parseInt(anios.value, 10) || 0;
    if (aniosOut) aniosOut.textContent = a + (a === 1 ? ' año' : ' años');
    if (m <= 0) {
      resultado.textContent = 'Pon tu alquiler y te digo cuánto llevas pagado.';
      if (kicker) kicker.hidden = true;
      return;
    }
    var total = m * 12 * a;
    resultado.innerHTML = 'En ' + a + (a === 1 ? ' año' : ' años') + ' ya pagaste <span class="cifra">S/ ' + fmt.format(total) + '</span>.';
    if (kicker) kicker.hidden = false;
  }
  if (monto) { monto.addEventListener('input', calcular); }
  if (anios) { anios.addEventListener('input', calcular); }
  var calcForm = $('#calc');
  if (calcForm) calcForm.addEventListener('submit', function (e) { e.preventDefault(); });
  calcular();

  /* ---------------------------------------------------------------------
     5 · WhatsApp (CTA secundario)
     --------------------------------------------------------------------- */
  function seccionDe(el) {
    var s = el.closest('section');
    return (s && s.id) || 'pie';
  }
  $$('[data-wa]').forEach(function (a) {
    if (!CFG.whatsapp) {
      a.setAttribute('href', '#hablemos');
      a.setAttribute('title', 'Número de WhatsApp pendiente: ver assets/config.js');
      return;
    }
    var texto = (CFG.whatsappTexto || '') + ' (' + seccionDe(a) + ')';
    a.addEventListener('click', function () { if (window.MMLmedir) window.MMLmedir.contacto('whatsapp_' + seccionDe(a)); });
    a.setAttribute('href', 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(texto));
    a.setAttribute('rel', 'noopener');
    a.setAttribute('target', '_blank');
  });
  if (!CFG.whatsapp) console.warn('[MML] Falta el número de WhatsApp en assets/config.js. Los botones de WhatsApp llevan al formulario.');

  /* el botón flotante de WhatsApp se esconde mientras el embudo está en pantalla */
  var seccionEmbudo = $('#hablemos');
  if (seccionEmbudo && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      document.body.classList.toggle('en-embudo', es[0].isIntersecting);
    }, { threshold: 0.15 }).observe(seccionEmbudo);
  }

  /* 6 · Los testimonios los arma assets/testimonios.js, compartido con
     /evento. */

  /* ---------------------------------------------------------------------
     7 · Walter en video: su foto hace de portada y YouTube se pide recién
         al tocar reproducir. A diferencia de los testimonios, aquí ni la
         miniatura sale de YouTube: la portada es nuestra.
     --------------------------------------------------------------------- */
  var walterFoto = $('#quienes .retrato-obra');
  var walterId = ((CFG.walter && CFG.walter.youtubeId) || '').trim();
  if (walterFoto && walterId) {
    var bw = document.createElement('button');
    bw.type = 'button';
    bw.className = 'walter-play';
    /* el nombre accesible empieza con el texto que se ve (WCAG 2.5.3): quien
       usa control por voz dice "clic en Mira el video de Walter" y funciona */
    bw.setAttribute('aria-label', 'Mira el video de Walter, de SCP Inmobiliaria');
    walterFoto.replaceWith(bw);
    bw.appendChild(walterFoto);
    bw.insertAdjacentHTML('beforeend',
      '<span class="walter-play-icono" aria-hidden="true"></span>' +
      '<span class="walter-play-texto" aria-hidden="true">Mira el video de Walter</span>');
    var notaW = document.createElement('p');
    notaW.className = 'walter-nota';
    notaW.textContent = 'Se carga desde YouTube solo cuando lo reproduces.';
    bw.after(notaW);
    /* la línea del texto que remite al video solo aparece si hay video */
    var lineaW = $('#quienes .walter-linea');
    if (lineaW) lineaW.hidden = false;
    bw.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.className = 'walter-iframe';
      /* playsinline: en iPhone se queda en la página en vez de saltar a
         pantalla completa */
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(walterId) + '?autoplay=1&rel=0&playsinline=1';
      f.title = 'Video de Walter, de SCP Inmobiliaria';
      f.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.setAttribute('allowfullscreen', '');
      bw.replaceWith(f);
      /* el botón que tenía el foco ya no existe: el foco pasa al video */
      f.focus();
    }, { once: true });
  }

})();
