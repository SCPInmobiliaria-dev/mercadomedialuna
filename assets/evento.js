/* =========================================================================
   Mercado Media Luna — la página del evento: /evento, todos los miércoles
   (desde el 28/09/2026 es la página del sábado 26 con la fecha de los
   miércoles). La configuración sale de <body data-evento="evento"> →
   assets/config.js. También sirve para un evento de una sola fecha si su
   bloque trae "fecha" y "cierreOferta".
   Autocontenida: no depende de app.js ni de embudo.js, que son del hero
   y del formulario largo de la portada.
   Reglas del proyecto que se respetan aquí:
   · ninguna respuesta promete precio, financiamiento, rentabilidad, fechas
     de entrega ni disponibilidad;
   · la web no guarda nada: el mensaje lo manda el visitante desde su propio
     WhatsApp;
   · YouTube: los testimonios se cargan al tocar la foto; el video de
     introducción arranca solo (ver 3b).
   ========================================================================= */
(function () {
  'use strict';

  var CFG = window.MML || {};
  var CLAVE_EV = (document.body && document.body.getAttribute('data-evento')) || 'evento';
  var EV = CFG[CLAVE_EV] || CFG.evento || {};
  /* textos que cambian entre el evento semanal y uno de fecha fija */
  var HORA_TXT = EV.horaTexto || '7:30 p.m.';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reducido = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* =====================================================================
     1 · Entradas de sección
     ===================================================================== */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* =====================================================================
     2 · La fecha: el próximo miércoles a las 7:30 p.m., hora de Lima
     Perú no cambia de hora en todo el año: el desfase con UTC es fijo,
     así que la cuenta sale igual desde cualquier país.
     Dos fases, como tuvo el sábado 26:
       antes  → cuenta hasta las 7:30 p.m. del miércoles;
       envivo → desde las 7:30 p.m. hasta las 11:59:59 p.m. de ese miércoles,
                cuenta hasta el cierre del descuento.
     Pasada la medianoche, la página pasa sola al miércoles siguiente.
     ===================================================================== */
  var LIMA_MIN = -5 * 60;                 // America/Lima = UTC-5, sin horario de verano
  var DIA = EV.diaSemana == null ? 3 : EV.diaSemana;
  var HORA = EV.hora == null ? 19 : EV.hora;
  var MINUTO = EV.minuto == null ? 30 : EV.minuto;
  var SEMANA_MS = 7 * 86400000;
  var GRACIA_MS = 2 * 60 * 60 * 1000;     // solo para un evento de fecha fija sin cierreOferta

  function relojLima(d) { return new Date(d.getTime() + LIMA_MIN * 60000); }   // reloj de pared de Lima
  function desdeLima(ms) { return new Date(ms - LIMA_MIN * 60000); }            // instante real

  /* la sesión de esta semana si todavía no cerró; si ya cerró, la siguiente */
  function sesionSemanal(ahora) {
    var lima = relojLima(ahora);
    var faltanDias = (DIA - lima.getUTCDay() + 7) % 7;
    var y = lima.getUTCFullYear(), mes = lima.getUTCMonth(), dia = lima.getUTCDate() + faltanDias;
    var ini = Date.UTC(y, mes, dia, HORA, MINUTO, 0);
    var fin = Date.UTC(y, mes, dia, 23, 59, 59);
    if (fin <= lima.getTime()) { ini += SEMANA_MS; fin += SEMANA_MS; }
    return { inicio: desdeLima(ini), cierre: desdeLima(fin) };
  }
  function proximaSesion(ahora) { return sesionSemanal(ahora).inicio; }

  /* Evento de una sola fecha (así fue el sábado 26): tres fases, y la tercera,
     terminado, dice que ya pasó. Sin "fecha" en la configuración, semanal. */
  var FECHA_FIJA = EV.fecha ? new Date(EV.fecha) : null;
  var CIERRE = EV.cierreOferta ? new Date(EV.cierreOferta) : null;
  function fase(ahora) {
    var t = ahora.getTime();
    if (FECHA_FIJA) {
      var ini = FECHA_FIJA.getTime();
      var fin = CIERRE ? CIERRE.getTime() : ini + GRACIA_MS;
      var fija = { inicio: FECHA_FIJA, cierre: new Date(fin) };
      if (t < ini) return { fase: 'antes', destino: FECHA_FIJA, sesion: fija };
      if (t < fin) return { fase: 'envivo', destino: new Date(fin), sesion: fija };
      return { fase: 'terminado', destino: null, sesion: fija };
    }
    var s = sesionSemanal(ahora);
    if (t < s.inicio.getTime()) return { fase: 'antes', destino: s.inicio, sesion: s };
    return { fase: 'envivo', destino: s.cierre, sesion: s };
  }
  function sesionSiguiente(s) { return sesionSemanal(new Date(s.cierre.getTime() + 1000)); }

  /* "miércoles 30 de septiembre", armado a mano en hora de Lima: igual en
     todos los navegadores y sin depender de Intl */
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function textoFecha(d, conAnio) {
    var l = relojLima(d);
    return DIAS[l.getUTCDay()] + ' ' + l.getUTCDate() + ' de ' + MESES[l.getUTCMonth()] + (conAnio ? ' de ' + l.getUTCFullYear() : '');
  }
  function mayuscula(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  /* {fecha} {hora} {fechaSiguiente} en los textos de config.js */
  function rellenar(t, f) {
    if (!t) return t;
    f = f || fase(new Date());
    return String(t)
      .replace(/\{fecha\}/g, textoFecha(f.sesion.inicio))
      .replace(/\{fechaSiguiente\}/g, FECHA_FIJA ? '' : textoFecha(sesionSiguiente(f.sesion).inicio))
      .replace(/\{hora\}/g, HORA_TXT);
  }

  /* <span data-fecha> en la página: "miércoles 30 de septiembre";
     data-fecha="anio" le suma el año, "mayus" empieza con mayúscula. */
  var fechaPintada = null;
  function pintarFechas(d) {
    if (fechaPintada === d.getTime()) return;
    fechaPintada = d.getTime();
    $$('[data-fecha]').forEach(function (el) {
      var modo = el.getAttribute('data-fecha') || '';
      var t = textoFecha(d, /anio/.test(modo));
      el.textContent = /mayus/.test(modo) ? mayuscula(t) : t;
    });
  }

  /* =====================================================================
     2b · El cupo del descuento: 10 puestos y 2 tiendas EN TOTAL, hasta
     agotarlos (config.js → evento.cupo). Sin números, la página dice solo el
     total; con números agrega "Quedan…"; en 0 y 0 deja de ofrecerlo.
     ===================================================================== */
  function numeroCupo(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isFinite(n) && n >= 0 ? Math.floor(n) : null;
  }
  function estadoCupo() {
    var cfg = EV.cupo;
    if (!cfg || !cfg.total) return { promo: false, conocido: false, agotada: false };
    var q = cfg.quedan || {};
    var p = numeroCupo(q.puestos), ti = numeroCupo(q.tiendas);
    if (p === null || ti === null) return { promo: true, conocido: false, agotada: false, total: cfg.total };
    p = Math.min(p, cfg.total.puestos); ti = Math.min(ti, cfg.total.tiendas);
    var agotada = p === 0 && ti === 0;
    /* "quedan" solo con fecha de corte; el agotado total vale sin ella */
    if (!agotada && !fechaDeIso(q.al)) return { promo: true, conocido: false, agotada: false, total: cfg.total };
    return { promo: true, conocido: true, puestos: p, tiendas: ti, al: q.al || '', agotada: agotada, total: cfg.total };
  }
  function cuantos(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
  function quedan(n) { return n === 1 ? 'queda' : 'quedan'; }
  function fechaDeIso(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    return m ? Number(m[3]) + ' de ' + MESES[Number(m[2]) - 1] + ' de ' + m[1] : '';
  }
  function textoCupo(e) {
    var al = fechaDeIso(e.al);
    var cola = al ? ' (al ' + al + ').' : '.';
    if (e.puestos === 0) return 'Los puestos de la promoción se agotaron. Con el descuento ' + quedan(e.tiendas) + ' ' + cuantos(e.tiendas, 'tienda', 'tiendas') + cola;
    if (e.tiendas === 0) return 'Las tiendas de la promoción se agotaron. Con el descuento ' + quedan(e.puestos) + ' ' + cuantos(e.puestos, 'puesto', 'puestos') + cola;
    return 'Con el descuento ' + quedan(e.puestos + e.tiendas) + ' ' + cuantos(e.puestos, 'puesto', 'puestos') + ' y ' + cuantos(e.tiendas, 'tienda', 'tiendas') + cola;
  }
  var CUPO = estadoCupo();
  (function pintarCupo() {
    if (!CUPO.promo) return;
    document.body.setAttribute('data-promo', CUPO.agotada ? 'agotada' : 'activa');
    if (CUPO.agotada && $('#oferta') && $('#oferta-fin')) $('#oferta').setAttribute('aria-labelledby', 'oferta-fin');
    if (!CUPO.conocido || CUPO.agotada) return;
    $$('[data-cupo]').forEach(function (el) { el.textContent = textoCupo(CUPO); el.hidden = false; });
    if (CUPO.puestos === 0) document.body.setAttribute('data-promo-puestos', 'agotado');
    [['puestos', CUPO.puestos], ['tiendas', CUPO.tiendas]].forEach(function (par) {
      var tarjeta = $('[data-cupo-tipo="' + par[0] + '"]');
      if (!tarjeta || par[1] !== 0) return;
      tarjeta.classList.add('agotado');
      var aviso = document.createElement('p');
      aviso.className = 'sab-prod-agotado';
      aviso.textContent = 'Agotado en esta promoción';
      tarjeta.insertBefore(aviso, tarjeta.querySelector('dl'));
    });
  })();

  /* la sesión para la que uno se registra: la de la fase, salvo con la
     promoción agotada y la transmisión de hoy ya empezada, que es la siguiente */
  function sesionDeRegistro(f) {
    return (CUPO.agotada && !FECHA_FIJA && f.fase === 'envivo') ? sesionSiguiente(f.sesion) : f.sesion;
  }
  pintarFechas(sesionDeRegistro(fase(new Date())).inicio);

  var cuenta = $('#cuenta');
  if (cuenta) {
    var campos = {
      d: $('[data-cuenta="d"]', cuenta), h: $('[data-cuenta="h"]', cuenta),
      m: $('[data-cuenta="m"]', cuenta), s: $('[data-cuenta="s"]', cuenta)
    };
    var elFecha = $('#cuenta-fecha', cuenta);
    var elVoz = $('#cuenta-voz', cuenta);
    var elRotulo = $('#cuenta-rotulo', cuenta);
    var rotuloOriginal = elRotulo ? elRotulo.innerHTML : '';
    var timer = null;
    var faseActual = null, claveActual = null;

    function pintar() {
      var ahora = new Date();
      var f = fase(ahora);
      /* con la promoción agotada, en vivo ya no hay cierre que contar: se
         cuenta hasta la transmisión siguiente */
      var sinPromo = CUPO.agotada && f.fase === 'envivo';
      var destino = !sinPromo ? f.destino : FECHA_FIJA ? ahora : sesionSiguiente(f.sesion).inicio;
      var clave = f.fase + '|' + f.sesion.inicio.getTime();
      if (clave !== claveActual) {
        claveActual = clave;
        faseActual = f.fase;
        document.body.setAttribute('data-fase', f.fase);
        pintarFechas(sesionDeRegistro(f).inicio);
        if (elRotulo) {
          if (f.fase === 'antes') {
            /* innerHTML crea nodos nuevos: hay que volver a buscar la fecha */
            elRotulo.innerHTML = rotuloOriginal;
            elFecha = $('#cuenta-fecha', cuenta);
          } else if (f.fase === 'envivo') {
            elRotulo.textContent = rellenar(!sinPromo ? (EV.rotuloEnVivo || 'En vivo ahora.')
              : FECHA_FIJA ? (EV.rotuloEnVivoSinPromoFija || 'La transmisión ya empezó.')
              : (EV.rotuloEnVivoSinPromo || 'La transmisión de hoy ya empezó.'), f);
          } else {
            elRotulo.textContent = EV.rotuloTerminado || 'Este evento ya terminó.';
          }
        }
        if (f.fase === 'antes' && elFecha) elFecha.textContent = textoFecha(f.sesion.inicio);
        cuenta.classList.toggle('cuenta-ahora', f.fase === 'envivo' && !sinPromo);
        cuenta.classList.toggle('cuenta-fin', f.fase === 'terminado');
        if (f.fase === 'terminado' && typeof pausarVideoIntro === 'function') pausarVideoIntro();
      }
      if (f.fase === 'terminado') {
        ['d', 'h', 'm', 's'].forEach(function (k) { if (campos[k]) campos[k].textContent = 0; });
        if (elVoz) elVoz.textContent = EV.rotuloTerminado || 'Este evento ya terminó.';
        if (timer) { clearInterval(timer); timer = null; }
        return;
      }
      var falta = Math.max(0, destino.getTime() - ahora.getTime());
      var seg = Math.floor(falta / 1000);
      var d = Math.floor(seg / 86400), h = Math.floor(seg % 86400 / 3600);
      var m = Math.floor(seg % 3600 / 60), s = seg % 60;
      if (campos.d) campos.d.textContent = d;
      if (campos.h) campos.h.textContent = h;
      if (campos.m) campos.m.textContent = m;
      if (campos.s) campos.s.textContent = s;
      /* el resumen hablado no es una región viva: se deja escrito y se
         refresca en silencio, para no interrumpir cada segundo */
      if (elVoz) {
        elVoz.textContent = f.fase === 'antes'
          ? 'Faltan ' + cuantos(d, 'día', 'días') + ', ' + cuantos(h, 'hora', 'horas') + ' y ' + cuantos(m, 'minuto', 'minutos') + ' para el evento del ' + textoFecha(f.sesion.inicio) + ', ' + HORA_TXT + ', hora de Perú.'
          : sinPromo
            ? (FECHA_FIJA ? 'La transmisión ya empezó.' : 'La transmisión de hoy ya empezó. La siguiente es en ' + cuantos(d, 'día', 'días') + ', ' + cuantos(h, 'hora', 'horas') + ' y ' + cuantos(m, 'minuto', 'minutos') + '.')
            : 'El evento empezó. La oferta vence en ' + cuantos(h, 'hora', 'horas') + ' y ' + cuantos(m, 'minuto', 'minutos') + '.';
      }
    }

    function correr() {
      if (timer) clearInterval(timer);
      timer = null;
      pintar();
      if (!document.hidden && faseActual !== 'terminado') timer = setInterval(pintar, 1000);
    }
    document.addEventListener('visibilitychange', correr);
    correr();
  }

  /* =====================================================================
     3 · El video: fachada primero, YouTube solo al tocar reproducir
     ===================================================================== */
  var caja = $('#ev-player');
  if (caja) {
    var id = (EV.youtubeId || '').trim();
    if (!id) {
      caja.innerHTML =
        '<div class="ev-player-vacio"><p class="pend">' +
        '[PENDIENTE: id del video del evento en YouTube. Se carga en assets/config.js → evento.youtubeId]' +
        '</p></div>';
    } else {
      var boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'ev-play';
      boton.setAttribute('aria-label', 'Reproducir el video del evento');
      boton.style.backgroundImage = "url('https://i.ytimg.com/vi/" + id + "/maxresdefault.jpg')";
      boton.innerHTML = '<span class="ev-play-icono" aria-hidden="true"></span><span class="ev-play-texto">Ver el video</span>';
      boton.addEventListener('click', function () {
        var marco = document.createElement('iframe');
        marco.className = 'ev-iframe';
        marco.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
        marco.title = 'Video informativo del Mercado Media Luna';
        marco.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture';
        marco.setAttribute('allowfullscreen', '');
        boton.replaceWith(marco);
        if (window.MMLmedir) window.MMLmedir.evento('EventoVideoPlay');
      });
      caja.appendChild(boton);
    }
  }

  /* =====================================================================
     3b · Video de introducción que arranca solo
     Se configura con un enlace de YouTube en config.js → <evento>.videoIntro.
     Intenta arrancar con sonido; donde el navegador no lo deja, arranca sin
     sonido y el primer toque en la página lo activa (ver montarVideoIntro).
     ===================================================================== */
  function idDeYoutube(v) {
    v = String(v || '').trim();
    if (!v) return '';
    var m = v.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    return /^[A-Za-z0-9_-]{11}$/.test(v) ? v : '';
  }
  /* La API oficial de YouTube: hace falta para saber si el video arrancó con
     sonido y para activarlo después sin volver a empezar. */
  var playerIntro = null, colaApiYT = null;
  function cargarApiYT(listo, falla) {
    if (window.YT && window.YT.Player) { listo(); return; }
    if (colaApiYT) { colaApiYT.push(listo); return; }
    colaApiYT = [listo];
    var previo = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (typeof previo === 'function') { try { previo(); } catch (err) {} }
      var cola = colaApiYT; colaApiYT = [];
      cola.forEach(function (f) { f(); });
    };
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = falla;
    document.head.appendChild(s);
  }

  /* Intenta arrancar CON sonido, como pidió Patriccio. Ningún navegador lo
     permite en la primera visita sin que la persona toque algo (Chrome,
     Safari, Edge y Firefox lo bloquean). Si se bloquea, arranca sin sonido,
     aparece "Activar el sonido" sobre el video, y el primer toque en
     cualquier parte de la página lo activa sin volver a empezar. */
  function montarVideoIntro(valor, formato) {
    var cajaIntro = $('#sab-video');
    var idIntro = idDeYoutube(valor);
    if (!cajaIntro || !idIntro) return false;
    if (playerIntro && playerIntro.destroy) { try { playerIntro.destroy(); } catch (err) {} }
    playerIntro = null;
    cajaIntro.textContent = '';
    cajaIntro.classList.toggle('sab-video-vertical', formato === 'vertical');
    var marcoIntro = document.createElement('div');
    marcoIntro.className = 'sab-video-marco';
    var hueco = document.createElement('div');
    hueco.className = 'sab-video-hueco';
    var botonSonido = document.createElement('button');
    botonSonido.type = 'button';
    botonSonido.className = 'sab-sonido';
    botonSonido.hidden = true;
    botonSonido.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06A9 9 0 0 0 14 3.23z"/></svg><span>Activar el sonido</span>';
    var notaIntro = document.createElement('p');
    notaIntro.className = 'sab-video-nota';
    notaIntro.hidden = true;
    notaIntro.textContent = 'Toca el altavoz del video para escucharlo.';
    marcoIntro.appendChild(hueco);
    marcoIntro.appendChild(botonSonido);
    cajaIntro.appendChild(marcoIntro);
    cajaIntro.appendChild(notaIntro);
    cajaIntro.hidden = false;

    var tituloIntro = EV.videoIntroTitulo || 'Video de introducción del evento';
    var srcBase = 'https://www.youtube-nocookie.com/embed/' + idIntro + '?playsinline=1&rel=0';
    var marcoPlano = null, resuelto = false, pidioSonido = false, intentos = 0, vigia = null;
    /* al soltar, no al apoyar: en pantallas táctiles solo el toque completo
       da permiso de sonido, y deslizar para bajar no cuenta */
    var GESTOS = ['pointerup', 'touchend', 'keydown'];

    function ponerGestos() { GESTOS.forEach(function (g) { document.addEventListener(g, activarSonido, true); }); }
    function quitarGestos() { GESTOS.forEach(function (g) { document.removeEventListener(g, activarSonido, true); }); }
    function sonando() {
      try { return playerIntro.getPlayerState() === 1 && !playerIntro.isMuted(); } catch (err) { return false; }
    }
    function yaSuena() {
      botonSonido.hidden = true; notaIntro.hidden = true;
      quitarGestos(); clearInterval(vigia);
    }
    function pedirSonido() {
      botonSonido.hidden = false;
      /* si lo activa desde el propio reproductor de YouTube, el botón se va */
      clearInterval(vigia);
      vigia = setInterval(function () { if (sonando()) yaSuena(); }, 1000);
    }
    function activarSonido() {
      pidioSonido = true;
      intentos++;
      quitarGestos();
      if (playerIntro && playerIntro.unMute) {
        try { playerIntro.unMute(); playerIntro.setVolume(100); playerIntro.playVideo(); } catch (err) {}
        setTimeout(function () {
          if (sonando()) { yaSuena(); return; }
          if (intentos < 2) { ponerGestos(); return; }
          /* el navegador exige tocar el propio reproductor (Safari del
             iPhone): el botón se quita para que el toque llegue al altavoz */
          botonSonido.hidden = true; notaIntro.hidden = false;
        }, 900);
      } else if (marcoPlano) {
        /* sin la API no se puede quitar el silencio: se recarga con sonido,
           que el toque del visitante sí permite */
        marcoPlano.src = srcBase + '&autoplay=1';
        yaSuena();
      }
    }
    ponerGestos();
    botonSonido.addEventListener('click', activarSonido);

    /* si la API de YouTube no carga, un iframe simple que arranca sin sonido */
    function planoMudo() {
      if (resuelto) return;
      resuelto = true;
      marcoPlano = document.createElement('iframe');
      marcoPlano.src = srcBase + '&autoplay=1&mute=1';
      marcoPlano.title = tituloIntro;
      marcoPlano.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      marcoPlano.setAttribute('allowfullscreen', '');
      hueco.replaceWith(marcoPlano);
      pedirSonido();
    }
    var esperaApi = setTimeout(planoMudo, 6000);

    cargarApiYT(function () {
      if (resuelto) return;
      resuelto = true;
      clearTimeout(esperaApi);
      playerIntro = new window.YT.Player(hueco, {
        host: 'https://www.youtube-nocookie.com',
        videoId: idIntro,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: function (e) {
            var p = e.target;
            try { p.getIframe().title = tituloIntro; } catch (err) {}
            try { p.unMute(); p.setVolume(100); p.playVideo(); } catch (err) {}
            /* ¿el navegador lo dejó sonar? */
            var revisar = function (intento) {
              if (pidioSonido) return;   // ya tocó: no volver a silenciarlo
              var estado = -1, mudo = true;
              try { estado = p.getPlayerState(); mudo = p.isMuted(); } catch (err) {}
              if (estado === 1 && !mudo) { yaSuena(); return; }
              if (estado === 3 && !mudo && intento < 3) { setTimeout(function () { revisar(intento + 1); }, 1000); return; }
              /* bloqueado: sin sonido para que por lo menos se vea */
              try { p.mute(); p.playVideo(); } catch (err) {}
              pedirSonido();
            };
            setTimeout(function () { revisar(0); }, 1500);
          }
        }
      });
    }, planoMudo);
    return true;
  }
  /* para las pruebas: estado del video, sin datos del visitante */
  function estadoVideoIntro() {
    if (playerIntro && playerIntro.getPlayerState) {
      try { return { api: true, estado: playerIntro.getPlayerState(), mudo: playerIntro.isMuted() }; } catch (err) { return { api: true }; }
    }
    var f = $('#sab-video iframe');
    return f ? { api: false, src: f.src } : null;
  }
  function pausarVideoIntro() { try { if (playerIntro && playerIntro.pauseVideo) playerIntro.pauseVideo(); } catch (err) {} }
  if (EV.videoIntro && !(FECHA_FIJA && fase(new Date()).fase === 'terminado')) montarVideoIntro(EV.videoIntro.enlace, EV.videoIntro.formato);

  /* 4 · Los testimonios los arma assets/testimonios.js (foto, estrellas, cita
     y video en una sola tarjeta). */

  /* =====================================================================
     5 · Botones de WhatsApp sueltos
     ===================================================================== */
  $$('[data-wa]').forEach(function (a) {
    if (!CFG.whatsapp) {
      a.setAttribute('href', '#registro');
      a.setAttribute('title', 'Número de WhatsApp pendiente: ver assets/config.js');
      return;
    }
    a.setAttribute('href', 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(EV.mensajeWa || 'Hola, vi la página del evento de los miércoles de Mercado Media Luna y quiero información.'));
    a.setAttribute('rel', 'noopener');
    a.setAttribute('target', '_blank');
    a.addEventListener('click', function () { if (window.MMLmedir) window.MMLmedir.contacto('whatsapp_evento'); });
  });
  if (!CFG.whatsapp) console.warn('[MML] Falta el número de WhatsApp en assets/config.js.');

  var seccionRegistro = $('#registro');
  if (seccionRegistro && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      document.body.classList.toggle('en-embudo', es[0].isIntersecting);
    }, { threshold: 0.15 }).observe(seccionRegistro);
  }

  /* =====================================================================
     5b · La cuenta del alquiler (solo en la página que la trae)
     La misma cuenta que la calculadora de la portada: alquiler × 12 × años.
     Los números los pone el visitante; la página no sugiere ninguno.
     ===================================================================== */
  var calc = $('#sab-calc');
  if (calc) {
    var monto = $('#sab-monto', calc), anios = $('#sab-anios', calc), res = $('#sab-calc-res', calc);
    var fmtSoles = function (n) { try { return n.toLocaleString('es-PE'); } catch (err) { return String(n); } };
    var cuentaAlquiler = function () {
      var m = Math.max(0, Math.round(Number(monto.value) || 0));
      var a = Number(anios.value) || 10;
      res.textContent = '';
      if (!m) { res.textContent = 'Escribe tu alquiler y aquí sale la cuenta.'; res.classList.remove('lleno'); return; }
      res.append('En ' + a + ' años son ');
      var cifra = document.createElement('strong');
      cifra.textContent = 'S/ ' + fmtSoles(m * 12 * a);
      res.append(cifra, ' que pagas y no vuelven.');
      res.classList.add('lleno');
    };
    calc.addEventListener('submit', function (ev) { ev.preventDefault(); });
    monto.addEventListener('input', cuentaAlquiler);
    anios.addEventListener('change', cuentaAlquiler);
  }

  /* =====================================================================
     6 · El registro: embudo corto
     Cuatro toques, nombre y apellidos, y el documento solo si se quiere.
     ===================================================================== */
  var raiz = $('#chat');
  if (!raiz) return;

  var log = $('.chat-log', raiz);
  var zona = $('.chat-zona', raiz);
  var barra = $('.chat-barra i', raiz);
  var pasoTxt = $('.chat-paso', raiz);
  var atras = $('.chat-atras', raiz);
  zona.tabIndex = -1;

  /* una sola sesión para todo el registro: la pregunta, el resumen y el
     mensaje de WhatsApp dicen el mismo miércoles aunque la página quede abierta
     al pasar la medianoche */
  var fChat = fase(new Date());
  var F_CHAT = { fase: fChat.fase, sesion: sesionDeRegistro(fChat) };

  var PIDE_DOC = EV.pedirDocumento === 'obligatorio' ? 'obligatorio'
    : EV.pedirDocumento === 'no' ? 'no' : 'opcional';

  var PREGUNTAS = [
    {
      id: 'uso', texto: '¿Para qué quieres el puesto?',
      opciones: [
        { v: 'operar', t: 'Para trabajarlo yo' },
        { v: 'invertir', t: 'Como inversión' },
        { v: 'viendo', t: 'Todavía lo estoy viendo' }
      ],
      eco: { invertir: 'De frente: en el evento no vas a escuchar un número de rentabilidad. El mercado todavía no abre y cualquier porcentaje sería inventado.' }
    },
    {
      id: 'alquiler', texto: '¿Hoy pagas alquiler por tu puesto o local?',
      opciones: [
        { v: 'si', t: 'Sí, pago alquiler' },
        { v: 'calle', t: 'Vendo en la calle o en feria' },
        { v: 'propio', t: 'No, ya tengo local propio' },
        { v: 'sin_negocio', t: 'Todavía no tengo negocio' }
      ],
      eco: { si: 'Entonces ya sabes lo que es pagar cada mes por un sitio que no es tuyo.' }
    },
    {
      id: 'zona', texto: '¿Desde dónde nos acompañas?',
      opciones: [
        { v: 'cerca', t: 'Cerca de Jicamarca' },
        { v: 'lima', t: 'Otra zona de Lima' },
        { v: 'provincia', t: 'Provincia' },
        { v: 'extranjero', t: 'Fuera del Perú' }
      ],
      eco: {
        provincia: 'Sin problema. La obra se puede recorrer completa por videollamada.',
        extranjero: 'Sin problema. Toma en cuenta que la sesión es a las ' + HORA_TXT + ' hora de Perú.'
      }
    },
    asistencia(EV.preguntaAsistencia) || {
      id: 'miercoles', texto: '¿Puedes este miércoles a las 7:30 p.m.?', rotulo: 'Este miércoles',
      opciones: [
        { v: 'si', t: 'Sí, cuenta conmigo' },
        { v: 'otro', t: 'Prefiero otro miércoles' },
        { v: 'info', t: 'Mándame la información primero' }
      ],
      eco: {
        otro: 'Anotado. Hay sesión todos los miércoles, coordinamos la que te quede.',
        info: 'Listo. Te mandamos la información y te avisamos de la siguiente sesión.'
      }
    }
  ];

  /* la pregunta de asistencia de config.js, con {fecha} y {hora} ya puestos */
  function asistencia(p) {
    if (!p) return null;
    var eco = {}, origen = (CUPO.agotada && p.ecoSinPromo) ? Object.assign({}, p.eco, p.ecoSinPromo) : (p.eco || {});
    Object.keys(origen).forEach(function (k) { eco[k] = rellenar(origen[k], F_CHAT); });
    return { id: p.id, texto: rellenar(p.texto, F_CHAT), rotulo: rellenar(p.rotulo, F_CHAT), opciones: p.opciones, eco: eco };
  }

  var ROTULOS = { uso: 'El puesto', alquiler: 'Hoy', zona: 'Me conecto desde' };
  ROTULOS[PREGUNTAS[3].id] = PREGUNTAS[3].rotulo || 'Asistencia';

  var SALUDO = EV.saludo ? EV.saludo.map(function (t) { return rellenar(t, F_CHAT); }) : [
    'Hola. Este es el registro automático del evento de los miércoles.',
    'Son cuatro preguntas rápidas y tu nombre. Menos de un minuto.'
  ];

  var respuestas = {}, textos = {};
  var contacto = { nombre: '', apellidos: '', documento: '' };
  var turno = 0, iniciado = false, interactuo = false, docResuelto = false;

  function pasoActual() {
    for (var i = 0; i < PREGUNTAS.length; i++) if (!(PREGUNTAS[i].id in respuestas)) return PREGUNTAS[i];
    if (!contacto.nombre) return 'nombre';
    if (PIDE_DOC !== 'no' && !docResuelto) return 'documento';
    return 'resumen';
  }
  function claveDe(p) { return typeof p === 'object' ? p.id : p; }
  function pasosHechos() {
    var hechos = PREGUNTAS.filter(function (p) { return p.id in respuestas; }).map(function (p) { return p.id; });
    if (contacto.nombre) hechos.push('nombre');
    if (PIDE_DOC !== 'no' && docResuelto) hechos.push('documento');
    return hechos;
  }
  function totalPasos() { return PREGUNTAS.length + (PIDE_DOC !== 'no' ? 2 : 1); }

  function burbuja(clase, texto, paso) {
    var b = document.createElement('div');
    b.className = 'msg ' + clase;
    b.textContent = texto;
    b.setAttribute('data-paso', paso || '');
    log.appendChild(b);
    return b;
  }
  function bot(t, p) { return burbuja('msg-bot', t, p); }
  function yo(t, p) { return burbuja('msg-yo', t, p); }

  function escribiendo() {
    var t = document.createElement('div');
    t.className = 'msg msg-bot msg-escribiendo';
    t.setAttribute('aria-hidden', 'true');
    t.innerHTML = '<i></i><i></i><i></i>';
    log.appendChild(t);
    return t;
  }
  var esperar = function (ms) { return new Promise(function (r) { setTimeout(r, reducido.matches ? 0 : ms); }); };

  function decir(lineas, miTurno) {
    return lineas.reduce(function (cadena, linea) {
      return cadena.then(function () {
        if (miTurno !== turno) return;
        var t = escribiendo();
        if (interactuo) mantenerVisible();
        return esperar(Math.min(1100, 380 + linea.texto.length * 11)).then(function () {
          t.remove();
          if (miTurno === turno) bot(linea.texto, linea.paso);
        });
      });
    }, Promise.resolve());
  }

  function mantenerVisible() {
    var r = zona.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 12 || r.top < 0) {
      zona.scrollIntoView({ block: 'nearest', behavior: reducido.matches ? 'auto' : 'smooth' });
    }
  }
  function anclarFoco() {
    var a = document.activeElement;
    if (a && (zona.contains(a) || a === atras)) zona.focus({ preventScroll: true });
  }

  function actualizarCabecera() {
    var hechos = pasosHechos().length, total = totalPasos();
    barra.style.transform = 'scaleX(' + (hechos / total).toFixed(3) + ')';
    pasoTxt.textContent = pasoActual() === 'resumen' ? 'Listo para enviar' : 'Paso ' + Math.min(hechos + 1, total) + ' de ' + total;
    if (hechos === 0 && document.activeElement === atras) zona.focus({ preventScroll: true });
    atras.hidden = hechos === 0;
  }

  function siguiente(ecos) {
    var miTurno = ++turno;
    zona.textContent = '';
    actualizarCabecera();
    var p = pasoActual();
    var clave = claveDe(p);
    var lineas = (ecos || []).slice();
    if (typeof p === 'object') lineas.push({ texto: p.texto, paso: clave });
    else if (p === 'nombre') lineas.push({ texto: 'Último paso. ¿Cómo te llamas?', paso: clave });
    else if (p === 'documento') lineas.push({ texto: textoDocumento(), paso: clave });
    else lineas.push({ texto: contacto.nombre.split(' ')[0] + ', esto es lo que le llega al equipo:', paso: 'resumen' });

    decir(lineas, miTurno).then(function () {
      if (miTurno !== turno) return;
      if (typeof p === 'object') mostrarOpciones(p);
      else if (p === 'nombre') mostrarNombre();
      else if (p === 'documento') mostrarDocumento();
      else mostrarResumen();
      if (interactuo) mantenerVisible();
    });
  }

  var ultimoPorTeclado = false;
  document.addEventListener('keydown', function () { ultimoPorTeclado = true; }, true);
  document.addEventListener('pointerdown', function () { ultimoPorTeclado = false; }, true);

  function mostrarOpciones(p) {
    var grupo = document.createElement('div');
    grupo.className = 'chips';
    grupo.setAttribute('role', 'group');
    grupo.setAttribute('aria-label', p.texto);
    p.opciones.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = o.t;
      b.addEventListener('click', function () { responder(p, o); });
      grupo.appendChild(b);
    });
    zona.appendChild(grupo);
    if (ultimoPorTeclado) grupo.querySelector('button').focus({ preventScroll: true });
  }

  function responder(p, o) {
    if (p.id in respuestas) return;
    if (!interactuo && window.MMLmedir) window.MMLmedir.evento('EventoRegistroInicio');
    interactuo = true;
    anclarFoco();
    respuestas[p.id] = o.v;
    textos[p.id] = o.t;
    zona.textContent = '';
    yo(o.t, p.id);
    var eco = p.eco && p.eco[o.v];
    siguiente(eco ? [{ texto: eco, paso: p.id }] : []);
  }

  /* ---- nombre y apellidos, en un solo paso ---- */
  function mostrarNombre() {
    var f = document.createElement('form');
    f.className = 'chat-campo chat-campo-doble';
    f.noValidate = true;
    f.innerHTML =
      '<label class="sr" for="ev-nombre">Tus nombres</label>' +
      '<input id="ev-nombre" type="text" autocomplete="given-name" placeholder="Nombres" aria-describedby="ev-nombre-error" required>' +
      '<label class="sr" for="ev-apellidos">Tus apellidos</label>' +
      '<input id="ev-apellidos" type="text" autocomplete="family-name" placeholder="Apellidos" aria-describedby="ev-nombre-error" required>' +
      '<button type="submit" class="chat-enviar" aria-label="Enviar">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6l-.02 6.53L15 12 3.38 13.87z"/></svg></button>' +
      '<p class="chat-error" id="ev-nombre-error" role="alert"></p>' +
      '<div class="trampa" aria-hidden="true"><input type="text" name="web" tabindex="-1" autocomplete="off"></div>';
    var nom = $('#ev-nombre', f), ape = $('#ev-apellidos', f), error = $('.chat-error', f);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if ($('[name=web]', f).value) return;
      interactuo = true;
      var n = nom.value.trim().replace(/\s+/g, ' ');
      var a = ape.value.trim().replace(/\s+/g, ' ');
      if (n.length < 2) { error.textContent = 'Escribe tu nombre, por favor.'; nom.focus(); return; }
      if (a.length < 2) { error.textContent = 'Escribe tus apellidos, por favor.'; ape.focus(); return; }
      anclarFoco();
      contacto.nombre = n;
      contacto.apellidos = a;
      zona.textContent = '';
      yo(n + ' ' + a, 'nombre');
      siguiente();
    });
    zona.appendChild(f);
    nom.focus({ preventScroll: true });
  }

  /* ---- documento: DNI en Perú, documento de identidad fuera ---- */
  function esDeFuera() { return respuestas.zona === 'extranjero'; }
  function rotuloDoc() { return esDeFuera() ? 'documento de identidad' : 'DNI'; }
  function textoDocumento() {
    return PIDE_DOC === 'obligatorio'
      ? '¿Cuál es tu ' + rotuloDoc() + '?'
      : '¿Me das tu ' + rotuloDoc() + '? Nos sirve para tener tus documentos listos si más adelante decides separar. Si prefieres, sáltalo.';
  }
  function normalizarDoc(v) {
    var s = String(v || '').replace(/[\s.-]/g, '').toUpperCase();
    if (esDeFuera()) return /^[A-Z0-9]{6,15}$/.test(s) ? s : null;
    return /^\d{8}$/.test(s) ? s : null;
  }

  function mostrarDocumento() {
    var f = document.createElement('form');
    f.className = 'chat-campo';
    f.noValidate = true;
    f.innerHTML =
      '<label class="sr" for="ev-doc">Tu ' + rotuloDoc() + '</label>' +
      '<input id="ev-doc" type="text" inputmode="' + (esDeFuera() ? 'text' : 'numeric') + '" ' +
      'placeholder="' + (esDeFuera() ? 'Número de tu documento' : '12345678') + '" aria-describedby="ev-doc-error" ' +
      (esDeFuera() ? '' : 'maxlength="8" ') + '>' +
      '<button type="submit" class="chat-enviar" aria-label="Enviar">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6l-.02 6.53L15 12 3.38 13.87z"/></svg></button>' +
      '<p class="chat-error" id="ev-doc-error" role="alert"></p>' +
      '<p class="chat-ayuda">Esta web no guarda tu documento. Va dentro del mensaje que mandas tú por WhatsApp.</p>' +
      '<div class="trampa" aria-hidden="true"><input type="text" name="web" tabindex="-1" autocomplete="off"></div>';
    var input = $('#ev-doc', f), error = $('.chat-error', f);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if ($('[name=web]', f).value) return;
      interactuo = true;
      var doc = normalizarDoc(input.value);
      if (!doc) {
        error.textContent = esDeFuera()
          ? 'Revisa el número de tu documento.'
          : 'El DNI son 8 dígitos.';
        input.focus(); return;
      }
      anclarFoco();
      contacto.documento = doc;
      docResuelto = true;
      zona.textContent = '';
      yo(doc, 'documento');
      siguiente();
    });
    zona.appendChild(f);

    if (PIDE_DOC === 'opcional') {
      var saltar = document.createElement('button');
      saltar.type = 'button';
      saltar.className = 'chat-saltar';
      saltar.textContent = 'Prefiero no ponerlo ahora';
      saltar.addEventListener('click', function () {
        interactuo = true;
        anclarFoco();
        contacto.documento = '';
        docResuelto = true;
        zona.textContent = '';
        yo('Prefiero no ponerlo ahora', 'documento');
        siguiente();
      });
      zona.appendChild(saltar);
    }
    input.focus({ preventScroll: true });
  }

  /* ---- resumen y envío ---- */
  function lineasResumen() {
    return PREGUNTAS.filter(function (p) { return p.id in textos; }).map(function (p) {
      var t = textos[p.id];
      return ROTULOS[p.id] + ': ' + t.charAt(0).toLowerCase() + t.slice(1);
    });
  }

  function etiquetaOrigen() {
    var src = (new URLSearchParams(location.search).get('utm_source') || '').toLowerCase();
    if (/meta|fb|facebook|ig|instagram/.test(src)) return 'anuncio';
    if (/referido|ref/.test(src)) return 'referido';
    return 'página del evento';
  }

  function mensajeWhatsApp() {
    return 'Hola, soy ' + contacto.nombre + ' ' + contacto.apellidos + '. ' +
      (rellenar(EV.mensajeRegistro, F_CHAT) || 'Quiero registrarme al evento informativo de los miércoles, 7:30 p.m.') + ' (' + etiquetaOrigen() + ').\n' +
      lineasResumen().map(function (l) { return '• ' + l; }).join('\n') +
      (contacto.documento ? '\n• ' + (esDeFuera() ? 'Documento' : 'DNI') + ': ' + contacto.documento : '');
  }

  function mostrarResumen() {
    var tarjeta = document.createElement('div');
    tarjeta.className = 'chat-resumen';
    tarjeta.tabIndex = -1;
    tarjeta.setAttribute('role', 'group');
    tarjeta.setAttribute('aria-label', 'Resumen de tu registro');
    var ul = document.createElement('ul');
    var filas = lineasResumen().concat(['Nombre: ' + contacto.nombre + ' ' + contacto.apellidos]);
    if (contacto.documento) filas.push((esDeFuera() ? 'Documento' : 'DNI') + ': ' + contacto.documento);
    filas.forEach(function (l) { var li = document.createElement('li'); li.textContent = l; ul.appendChild(li); });
    tarjeta.appendChild(ul);
    zona.appendChild(tarjeta);

    var acciones = document.createElement('div');
    acciones.className = 'chat-acciones';

    if (!CFG.whatsapp) {
      var sin = document.createElement('p');
      sin.className = 'chat-error';
      sin.textContent = 'Estamos activando el número de WhatsApp. Vuelve en un rato.';
      acciones.appendChild(sin);
      console.warn('[MML] Falta el número en assets/config.js (whatsapp).');
    } else {
      var a = document.createElement('a');
      a.className = 'btn btn-accent btn-big';
      a.href = 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(mensajeWhatsApp());
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Enviar mi registro por WhatsApp';
      var avisado = false;
      a.addEventListener('click', function () {
        if (avisado) return;
        avisado = true;
        if (window.MMLmedir) window.MMLmedir.lead('evento_whatsapp');
        var miTurno = ++turno;
        setTimeout(function () {
          decir([{ texto: rellenar(EV.confirmacion, F_CHAT) || 'Listo. Si se abrió tu WhatsApp, dale enviar y te confirmamos el lugar.', paso: 'envio' }], miTurno);
        }, 400);
      });
      acciones.appendChild(a);
      var nota = document.createElement('p');
      nota.className = 'chat-ayuda';
      nota.append('Se abre tu WhatsApp con este registro ya escrito. Tú decides si lo mandas. ');
      var enlace = document.createElement('a');
      enlace.href = 'privacidad.html';
      enlace.target = '_blank';
      enlace.rel = 'noopener';
      enlace.textContent = 'Aviso de privacidad';
      nota.append(enlace, '.');
      acciones.appendChild(nota);
    }
    zona.appendChild(acciones);
    if (ultimoPorTeclado || document.activeElement === zona) tarjeta.focus({ preventScroll: true });
  }

  /* ---- atrás ---- */
  atras.addEventListener('click', function () {
    var hechos = pasosHechos();
    var revertir = hechos[hechos.length - 1];
    if (!revertir) return;
    interactuo = true;
    anclarFoco();
    if (revertir === 'nombre') { contacto.nombre = ''; contacto.apellidos = ''; }
    else if (revertir === 'documento') { contacto.documento = ''; docResuelto = false; }
    else { delete respuestas[revertir]; delete textos[revertir]; }
    var desde = log.querySelector('[data-paso="' + revertir + '"]');
    while (desde && desde.nextSibling) desde.parentNode.removeChild(desde.nextSibling);
    if (desde) desde.remove();
    siguiente();
  });

  /* ---- arranque ---- */
  function iniciar() {
    if (iniciado) return;
    iniciado = true;
    siguiente(SALUDO.map(function (t) { return { texto: t, paso: 'saludo' }; }));
  }
  if ('IntersectionObserver' in window) {
    var ioChat = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { iniciar(); ioChat.disconnect(); }
    }, { threshold: 0.25 });
    ioChat.observe(raiz);
  } else {
    iniciar();
  }
  actualizarCabecera();

  /* para las pruebas automáticas: solo funciones, ningún dato del visitante */
  window.__evento = { proximaSesion: proximaSesion, sesionSemanal: sesionSemanal, fase: fase, textoFecha: textoFecha, rellenar: rellenar, estadoCupo: estadoCupo, textoCupo: textoCupo, mensaje: mensajeWhatsApp, idDeYoutube: idDeYoutube, montarVideoIntro: montarVideoIntro, estadoVideoIntro: estadoVideoIntro };
})();
