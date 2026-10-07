/* =========================================================================
   Mercado Media Luna — plano interactivo con la disponibilidad en vivo
   (planos.html). Diseño: 02-marketing/diseño/InventarioGraficoWeb.

   De dónde salen los datos
   ------------------------
   El inventario del CRM (Supabase, proyecto crm-mml) es la ÚNICA fuente.
   Esta página no guarda ni calcula disponibilidad: la lee de la función
   pública fn_inventario_publico(), que devuelve por unidad solo código,
   tipo, área, rubro, polígono, uno de tres estados (disponible, separada,
   no_disponible) y, desde el 06/10/2026, su precio. En el CRM
   (07-crm/02-codigo/crm-mml/sql/):
   · 16-inventario-publico.sql: la función y el aviso por Realtime (en vivo
     desde el 05/10/2026). "Disponible" lo decide v_unidades_ofrecibles.
   · 18-geometria-plano.sql: los polígonos salen de las paredes del PDF de
     arquitectura (06/10/2026). Por eso el fondo del plano es esa misma
     lámina (assets/plano-base-a1-v1.webp) y no un contorno trazado a mano.
   · 19-precio-por-unidad.sql: la clave "precio" {monto, moneda}, solo de
     una unidad disponible cuyo nivel de precio está en verde.
   · Si el CRM agrega "verificada" (false = el dato de la unidad todavía no
     está confirmado contra el plano), la unidad disponible se dibuja con un
     rayado fino y "por confirmar contra el plano" (decisión de SCP por chat,
     06/10/2026). Sin esa clave, todo lo disponible cuenta como verificado.

   Cómo se entera de un cambio
   ---------------------------
   1. Realtime: un WebSocket al canal público 'inventario-publico'. El CRM
      manda el evento 'cambio' (sin datos) cada vez que se toca una unidad,
      una separación, una oportunidad o un nivel de precio; aquí se espera
      ~0.8 s por si llegan varios juntos y se vuelve a leer la función.
   2. Sondeo de respaldo: cada 20 s con el canal arriba (por si se perdió un
      aviso) y cada 10 s sin él (la respuesta pesa unos 10 KB comprimida).
      También al volver a la pestaña, al recuperar la red y al enfocar la
      ventana.
   Solo se repinta si cambió la revisión (el md5 que manda el CRM).

   Qué se muestra cuando algo falla
   --------------------------------
   · "Confirmado" = la última lectura salió bien y hace poco (hasta dos
     intervalos de sondeo). Si no, la página dice "Sin conexión ·
     disponibilidad sin confirmar" y no deja pedir la separación.
   · Antes de abrir WhatsApp se vuelve a leer el inventario y se comprueba
     que la unidad sigue disponible.
   · Si la PRIMERA lectura falla (sin red, o la función no responde), se
     muestra el plano de arquitectura como imagen, sin disponibilidad, y se
     sigue intentando: en cuanto hay datos, aparece el plano interactivo.

   Precios ("cada unidad con su precio", SCP por chat, 06/10/2026)
   ---------------------------------------------------------------
   · En cuanto el CRM publica el precio de AL MENOS UNA unidad, el CRM es la
     única fuente: cada unidad muestra el suyo y la que no lo tiene dice
     "te lo cotizamos". En dólares se le suman los soles con
     precios.tipoCambioValor de config.js (Ley 29571 art. 6).
   · Mientras el CRM no publique ninguno (todos los niveles sin verde, o una
     función sin la clave "precio"), sigue la regla de config.js de siempre:
     puesto de 9 a 10 m² y tienda de 22 a 23 m². Las dos fuentes nunca se
     mezclan en la misma pantalla.
   · En los dos casos, sin las notas de IGV, notarial y tipo de cambio de
     config.js no se muestra ningún precio.

   Para las pruebas: window.MMLInventario.estado() y .recargar() (solo
   lectura). Se puede apuntar a otro servidor con
   window.MML.inventario.supabaseUrl / .supabaseAnonKey.
   ========================================================================= */
(function () {
  'use strict';

  var raiz = document.getElementById('inv');
  if (!raiz) return;

  var CFG = window.MML || {};
  var INV = CFG.inventario || {};
  var PRE = INV.precios || {};

  function numero(v, porDefecto, min, max) {
    v = Number(v);
    return isFinite(v) && v >= min && v <= max ? v : porDefecto;
  }
  function texto(v) { return typeof v === 'string' ? v.trim() : ''; }

  var OPC = {
    base: texto(INV.supabaseUrl || CFG.supabaseUrl).replace(/\/+$/, ''),
    llave: texto(INV.supabaseAnonKey || CFG.supabaseAnonKey),
    rpc: /^[a-z_][a-z0-9_]{0,62}$/i.test(texto(INV.rpc)) ? texto(INV.rpc) : 'fn_inventario_publico',
    canal: /^[A-Za-z0-9_.:-]{1,100}$/.test(texto(INV.canal)) ? texto(INV.canal) : 'inventario-publico',
    evento: texto(INV.evento) || 'cambio',
    conRealtime: numero(INV.sondeoConRealtimeSeg, 20, 5, 3600) * 1000,
    sinRealtime: numero(INV.sondeoSinRealtimeSeg, 10, 3, 3600) * 1000,
    tiempoMaximo: numero(INV.tiempoMaximoMs, 8000, 1000, 60000),
    rebote: numero(INV.reboteMs, 800, 0, 10000),
    latido: numero(INV.latidoSeg, 25, 5, 25) * 1000,
    realtime: INV.realtime !== false
  };

  /* Los precios se publican completos o no se publican: sin IGV, notarial y
     tipo de cambio, ninguna unidad muestra precio (Ley 29571 art. 6). */
  var P = {
    puesto: texto(PRE.puesto),
    pMin: numero(PRE.puestoAreaMin, NaN, 0, 100000),
    pMax: numero(PRE.puestoAreaMax, NaN, 0, 100000),
    tienda: texto(PRE.tienda),
    tMin: numero(PRE.tiendaAreaMin, NaN, 0, 100000),
    tMax: numero(PRE.tiendaAreaMax, NaN, 0, 100000),
    sinPrecio: texto(PRE.sinPrecio) || 'Precio según su área: te lo cotizamos',
    igv: texto(PRE.igv),
    condicionPuesto: texto(PRE.condicionPuesto),
    notarial: texto(PRE.notarial),
    tipoCambio: texto(PRE.tipoCambio),
    tc: numero(PRE.tipoCambioValor, NaN, 1, 20)
  };
  var PRECIOS_OK = !!(P.igv && P.notarial && P.tipoCambio);
  /* la regla de precio único de config.js (desde el 06/10/2026 apagada: precios por ubicación en el CRM) */
  var REGLA_GENERAL = INV.reglaGeneral === true;
  /* El número con que se pasan a soles los precios en dólares del CRM tiene
     que ser el mismo que dice el texto del tipo de cambio: si alguien cambia
     uno y no el otro, no se publica ningún precio del CRM en dólares. */
  var TC_TEXTO = (/S\/\s?(\d+(?:\.\d+)?)/.exec(P.tipoCambio) || [])[1];
  var TC_OK = isFinite(P.tc) && TC_TEXTO != null && Math.abs(Number(TC_TEXTO) - P.tc) < 0.00001;
  if (isFinite(P.tc) && !TC_OK && window.console) {
    console.warn('[plano] precios.tipoCambioValor (' + P.tc + ') no coincide con el texto del tipo de cambio: no se publican precios del CRM en dólares.');
  }
  var VARIA = 'Varía según la unidad: mira su ficha';
  var POR_CONFIRMAR = 'por confirmar contra el plano';

  /* el espacio de dibujo del plano (viewBox del <svg>) */
  var VB = { x: 80, y: 70, w: 930, h: 1880 };
  var ESCALA_MIN = 1, ESCALA_MAX = 6;
  var RE_CODIGO = /^[A-Z]{1,3}-\d{1,4}[A-Z]?$/;
  var ESTADOS = { disponible: 1, separada: 1, no_disponible: 1 };

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    nPuestos: $('inv-n-puestos'), nTiendas: $('inv-n-tiendas'),
    nPuestosRotulo: $('inv-n-puestos-rotulo'), nTiendasRotulo: $('inv-n-tiendas-rotulo'),
    resNotas: $('inv-resultados-notas'),
    precioPuesto: $('inv-precio-puesto-texto'), precioPuestoNota: $('inv-precio-puesto-nota'),
    precioTienda: $('inv-precio-tienda-texto'), notas: $('inv-notas-precio'), corte: $('inv-corte'),
    sync: $('inv-sync'), syncTexto: $('inv-sync-texto'), syncHora: $('inv-sync-hora'),
    respaldo: $('inv-respaldo'), explorador: $('inv-explorador'),
    buscar: $('inv-buscar'), rubro: $('inv-rubro'), tipo: $('inv-tipo'),
    solo: $('inv-solo-disponibles'), limpiar: $('inv-limpiar'),
    vistaDisp: $('inv-vista-disponibilidad'), vistaZonas: $('inv-vista-zonificacion'),
    alejar: $('inv-alejar'), acercar: $('inv-acercar'), ajustar: $('inv-ajustar'), escala: $('inv-escala'),
    leyenda: $('inv-leyenda'), viewport: $('inv-mapa-viewport'), lienzo: $('inv-mapa-lienzo'),
    svg: $('inv-mapa'), unidades: $('inv-unidades'), cargando: $('inv-cargando'), mapa: $('rubros'),
    ayudaMapa: $('inv-mapa-ayuda'), sinUbicacion: $('inv-sin-ubicacion'),
    listaTitulo: $('inv-lista-titulo'), n: $('inv-resultados-n'), ayuda: $('inv-resultados-ayuda'), lista: $('inv-lista'),
    tablaPuestos: $('inv-tabla-puestos'), tablaTiendas: $('inv-tabla-tiendas'), tablaTotal: $('inv-tabla-total'),
    ficha: $('inv-ficha'), fichaTipo: $('inv-ficha-tipo'), fichaContenido: $('inv-ficha-contenido'),
    fichaCerrar: $('inv-ficha-cerrar'), separar: $('inv-separar'), verEnPlano: $('inv-ver-en-plano'),
    solicitud: $('inv-solicitud'), solTitulo: $('inv-solicitud-titulo'), solAviso: $('inv-solicitud-aviso'),
    solMensaje: $('inv-solicitud-mensaje'), solCerrar: $('inv-solicitud-cerrar'),
    copiar: $('inv-copiar'), whatsapp: $('inv-whatsapp'), formulario: $('inv-formulario'),
    tooltip: $('inv-tooltip'), toast: $('inv-toast')
  };
  for (var k in el) if (!el[k]) return;   // si falta una pieza del HTML, no se arranca a medias
  /* rótulos del resumen de precios (06/10/2026): si una copia vieja del HTML
     no los trae, el plano arranca igual y esos rótulos quedan como estaban */
  var rot = {
    puesto: $('inv-precio-puesto-rotulo'), tienda: $('inv-precio-tienda-rotulo'), tiendaNota: $('inv-precio-tienda-nota')
  };

  var reducir = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function suave() { return reducir ? 'auto' : 'smooth'; }

  /* ---------------------------------------------------------------------
     Utilidades
     --------------------------------------------------------------------- */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* los acentos se quitan para buscar: "menú" y "menu" valen lo mismo */
  var DIACRITICOS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
  var NBSP = String.fromCharCode(160);
  function sinTildes(s) { s = String(s || ''); return s.normalize ? s.normalize('NFD').replace(DIACRITICOS, '') : s; }
  function normal(s) { return sinTildes(s).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function area(a) { return a.toFixed(2) + ' m²'; }
  /* en pantalla, "S/" y "US$" no se separan de su número al partir la línea */
  function nb(s) { return String(s).replace(/(US\$|S\/) /g, '$1' + NBSP); }
  /* "Frutas/Verduras" se lee mejor y parte la línea como "Frutas / Verduras" */
  function rubroLegible(z) { return String(z).replace(/\s*\/\s*/g, ' / '); }
  function hora(ms) {
    try { return new Date(ms).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { var d = new Date(ms); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  }
  function cada(lista, fn) { Array.prototype.forEach.call(lista, fn); }

  /* djb2: solo para cuando el CRM no manda revisión */
  function huella(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return 'h' + (h >>> 0).toString(16);
  }

  /* ---------------------------------------------------------------------
     Validación: nada del servidor entra al HTML sin pasar por aquí
     --------------------------------------------------------------------- */
  function geometria(g) {
    if (!Array.isArray(g) || g.length < 3 || g.length > 64) return null;
    var puntos = [];
    for (var i = 0; i < g.length; i++) {
      var p = g[i];
      if (!Array.isArray(p) || p.length !== 2) return null;
      var x = p[0], y = p[1];
      if (typeof x !== 'number' || typeof y !== 'number' || !isFinite(x) || !isFinite(y) ||
          x < 0 || x > 2200 || y < 0 || y > 2200) return null;
      puntos.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
    }
    return puntos;
  }

  function zonaCategoria(zona, tipo) {
    var s = sinTildes(zona).toLowerCase();
    if (tipo === 'tienda' || /^tiendas?$/.test(s)) return 'tiendas';
    if (/pollo|carne|pescado/.test(s)) return 'carnes';
    if (/fruta|verdura/.test(s)) return 'frutas';
    if (/menu|jugo/.test(s)) return 'menu';
    if (/abarrote|bazar|ropa|librer|accesori|pinater/.test(s)) return 'abarrotes';
    return 'otros';
  }

  /* precio del CRM (19-precio-por-unidad.sql): { monto, moneda } o null. El
     monto llega como número (numeric de Postgres); se acepta también
     "25000.00" como texto, nada más. Moneda: exactamente USD o PEN. */
  function precioCrm(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    var m = v.monto;
    if (typeof m === 'string' && /^\d{1,9}(\.\d{1,4})?$/.test(m.trim())) m = Number(m);
    if (typeof m !== 'number' || !isFinite(m) || m <= 0 || m >= 100000000) return null;
    if (v.moneda !== 'USD' && v.moneda !== 'PEN') return null;
    return { monto: Math.round(m * 100) / 100, moneda: v.moneda };
  }

  function unidad(o) {
    if (!o || typeof o !== 'object') return null;
    var codigo = texto(o.codigo);
    if (!RE_CODIGO.test(codigo)) return null;
    var tipo = texto(o.tipo).toLowerCase().replace(/\s+/g, ' ').slice(0, 40) || 'otro';
    var a = o.area_m2;
    /* numeric de Postgres llega como número; se acepta también "9.45" por si
       alguna vez viaja como texto, pero nada más que dígitos y un punto */
    if (typeof a === 'string' && /^\d{1,6}(\.\d{1,4})?$/.test(a.trim())) a = Number(a);
    a = typeof a === 'number' && isFinite(a) && a > 0 && a < 100000 ? a : null;
    var zona = texto(o.zona_rubro).replace(/\s+/g, ' ').slice(0, 120) || null;
    var estado = typeof o.estado === 'string' && ESTADOS[o.estado] === 1 ? o.estado : 'no_disponible';
    var geom = geometria(o.geometria);
    var centro = null, esquina = null;
    if (geom) {
      var sx = 0, sy = 0, mx = Infinity, my = Infinity;
      for (var i = 0; i < geom.length; i++) {
        sx += geom[i][0]; sy += geom[i][1];
        mx = Math.min(mx, geom[i][0]); my = Math.min(my, geom[i][1]);
      }
      centro = [Math.round(sx / geom.length * 10) / 10, Math.round(sy / geom.length * 10) / 10];
      esquina = [mx + 5, my + 5];
    }
    var m = /^([A-Z]+)-(\d+)([A-Z]?)$/.exec(codigo);
    /* sin la clave "verificada", todo lo que el CRM da por disponible ya pasó
       por v_unidades_ofrecibles, que exige el dato en verde contra el plano */
    var verificada = o.verificada === false ? false : true;
    return {
      codigo: codigo, tipo: tipo, area: a, zona: zona, estado: estado, geom: geom,
      porConfirmar: estado === 'disponible' && !verificada,
      precio: estado === 'disponible' ? precioCrm(o.precio) : null,
      centro: centro, esquina: esquina, zonaCat: zonaCategoria(zona, tipo),
      orden: [m[1], Number(m[2]), m[3]], busqueda: normal(codigo)
    };
  }

  function compararCodigo(a, b) {
    var x = a.orden, y = b.orden;
    if (x[0] !== y[0]) return x[0] < y[0] ? -1 : 1;
    if (x[1] !== y[1]) return x[1] - y[1];
    return x[2] === y[2] ? 0 : (x[2] < y[2] ? -1 : 1);
  }

  function leerPaquete(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d) || !Array.isArray(d.unidades)) {
      throw new Error('respuesta sin la lista de unidades');
    }
    if (d.unidades.length > 5000) throw new Error('respuesta demasiado grande');
    var vistas = {}, lista = [];
    for (var i = 0; i < d.unidades.length; i++) {
      var u = unidad(d.unidades[i]);
      if (!u || vistas[u.codigo]) continue;
      vistas[u.codigo] = 1;
      lista.push(u);
    }
    lista.sort(compararCodigo);
    var disp = d.disponibilidad && typeof d.disponibilidad === 'object' ? d.disponibilidad : {};
    var semaforo = /^[a-z_]{1,20}$/.test(texto(disp.semaforo)) ? texto(disp.semaforo) : null;
    var corte = semaforo === 'verde' ? (texto(disp.corte).slice(0, 200) || null) : null;
    var revision = /^[A-Za-z0-9_-]{1,128}$/.test(texto(d.revision)) ? texto(d.revision)
      : huella(JSON.stringify(lista.map(function (u) {
          return [u.codigo, u.tipo, u.area, u.zona, u.estado, u.geom, u.porConfirmar, u.precio ? [u.precio.monto, u.precio.moneda] : null];
        })));
    var generado = texto(d.generado_el);
    return {
      version: typeof d.version === 'number' ? d.version : null,
      generadoEl: generado && !isNaN(Date.parse(generado)) ? generado : null,
      revision: revision, semaforo: semaforo, corte: corte, unidades: lista,
      /* el CRM ya es la fuente de los precios (ver la cabecera) */
      preciosCrm: d.precios_publicados === true || lista.some(function (u) { return !!u.precio; })
    };
  }

  /* ---------------------------------------------------------------------
     Estado
     --------------------------------------------------------------------- */
  var st = {
    fase: 'cargando',            // cargando → vivo | respaldo (primera lectura fallida) → vivo
    rt: 'desconectado',          // desconectado | conectando | unido
    clave: null, revision: null, version: null, generadoEl: null, semaforo: null, corte: null, preciosCrm: false,
    ultimoOk: 0, ultimoIntentoOk: false, ultimoIntentoFin: 0, ultimoError: null, fallosSeguidos: 0,
    lecturas: 0, lecturasOk: 0, aplicadas: 0, avisos: 0,
    sinRed: navigator.onLine === false
  };
  var unidades = [], porCodigo = {};
  var vista = 'disponibilidad', escala = 1, sinUbic = false;
  var seleccion = null, origen = null, verificando = false, trasCerrarFicha = null;
  var turnoSep = 0;   // cada apertura o cierre de la ficha invalida una comprobación en curso
  var confirmadoAntes = null;

  function intervalo() {
    return st.fase === 'vivo' && st.rt === 'unido' ? OPC.conRealtime : OPC.sinRealtime;
  }
  function confirmado() {
    return st.fase === 'vivo' && st.ultimoIntentoOk && !st.sinRed && st.ultimoOk > 0 &&
      (Date.now() - st.ultimoOk) <= 2 * intervalo();
  }
  function actual() { return seleccion ? porCodigo[seleccion] || null : null; }
  function dialogoAbierto(d) { return !!(d.open || d.hasAttribute('open')); }

  /* ---------------------------------------------------------------------
     Textos de una unidad
     --------------------------------------------------------------------- */
  function rotuloTipo(u) {
    if (u.tipo === 'puesto') return 'Puesto';
    if (u.tipo === 'tienda') return 'Tienda';
    return u.tipo.charAt(0).toUpperCase() + u.tipo.slice(1);
  }
  function femenino(u) { return u.tipo === 'tienda'; }
  function rotuloEstado(u) {
    if (u.estado === 'disponible') return 'Disponible';
    if (u.estado === 'separada') return femenino(u) ? 'Separada' : 'Separado';
    return 'No disponible';
  }
  function rubroTexto(u) {
    if (u.tipo === 'tienda' && (!u.zona || /^tiendas?$/i.test(u.zona))) return 'Libre (tienda)';
    return u.zona ? rubroLegible(u.zona) : 'Por confirmar';
  }
  function etiquetaAria(u) {
    return u.codigo + ', ' + rotuloTipo(u).toLowerCase() + ', ' + rotuloEstado(u).toLowerCase() +
      (u.porConfirmar ? ', ' + POR_CONFIRMAR : '') +
      ', rubro ' + rubroTexto(u) + (u.area != null ? ', ' + area(u.area) : '') + (u.geom ? '' : ', ubicación por confirmar');
  }
  /* 25000 → "25,000"; 25000.5 → "25,000.50": sin decimales salvo que haya céntimos */
  function miles(n) {
    var s = n.toFixed(Math.round(n * 100) % 100 === 0 ? 0 : 2).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return s.join('.');
  }
  /* el precio del CRM con sus soles: "US$ 25,000 · S/ 84,250" o "S/ 84,250" */
  function textoPrecioCrm(pc) {
    if (pc.moneda === 'PEN') return 'S/ ' + miles(pc.monto);
    return 'US$ ' + miles(pc.monto) + ' · S/ ' + miles(Math.round(pc.monto * P.tc * 100) / 100);
  }
  function precio(u) {
    if (!PRECIOS_OK) return null;
    var base = [P.igv, P.notarial, P.tipoCambio];
    /* el CRM ya publica precios: SOLO el de la unidad, y solo si está
       disponible. La regla de config.js no se mezcla. */
    if (st.preciosCrm) {
      if (u.estado !== 'disponible' || !u.precio) return null;
      if (u.precio.moneda === 'USD' && !TC_OK) return null;
      var soloSoles = u.precio.moneda === 'PEN';
      return { texto: textoPrecioCrm(u.precio),
        notas: [P.igv, P.condicionPuesto, P.notarial, soloSoles ? '' : P.tipoCambio].filter(Boolean),
        notasMensaje: soloSoles ? [P.igv, P.notarial] : base };
    }
    /* la regla de config.js se calcula con el área: si el área todavía no está
       confirmada contra el plano, tampoco el precio */
    if (!REGLA_GENERAL || u.porConfirmar) return null;
    if (u.tipo === 'puesto' && P.puesto && u.area != null && u.area >= P.pMin && u.area <= P.pMax) {
      return { texto: P.puesto, notas: [P.igv, P.condicionPuesto, P.notarial, P.tipoCambio].filter(Boolean), notasMensaje: base };
    }
    if (u.tipo === 'tienda' && P.tienda && u.area != null && u.area >= P.tMin && u.area <= P.tMax) {
      return { texto: P.tienda, notas: base, notasMensaje: base };
    }
    return null;
  }
  function articulo(u) { return u.tipo === 'tienda' ? 'la tienda' : u.tipo === 'puesto' ? 'el puesto' : 'el espacio'; }

  /* ---------------------------------------------------------------------
     Lectura del inventario
     --------------------------------------------------------------------- */
  var enCurso = null, relojSondeo = null;

  function pedir() {
    return new Promise(function (ok, ko) {
      if (!OPC.base || !OPC.llave || typeof fetch !== 'function') { ko(new Error('sin configuración del inventario')); return; }
      var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var reloj = setTimeout(function () {
        if (ctrl) { try { ctrl.abort(); } catch (e) { /* nada */ } }
        ko(new Error('el inventario tardó demasiado'));
      }, OPC.tiempoMaximo);
      /* GET sin cabeceras propias: así es una petición "simple" y no hay
         consulta previa de CORS */
      var url = OPC.base + '/rest/v1/rpc/' + OPC.rpc + '?apikey=' + encodeURIComponent(OPC.llave);
      var opciones = { cache: 'no-store', credentials: 'omit' };
      if (ctrl) opciones.signal = ctrl.signal;
      fetch(url, opciones)
        .then(function (r) {
          if (!r.ok) throw new Error('el inventario respondió ' + r.status);
          return r.json();
        })
        .then(function (d) { clearTimeout(reloj); ok(d); }, function (e) { clearTimeout(reloj); ko(e); });
    });
  }

  /* fresca = true: si hay una lectura en curso, espera a que termine y hace
     otra (para comprobar justo antes de abrir WhatsApp) */
  function leer(fresca) {
    if (enCurso) return fresca ? enCurso.then(function () { return leer(false); }) : enCurso;
    st.lecturas++;
    enCurso = pedir()
      .then(function (d) { exito(leerPaquete(d)); return true; })
      .catch(function (e) { fallo(e); return false; })
      .then(function (ok) {
        enCurso = null;
        st.ultimoIntentoFin = Date.now();
        programarSondeo();
        return ok;
      });
    return enCurso;
  }

  function exito(p) {
    st.lecturasOk++;
    st.ultimoOk = Date.now();
    st.ultimoIntentoOk = true;
    st.fallosSeguidos = 0;
    st.ultimoError = null;
    st.generadoEl = p.generadoEl;
    var clave = p.revision + '|' + (p.semaforo || '') + '|' + (p.corte || '') + '|' + (p.preciosCrm ? 1 : 0);
    var primera = st.fase !== 'vivo';
    if (clave !== st.clave || primera) {
      if (clave !== st.clave) st.aplicadas++;
      st.clave = clave; st.revision = p.revision; st.version = p.version;
      st.semaforo = p.semaforo; st.corte = p.corte; st.preciosCrm = p.preciosCrm;
      unidades = p.unidades;
      porCodigo = {};
      for (var i = 0; i < unidades.length; i++) porCodigo[unidades[i].codigo] = unidades[i];
      if (primera) { st.fase = 'vivo'; mostrarFase(); }
      pintarTodo();
    }
    revisarConfirmacion(true);
  }

  function fallo(e) {
    st.ultimoIntentoOk = false;
    st.fallosSeguidos++;
    st.ultimoError = String(e && e.message || e).slice(0, 200);
    if (st.fase === 'cargando') { st.fase = 'respaldo'; mostrarFase(); pintarResumen(); pintarPrecios(); }
    revisarConfirmacion(true);
  }

  function programarSondeo() {
    clearTimeout(relojSondeo);
    var ms = intervalo();
    /* tras un fallo se reintenta antes: 2, 4, 8, 16 s… hasta el intervalo */
    if (!st.ultimoIntentoOk && st.fallosSeguidos > 0) ms = Math.min(ms, 1000 * Math.pow(2, Math.min(st.fallosSeguidos, 5)));
    var falta = Math.max(0, (st.ultimoIntentoFin || Date.now()) + ms - Date.now());
    relojSondeo = setTimeout(function () { leer(); }, falta);
  }

  var ultimoEmpujon = 0;
  function empujon() {
    /* volver a la pestaña, recuperar la red o enfocar: lee ya, pero no más de
       una vez cada 2 s si la anterior salió bien */
    if (st.ultimoIntentoOk && Date.now() - ultimoEmpujon < 2000) return;
    ultimoEmpujon = Date.now();
    leer();
  }

  /* ---------------------------------------------------------------------
     Realtime (protocolo Phoenix, vsn 1.0.0) sobre WebSocket, sin librerías
     --------------------------------------------------------------------- */
  var ws = null, ref = 0, refUnion = null, latido = null, latidoPendiente = null;
  var reintento = null, intentosRt = 0, relojUnion = null, relojRebote = null, detenido = false;

  function tema() { return 'realtime:' + OPC.canal; }
  function urlRealtime() {
    return OPC.base.replace(/^http/i, 'ws') + '/realtime/v1/websocket?apikey=' +
      encodeURIComponent(OPC.llave) + '&vsn=1.0.0';
  }
  function enviar(s, m) { try { s.send(JSON.stringify(m)); return true; } catch (e) { return false; } }

  function ponerRt(n) {
    if (st.rt === n) return;
    var antes = st.rt;
    st.rt = n;
    if (antes === 'unido' || n === 'unido') programarSondeo();   // cambia el intervalo
    revisarConfirmacion(true);
  }

  function conectar() {
    if (detenido || !OPC.realtime || typeof WebSocket !== 'function' || !OPC.base || !OPC.llave) return;
    if (ws) return;
    clearTimeout(reintento); reintento = null;
    var s;
    try { s = new WebSocket(urlRealtime()); } catch (e) { programarReconexion(); return; }
    ws = s;
    ponerRt('conectando');
    s.onopen = function () {
      if (ws !== s) return;
      refUnion = String(++ref);
      enviar(s, {
        topic: tema(), event: 'phx_join', ref: refUnion, join_ref: refUnion,
        payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, postgres_changes: [], private: false } }
      });
      clearTimeout(relojUnion);
      relojUnion = setTimeout(function () { if (ws === s && st.rt !== 'unido') cortar(s); }, 10000);
      iniciarLatido(s);
    };
    s.onmessage = function (ev) { if (ws === s) recibir(s, ev.data); };
    s.onerror = function () { /* le sigue onclose */ };
    s.onclose = function () { if (ws === s) cortar(s); };
  }

  function recibir(s, datos) {
    var m;
    try { m = JSON.parse(datos); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.topic === 'phoenix') {
      if (m.event === 'phx_reply' && m.ref === latidoPendiente) latidoPendiente = null;
      return;
    }
    if (m.topic !== tema()) return;
    if (m.event === 'phx_reply' && m.ref === refUnion) {
      clearTimeout(relojUnion);
      if (m.payload && m.payload.status === 'ok') {
        intentosRt = 0;
        ponerRt('unido');
        leer();   // lo que haya cambiado mientras no estábamos unidos
      } else {
        cortar(s);
      }
      return;
    }
    if (m.event === 'broadcast') {
      var p = m.payload && typeof m.payload === 'object' ? m.payload : {};
      if (p.event === OPC.evento) aviso();
      return;
    }
    if (m.event === 'phx_error' || m.event === 'phx_close') cortar(s);
  }

  function aviso() {
    st.avisos++;
    clearTimeout(relojRebote);
    relojRebote = setTimeout(function () { leer(true); }, OPC.rebote);
  }

  function iniciarLatido(s) {
    clearInterval(latido);
    latidoPendiente = null;
    latido = setInterval(function () {
      if (ws !== s || s.readyState !== 1) return;
      /* el latido anterior no tuvo respuesta: la conexión está muerta aunque
         el navegador no lo sepa todavía */
      if (latidoPendiente) { cortar(s); return; }
      latidoPendiente = String(++ref);
      enviar(s, { topic: 'phoenix', event: 'heartbeat', payload: {}, ref: latidoPendiente });
    }, OPC.latido);
  }

  function cortar(s) {
    if (ws === s) {
      ws = null;
      clearInterval(latido); latido = null; latidoPendiente = null;
      clearTimeout(relojUnion);
      ponerRt('desconectado');
      programarReconexion();
    }
    try { s.onclose = null; s.onmessage = null; s.close(); } catch (e) { /* ya estaba cerrado */ }
  }

  function programarReconexion() {
    if (reintento || detenido || !OPC.realtime) return;
    /* 1, 2, 4… hasta 30 s, más un poco de azar para que no vuelvan todos juntos */
    var base = Math.min(30000, 1000 * Math.pow(2, Math.min(intentosRt, 5)));
    var ms = base + Math.random() * Math.min(1000, base * 0.5);
    intentosRt++;
    reintento = setTimeout(function () { reintento = null; conectar(); }, ms);
  }

  function reconectarYa() {
    if (ws || detenido) return;
    clearTimeout(reintento); reintento = null;
    intentosRt = 0;
    conectar();
  }

  /* ---------------------------------------------------------------------
     Pintar
     --------------------------------------------------------------------- */
  function contar() {
    var c = { puestos: 0, tiendas: 0, otros: 0, total: 0, separadas: 0, noDisponibles: 0, sinUbicacion: 0 };
    for (var i = 0; i < unidades.length; i++) {
      var u = unidades[i];
      if (!u.geom) c.sinUbicacion++;
      if (u.estado === 'disponible') {
        c.total++;
        if (u.tipo === 'puesto') c.puestos++; else if (u.tipo === 'tienda') c.tiendas++; else c.otros++;
      } else if (u.estado === 'separada') c.separadas++;
      else c.noDisponibles++;
    }
    return c;
  }

  function mostrarFase() {
    raiz.setAttribute('data-fase', st.fase);
    el.respaldo.hidden = st.fase !== 'respaldo';
    el.explorador.hidden = st.fase === 'respaldo';
    el.cargando.hidden = st.fase !== 'cargando';
  }

  /* con precios del CRM: el precio común de las disponibles de ese tipo, o
     "varía" si no es el mismo para todas; nunca "desde" */
  function precioComun(tipo) {
    var vistos = {}, n = 0, uno = null, faltan = false;
    for (var i = 0; i < unidades.length; i++) {
      var u = unidades[i];
      if (u.tipo !== tipo || u.estado !== 'disponible') continue;
      var pr = precio(u);
      if (!pr) { faltan = true; continue; }
      if (!vistos[pr.texto]) { vistos[pr.texto] = 1; n++; uno = pr.texto; }
    }
    return n === 0 ? P.sinPrecio : n === 1 && !faltan ? nb(uno) : VARIA;
  }
  function pintarPrecios() {
    if (st.fase !== 'vivo') {
      el.precioPuesto.textContent = st.fase === 'cargando' ? '…' : P.sinPrecio;
      el.precioTienda.textContent = st.fase === 'cargando' ? '…' : P.sinPrecio;
      if (rot.puesto) rot.puesto.textContent = 'Puestos';
      if (rot.tienda) rot.tienda.textContent = 'Tiendas';
      if (rot.tiendaNota) rot.tiendaNota.textContent = '';
      el.precioPuestoNota.textContent = '';
      el.notas.textContent = '';
      el.notas.hidden = true;
      return;
    }
    if (st.preciosCrm) {
      if (rot.puesto) rot.puesto.textContent = 'Puestos';
      if (rot.tienda) rot.tienda.textContent = 'Tiendas';
      el.precioPuesto.textContent = precioComun('puesto');
      el.precioPuestoNota.textContent = 'Cada unidad muestra su precio en su ficha. ' + P.condicionPuesto;
      el.precioTienda.textContent = precioComun('tienda');
      if (rot.tiendaNota) rot.tiendaNota.textContent = 'Las que no tienen precio publicado se cotizan según su área.';
    } else if (!REGLA_GENERAL) {
      if (rot.puesto) rot.puesto.textContent = 'Puestos';
      if (rot.tienda) rot.tienda.textContent = 'Tiendas';
      el.precioPuesto.textContent = P.sinPrecio;
      el.precioPuestoNota.textContent = 'El precio de cada unidad depende de su ubicación.';
      el.precioTienda.textContent = P.sinPrecio;
      if (rot.tiendaNota) rot.tiendaNota.textContent = 'El precio de cada unidad depende de su ubicación.';
    } else {
      if (rot.puesto) rot.puesto.textContent = 'Puesto de 9 a 10 m²';
      if (rot.tienda) rot.tienda.textContent = 'Tienda de 22 a 23 m²';
      var hayPuesto = PRECIOS_OK && P.puesto && isFinite(P.pMin) && isFinite(P.pMax);
      el.precioPuesto.textContent = hayPuesto ? nb(P.puesto) : P.sinPrecio;
      el.precioPuestoNota.textContent = hayPuesto ? 'Puesto estándar de 9 a 10 m². ' + P.condicionPuesto : '';
      el.precioTienda.textContent = PRECIOS_OK && P.tienda && isFinite(P.tMin) && isFinite(P.tMax) ? nb(P.tienda) : P.sinPrecio;
      if (rot.tiendaNota) rot.tiendaNota.textContent = 'Las de otro metraje se cotizan según su área.';
    }
    el.notas.textContent = PRECIOS_OK ? [P.igv, P.notarial, P.tipoCambio].join(' ') : '';
    el.notas.hidden = !PRECIOS_OK;
  }

  function pintarResumen() {
    var vivo = st.fase === 'vivo', c = contar();
    var nada = st.fase === 'respaldo' ? 'Sin conexión' : '…';
    el.nPuestos.textContent = vivo ? String(c.puestos) : '…';
    el.nTiendas.textContent = vivo ? String(c.tiendas) : '…';
    if (el.nPuestosRotulo) el.nPuestosRotulo.textContent = vivo && c.puestos === 1 ? 'puesto disponible en el inventario' : 'puestos disponibles en el inventario';
    if (el.nTiendasRotulo) el.nTiendasRotulo.textContent = vivo && c.tiendas === 1 ? 'tienda disponible en el inventario' : 'tiendas disponibles en el inventario';
    el.tablaPuestos.textContent = vivo ? String(c.puestos) : nada;
    el.tablaTiendas.textContent = vivo ? String(c.tiendas) : nada;
    el.tablaTotal.textContent = vivo ? String(c.total) : nada;
    /* El texto libre del corte en el CRM es interno: nunca se publica tal cual.
       Solo se dice, con frase fija, si la lista está confirmada o en revisión. */
    el.corte.hidden = !vivo;
    el.corte.textContent = !vivo ? ''
      : st.semaforo === 'verde'
        ? 'Disponibilidad tomada del inventario de SCP. Cada unidad se confirma por escrito antes de separar.'
        : 'La lista de disponibilidad está en revisión: cada unidad se confirma por escrito antes de separar.';
  }

  function opciones(select, valores, primera) {
    var antes = select.value;
    var firma = JSON.stringify(valores);
    if (select.getAttribute('data-firma') !== firma) {
      select.setAttribute('data-firma', firma);
      while (select.firstChild) select.removeChild(select.firstChild);
      var o = document.createElement('option');
      o.value = ''; o.textContent = primera;
      select.appendChild(o);
      valores.forEach(function (v) {
        var op = document.createElement('option');
        op.value = v[0]; op.textContent = v[1];
        select.appendChild(op);
      });
    }
    var existe = valores.some(function (v) { return v[0] === antes; });
    select.value = existe ? antes : '';
  }

  function pintarOpciones() {
    var zonas = {}, sinZona = false, tipos = {};
    unidades.forEach(function (u) {
      if (u.zona) zonas[u.zona] = 1; else sinZona = true;
      tipos[u.tipo] = 1;
    });
    var z = Object.keys(zonas).sort(function (a, b) { return a.localeCompare(b, 'es'); })
      .map(function (v) { return [v, rubroLegible(v)]; });
    if (sinZona) z.push(['__sin__', 'Rubro por confirmar']);
    opciones(el.rubro, z, 'Todos los rubros');
    var t = [['puesto', 'Solo puestos'], ['tienda', 'Solo tiendas']];
    Object.keys(tipos).sort().forEach(function (v) {
      if (v !== 'puesto' && v !== 'tienda') t.push([v, 'Solo ' + v]);
    });
    opciones(el.tipo, t, 'Puestos y tiendas');
  }

  function filtros() {
    return { q: normal(el.buscar.value), rubro: el.rubro.value, tipo: el.tipo.value, solo: el.solo.checked };
  }
  function coincide(u, f, ignorarUbicacion) {
    if (f.q && u.busqueda.indexOf(f.q) === -1) return false;
    if (f.rubro === '__sin__' ? u.zona !== null : (f.rubro && u.zona !== f.rubro)) return false;
    if (f.tipo && u.tipo !== f.tipo) return false;
    if (f.solo && u.estado !== 'disponible') return false;
    if (!ignorarUbicacion && sinUbic && u.geom) return false;
    return true;
  }

  var LEYENDAS = {
    disponibilidad: [
      ['var(--inv-disp)', 'Disponible'], ['var(--inv-sep)', 'Separado'], ['var(--inv-no)', 'No disponible']
    ],
    zonificacion: [
      ['#7CC8CC', 'Abarrotes / bazar'], ['#8FCB78', 'Frutas / verduras'], ['#E3D27E', 'Menú / jugos'],
      ['#D28FCB', 'Pollo / carne / pescado'], ['#C9B79A', 'Tiendas: rubro libre'], ['#6F8194', 'Otro o por confirmar'],
      ['redonda', 'Punto ámbar: disponible']
    ]
  };
  function hayPorConfirmar() {
    for (var i = 0; i < unidades.length; i++) if (unidades[i].porConfirmar && unidades[i].geom) return true;
    return false;
  }
  function pintarLeyenda() {
    var items = LEYENDAS[vista].slice();
    /* solo si hay alguna: una leyenda que no corresponde a nada confunde */
    if (hayPorConfirmar()) {
      if (vista === 'disponibilidad') items.splice(1, 0, ['trama', 'Disponible, ' + POR_CONFIRMAR]);
      else items.push(['hueca', 'Punto hueco: disponible, ' + POR_CONFIRMAR]);
    }
    el.leyenda.innerHTML = items.map(function (l) {
      var muestra = l[0] === 'redonda'
        ? '<span class="inv-muestra redonda" style="background:var(--accent)" aria-hidden="true"></span>'
        : l[0] === 'trama'
          ? '<span class="inv-muestra trama" aria-hidden="true"></span>'
          : l[0] === 'hueca'
            ? '<span class="inv-muestra redonda hueca" aria-hidden="true"></span>'
          : '<span class="inv-muestra" style="background:' + l[0] + '" aria-hidden="true"></span>';
      return '<li>' + muestra + esc(l[1]) + '</li>';
    }).join('');
    el.ayudaMapa.textContent = vista === 'zonificacion'
      ? 'Cada color es un rubro; el punto ámbar marca los disponibles. Toca un espacio para ver su ficha.'
      : 'En ámbar, los disponibles. Toca un espacio para ver su ficha.';
    el.vistaDisp.setAttribute('aria-pressed', String(vista === 'disponibilidad'));
    el.vistaZonas.setAttribute('aria-pressed', String(vista === 'zonificacion'));
    el.svg.classList.toggle('vista-zonas', vista === 'zonificacion');
  }

  /* el foco de quien navega con teclado sobrevive al repintado */
  function focoActual(contenedor) {
    var a = document.activeElement;
    return a && contenedor.contains(a) && a.getAttribute ? a.getAttribute('data-codigo') : null;
  }
  function devolverFocoA(contenedor, codigo) {
    if (!codigo) return;
    var n = contenedor.querySelector('[data-codigo="' + codigo + '"]');
    if (n && typeof n.focus === 'function') { try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } }
  }

  function pintarMapa() {
    var f = filtros(), html = [], foco = focoActual(el.unidades);
    for (var i = 0; i < unidades.length; i++) {
      var u = unidades[i];
      if (!u.geom) continue;
      /* «Solo disponibles» deja la LISTA en lo que se puede pedir, pero en el PLANO
         una unidad separada sigue viéndose morada (sin atenuar): que se acaba de
         separar es justo lo que el plano en vivo tiene que enseñar. Los demás
         filtros (búsqueda, rubro, tipo) sí la atenúan como a todas. */
      var visible = coincide(u, f, true) ||
        (f.solo && u.estado === 'separada' && coincide(u, { q: f.q, rubro: f.rubro, tipo: f.tipo, solo: false }, true));
      var puntos = u.geom.map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
      html.push('<g class="inv-u' + (visible ? '' : ' atenuada') + (u.codigo === seleccion ? ' seleccionada' : '') + '"' +
        ' data-codigo="' + esc(u.codigo) + '" data-estado="' + u.estado + '" data-tipo="' + esc(u.tipo) + '" data-zona="' + u.zonaCat + '"' +
        (u.porConfirmar ? ' data-confirmar="1"' : '') +
        ' role="button" tabindex="' + (visible ? '0' : '-1') + '"' + (visible ? '' : ' aria-hidden="true"') +
        ' aria-label="' + esc(etiquetaAria(u)) + '">' +
        '<polygon points="' + puntos + '"/>' +
        (u.porConfirmar && vista === 'disponibilidad' ? '<polygon class="inv-trama" points="' + puntos + '"/>' : '') +
        '<text x="' + u.centro[0] + '" y="' + u.centro[1] + '">' + esc(u.tipo === 'puesto' ? u.codigo.replace(/^P-/, '') : u.codigo) + '</text>' +
        (vista === 'zonificacion' && u.estado === 'disponible'
          ? '<circle class="inv-marca' + (u.porConfirmar ? ' hueca' : '') + '" cx="' + u.esquina[0] + '" cy="' + u.esquina[1] + '" r="3.4"/>' : '') +
        '</g>');
    }
    el.unidades.innerHTML = html.join('');
    devolverFocoA(el.unidades, foco);
  }

  function pintarLista() {
    var f = filtros(), foco = focoActual(el.lista);
    var rango = { disponible: 0, separada: 1, no_disponible: 2 };
    var lista = unidades.filter(function (u) { return coincide(u, f, false); }).sort(function (a, b) {
      return rango[a.estado] - rango[b.estado] || compararCodigo(a, b);
    });
    var sinGeom = unidades.filter(function (u) { return !u.geom && coincide(u, f, true); }).length;

    el.n.textContent = st.fase === 'vivo' ? String(lista.length) : '…';
    el.listaTitulo.textContent = sinUbic ? 'Ubicación por confirmar' : f.solo ? 'Espacios disponibles' : 'Espacios del mercado';
    el.ayuda.textContent = sinUbic
      ? 'Estos códigos no tienen una ubicación inequívoca en el dibujo: el equipo comercial te la confirma.'
      : 'Elige un espacio del plano o de esta lista.';
    el.sinUbicacion.textContent = sinUbic ? 'Volver a todos' : 'Sin ubicación (' + sinGeom + ')';
    el.sinUbicacion.setAttribute('aria-pressed', String(sinUbic));
    el.sinUbicacion.hidden = !sinUbic && sinGeom === 0;

    /* toda tarjeta con precio lleva cerca sus condiciones (IGV, notarial, tipo de cambio) */
    var conPrecio = st.fase === 'vivo' && PRECIOS_OK && lista.some(function (u) { return !!precio(u); });
    if (el.resNotas) {
      el.resNotas.hidden = !conPrecio;
      el.resNotas.textContent = conPrecio ? 'Precios: ' + [P.igv, P.notarial, P.tipoCambio].join(' ') : '';
    }

    if (st.fase !== 'vivo') {
      el.lista.innerHTML = '<p class="inv-vacio">Cargando el inventario…</p>';
      return;
    }
    if (!lista.length) {
      var msj = !unidades.length
        ? 'El inventario todavía no tiene unidades publicadas.'
        : f.solo
          ? 'No hay espacios disponibles con estos filtros. Prueba otro rubro, limpia la búsqueda o desactiva «Solo disponibles» para ver todo el mercado.'
          : 'No encontramos espacios con estos filtros. Prueba otro rubro o limpia la búsqueda.';
      el.lista.innerHTML = '<p class="inv-vacio">' + esc(msj) + '</p>';
      return;
    }
    el.lista.innerHTML = lista.map(function (u) {
      var pr = precio(u);
      var info = rubroTexto(u) + (u.area != null ? ' · ' + area(u.area) : '');
      return '<button type="button" class="inv-tarjeta" data-codigo="' + esc(u.codigo) + '" data-estado="' + u.estado + '">' +
        '<span class="inv-t-arriba"><b>' + esc(u.codigo) + '</b><span class="inv-pill" data-estado="' + u.estado + '">' + esc(rotuloEstado(u)) + '</span></span>' +
        '<span class="inv-t-info">' + esc(rotuloTipo(u)) + ' · ' + esc(info) + (u.geom ? '' : '<br>Ubicación por confirmar') +
          (u.porConfirmar ? '<br>Disponible, ' + esc(POR_CONFIRMAR) : '') + '</span>' +
        '<span class="inv-t-precio' + (pr ? '' : ' sin') + '">' + esc(pr ? nb(pr.texto) : P.sinPrecio) + '</span>' +
        '</button>';
    }).join('');
    devolverFocoA(el.lista, foco);
  }

  function pintarSync() {
    var conf = confirmado(), est, txt, extra = '';
    if (st.fase === 'cargando') { est = 'cargando'; txt = 'Conectando con el inventario…'; }
    else if (!conf) { est = 'sin-confirmar'; txt = 'Sin conexión · disponibilidad sin confirmar'; }
    else if (st.rt === 'unido') { est = 'en-vivo'; txt = 'Disponibilidad en vivo'; extra = ' · consultada a las ' + hora(st.ultimoOk); }
    else { est = 'actualizada'; txt = 'Disponibilidad actualizada'; extra = ' a las ' + hora(st.ultimoOk); }
    if (el.sync.getAttribute('data-sync') !== est) el.sync.setAttribute('data-sync', est);
    if (el.syncTexto.textContent !== txt) el.syncTexto.textContent = txt;
    if (el.syncHora.textContent !== extra) el.syncHora.textContent = extra;
  }

  function campo(rotulo, valor, ancho) {
    return '<div class="inv-d-campo' + (ancho ? ' ancho' : '') + '"><span>' + esc(rotulo) + '</span><strong>' + esc(valor) + '</strong></div>';
  }

  /* la unidad abierta dejó de salir en el inventario (la archivaron en el
     CRM): la ficha la deja de ofrecer en vez de quedarse con su último estado */
  function fichaSinUnidad() {
    var pill = el.fichaContenido.querySelector('.inv-pill');
    if (pill) { pill.setAttribute('data-estado', 'no_disponible'); pill.textContent = 'No disponible'; }
    el.separar.disabled = true;
    el.separar.setAttribute('aria-busy', 'false');
    el.separar.textContent = 'Ya no figura en el inventario';
    el.verEnPlano.hidden = true;
  }

  function pintarFicha() {
    var u = actual();
    if (!u) { fichaSinUnidad(); return; }
    var conf = confirmado(), pr = precio(u);
    el.fichaTipo.textContent = rotuloTipo(u) + ' · Mercado Media Luna';
    var rotuloPrecio = u.tipo === 'puesto' ? 'Precio del puesto' : u.tipo === 'tienda' ? 'Precio de la tienda' : 'Precio';
    el.fichaContenido.innerHTML =
      '<div class="inv-d-titulo"><h2 id="inv-ficha-titulo">' + esc(u.codigo) + '</h2>' +
      '<span class="inv-pill" data-estado="' + u.estado + '">' + esc(rotuloEstado(u)) + '</span></div>' +
      '<div class="inv-d-grilla">' +
        campo('Tipo', rotuloTipo(u)) +
        campo('Área', u.area != null ? area(u.area) : 'Por confirmar') +
        campo('Zonificación / rubro', rubroTexto(u), true) +
      '</div>' +
      (u.geom ? '' : '<p class="inv-d-aviso">La ubicación exacta de este código se confirma con el equipo comercial.</p>') +
      (u.porConfirmar ? '<p class="inv-d-aviso">Figura disponible en nuestro inventario. Su área y su ubicación se confirman contra el plano antes de separar.</p>' : '') +
      '<div class="inv-d-precio"><small>' + esc(rotuloPrecio) + '</small>' +
        (pr ? '<b>' + esc(nb(pr.texto)) + '</b><p>' + esc(pr.notas.join(' ')) + '</p>'
            : '<b>' + esc(P.sinPrecio) + '</b><p>' + esc(st.preciosCrm || !REGLA_GENERAL
                ? 'Te lo confirmamos por escrito.'
                : u.porConfirmar
                  ? 'El precio se confirma junto con el área, por escrito, antes de separar.'
                : u.tipo === 'tienda'
                  ? 'El precio publicado es el de las tiendas de 22 a 23 m²; esta se cotiza según su área.'
                  : u.tipo === 'puesto'
                    ? 'El precio publicado es el del puesto estándar de 9 a 10 m²; este se cotiza según su área.'
                    : 'Te lo confirmamos por escrito.') + '</p>') +
      '</div>' +
      (conf ? '' : '<p class="inv-d-aviso">Sin conexión con el inventario: la disponibilidad no está confirmada. Cuando vuelva la conexión podrás pedir la separación.</p>');

    var puede = conf && u.estado === 'disponible';
    el.separar.disabled = !puede && !verificando;
    el.separar.setAttribute('aria-busy', String(verificando));
    el.separar.textContent = verificando ? 'Consultando la disponibilidad…'
      : !conf ? 'Sin conexión: disponibilidad sin confirmar'
      : u.estado === 'disponible' ? 'Quiero separar ' + (femenino(u) ? 'esta tienda' : u.tipo === 'puesto' ? 'este puesto' : 'este espacio')
      : (femenino(u) ? 'Esta tienda no está disponible' : 'Este ' + (u.tipo === 'puesto' ? 'puesto' : 'espacio') + ' no está disponible');
    el.verEnPlano.hidden = !u.geom;
  }

  function mensaje(u) {
    var pr = precio(u);
    return 'Hola, vi el plano de la web y me interesa ' + articulo(u) + ' ' + u.codigo + ' del Mercado Media Luna.\n' +
      'Tipo: ' + rotuloTipo(u) + '.\n' +
      'Rubro: ' + rubroTexto(u) + '.\n' +
      'Área: ' + (u.area != null ? area(u.area) : 'por confirmar') + '.\n' +
      (u.porConfirmar ? 'Figura disponible en la web (' + POR_CONFIRMAR + ').\n' : '') +
      (pr ? 'Precio publicado: ' + pr.texto + '. ' + pr.notasMensaje.join(' ') + '\n' : 'Precio: ' + P.sinPrecio + '.\n') +
      '¿Me confirman por escrito si sigue disponible y los pasos para separar' + (femenino(u) ? 'la' : 'lo') + '?';
  }

  function numeroWa() { return String(CFG.whatsapp || '').replace(/\D/g, ''); }

  function pintarSolicitud() {
    /* si la unidad ya no sale en el inventario (archivada en el CRM), la
       solicitud abierta se desactiva igual que si hubiera dejado de estar disponible */
    var u = actual();
    var ok = !!u && confirmado() && u.estado === 'disponible';
    if (u) {
      el.solTitulo.textContent = 'Pedir la separación de ' + u.codigo;
      var t = mensaje(u);
      if (el.solMensaje.value !== t) el.solMensaje.value = t;
    }
    el.solAviso.textContent = ok
      ? 'Este es el mensaje que le llegará al equipo comercial. Te confirmarán por escrito la disponibilidad y los pasos para separar.'
      : 'La disponibilidad cambió o se cortó la conexión con el inventario. No se puede continuar con esta solicitud: vuelve al plano y elige otro espacio.';
    el.copiar.disabled = !ok;
    var wa = numeroWa();
    if (wa) {
      el.whatsapp.hidden = false;
      el.formulario.hidden = true;
      if (ok) {
        el.whatsapp.href = 'https://wa.me/' + wa + '?text=' + encodeURIComponent(t);
        el.whatsapp.removeAttribute('aria-disabled');
      } else {
        el.whatsapp.removeAttribute('href');
        el.whatsapp.setAttribute('aria-disabled', 'true');
      }
    } else {
      el.whatsapp.hidden = true;
      el.formulario.hidden = !ok;
    }
  }

  function pintarTodo() {
    pintarResumen();
    pintarPrecios();
    pintarLeyenda();
    pintarOpciones();
    pintarMapa();
    pintarLista();
    pintarSync();
    if (dialogoAbierto(el.ficha)) pintarFicha();
    if (dialogoAbierto(el.solicitud)) pintarSolicitud();
  }
  function pintarFiltrado() { pintarMapa(); pintarLista(); }

  function revisarConfirmacion(forzar) {
    var c = confirmado();
    if (!forzar && c === confirmadoAntes) return;
    var cambio = c !== confirmadoAntes;
    confirmadoAntes = c;
    pintarSync();
    if (cambio || forzar) {
      if (dialogoAbierto(el.ficha)) pintarFicha();
      if (dialogoAbierto(el.solicitud)) pintarSolicitud();
    }
  }

  /* ---------------------------------------------------------------------
     Avisos al visitante
     --------------------------------------------------------------------- */
  var relojToast = null;
  /* Con una ficha abierta (modal), el aviso tiene que vivir DENTRO del diálogo:
     fuera, el fondo del modal lo tapa y el lector de pantalla no lo alcanza. */
  function toast(t) {
    var abierto = dialogoAbierto(el.solicitud) ? el.solicitud : dialogoAbierto(el.ficha) ? el.ficha : null;
    var casa = abierto || document.body;
    if (el.toast.parentNode !== casa) casa.appendChild(el.toast);
    el.toast.textContent = t;
    el.toast.hidden = false;
    clearTimeout(relojToast);
    relojToast = setTimeout(function () {
      el.toast.hidden = true;
      if (el.toast.parentNode !== document.body) document.body.appendChild(el.toast);
    }, 5000);
  }
  function ocultarTooltip() { el.tooltip.hidden = true; }

  /* ---------------------------------------------------------------------
     Fichas
     --------------------------------------------------------------------- */
  var porAtender = [];   // diálogos abiertos cuyo cierre todavía no se atendió
  function abrirDialogo(d) {
    if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); }
    else d.setAttribute('open', '');
    if (porAtender.indexOf(d) === -1) porAtender.push(d);
  }
  function cerrarDialogo(d) {
    if (typeof d.close === 'function') { if (d.open) d.close(); }
    else d.removeAttribute('open');
    alCerrar(d);
  }
  function alCerrar(d) {
    var i = porAtender.indexOf(d);
    if (i === -1) return;          // ya atendido (el evento "close" llega después)
    porAtender.splice(i, 1);
    if (d === el.ficha) {
      turnoSep++;
      var siguiente = trasCerrarFicha;
      trasCerrarFicha = null;
      verificando = false;
      if (siguiente === 'solicitud' || siguiente === 'plano') return;   // el foco lo pone quien sigue
    }
    devolverFoco();
  }

  function marcarSeleccion() {
    cada(el.unidades.querySelectorAll('.seleccionada'), function (n) { n.classList.remove('seleccionada'); });
    var g = seleccion && el.unidades.querySelector('[data-codigo="' + seleccion + '"]');
    if (g) g.classList.add('seleccionada');
  }

  function abrirFicha(codigo, desde) {
    if (!porCodigo[codigo]) return;
    turnoSep++;
    seleccion = codigo;
    origen = desde;
    verificando = false;
    ocultarTooltip();
    marcarSeleccion();
    pintarFicha();
    abrirDialogo(el.ficha);
  }

  function devolverFoco() {
    if (!seleccion) return;
    var cont = origen === 'lista' ? el.lista : el.unidades;
    var n = cont.querySelector('[data-codigo="' + seleccion + '"]') ||
      el.unidades.querySelector('[data-codigo="' + seleccion + '"]') ||
      el.lista.querySelector('[data-codigo="' + seleccion + '"]');
    try { (n || el.listaTitulo).focus(); } catch (e) { /* nada */ }
  }

  function centrarEn(u) {
    var W = el.lienzo.clientWidth, H = el.lienzo.clientHeight;
    var s = Math.min(W / VB.w, H / VB.h);
    var px = (W - VB.w * s) / 2 + (u.centro[0] - VB.x) * s;
    var py = (H - VB.h * s) / 2 + (u.centro[1] - VB.y) * s;
    el.viewport.scrollLeft = px - el.viewport.clientWidth / 2;
    el.viewport.scrollTop = py - el.viewport.clientHeight / 2;
  }

  function verEnPlano() {
    var u = actual();
    if (!u || !u.geom) return;
    trasCerrarFicha = 'plano';
    cerrarDialogo(el.ficha);
    if (escala < 3) zoom(3);
    centrarEn(u);
    el.mapa.scrollIntoView({ block: 'start', behavior: suave() });
    var g = el.unidades.querySelector('[data-codigo="' + u.codigo + '"]');
    if (g) { try { g.focus({ preventScroll: true }); } catch (e) { g.focus(); } }
  }

  /* El motivo de un rechazo se escribe dentro de la ficha y recibe el foco:
     el botón que lo tenía acaba de deshabilitarse. */
  function avisoEnFicha(t) {
    var p = document.createElement('p');
    p.className = 'inv-d-aviso';
    p.setAttribute('role', 'status');
    p.tabIndex = -1;
    p.textContent = t;
    el.fichaContenido.appendChild(p);
    try { p.focus(); } catch (e) { /* nada */ }
    toast(t);
  }

  /* Antes de abrir WhatsApp: se vuelve a leer el inventario y se comprueba
     que la unidad SIGUE disponible. */
  function separar() {
    var u = actual();
    if (!u || verificando || !confirmado() || u.estado !== 'disponible') return;
    var turno = ++turnoSep, cod = u.codigo;
    verificando = true;
    pintarFicha();
    leer(true).then(function (ok) {
      /* si la ficha se cerró o se abrió otra mientras se comprobaba, esta
         respuesta ya no le corresponde a nadie */
      if (turno !== turnoSep || seleccion !== cod || !dialogoAbierto(el.ficha)) return;
      verificando = false;
      var v = actual();
      if (!ok || !confirmado()) {
        pintarFicha();
        avisoEnFicha('No pudimos confirmar la disponibilidad. Inténtalo de nuevo cuando vuelva la conexión.');
        return;
      }
      if (!v || v.estado !== 'disponible') {
        pintarFicha();
        avisoEnFicha('Este espacio acaba de cambiar de disponibilidad. Elige otro en el plano.');
        return;
      }
      trasCerrarFicha = 'solicitud';
      cerrarDialogo(el.ficha);
      pintarSolicitud();
      abrirDialogo(el.solicitud);
      var destino = !el.whatsapp.hidden ? el.whatsapp : !el.formulario.hidden ? el.formulario : el.solMensaje;
      try { destino.focus(); } catch (e) { /* nada */ }
    });
  }

  /* clic en el fondo oscuro = cerrar */
  function cerrarAlTocarFondo(d) {
    d.addEventListener('click', function (e) {
      if (e.target !== d) return;
      var r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) cerrarDialogo(d);
    });
  }

  /* Al cerrar una ficha, el foco vuelve al espacio que la abrió. Se hace en
     el acto (el evento "close" del navegador llega tarde, a veces medio
     segundo después) y el evento queda solo de respaldo para quien cierre el
     diálogo por otro camino. */
  [el.ficha, el.solicitud].forEach(function (d) {
    d.addEventListener('close', function () { if (!dialogoAbierto(d)) alCerrar(d); });
    /* Esc: se cierra por el mismo camino que el botón */
    d.addEventListener('cancel', function (e) { e.preventDefault(); cerrarDialogo(d); });
  });
  el.fichaCerrar.addEventListener('click', function () { cerrarDialogo(el.ficha); });
  el.solCerrar.addEventListener('click', function () { cerrarDialogo(el.solicitud); });
  el.separar.addEventListener('click', separar);
  el.verEnPlano.addEventListener('click', verEnPlano);
  cerrarAlTocarFondo(el.ficha);
  cerrarAlTocarFondo(el.solicitud);

  el.copiar.addEventListener('click', function () {
    var u = actual();
    if (!u || !confirmado() || u.estado !== 'disponible') return;
    var t = el.solMensaje.value;
    function aMano() {
      el.solMensaje.focus(); el.solMensaje.select();
      var hecho = false;
      try { hecho = document.execCommand('copy'); } catch (e) { hecho = false; }
      toast(hecho ? 'Mensaje copiado.' : 'Selecciona el mensaje y cópialo.');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast('Mensaje copiado.'); }, aMano);
    } else aMano();
  });

  el.whatsapp.addEventListener('click', function (e) {
    var u = actual();
    if (!u || !confirmado() || u.estado !== 'disponible' || !el.whatsapp.getAttribute('href')) {
      e.preventDefault();
      toast('Vuelve a confirmar la disponibilidad antes de continuar.');
      return;
    }
    if (window.MMLmedir) window.MMLmedir.contacto('plano');
  });

  /* ---------------------------------------------------------------------
     Plano: selección, tooltip, zoom y arrastre
     --------------------------------------------------------------------- */
  function codigoDe(e) {
    var n = e.target && e.target.closest ? e.target.closest('[data-codigo]') : null;
    return n ? n.getAttribute('data-codigo') : null;
  }

  el.unidades.addEventListener('click', function (e) {
    var c = codigoDe(e);
    if (c) abrirFicha(c, 'mapa');
  });
  el.unidades.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    var c = codigoDe(e);
    if (!c) return;
    e.preventDefault();
    abrirFicha(c, 'mapa');
  });
  el.lista.addEventListener('click', function (e) {
    var c = codigoDe(e);
    if (c) abrirFicha(c, 'lista');
  });

  el.unidades.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var c = codigoDe(e), u = c && porCodigo[c];
    if (!u) { ocultarTooltip(); return; }
    var pr = precio(u);
    el.tooltip.innerHTML = '<b>' + esc(u.codigo) + '</b> · ' + esc(rotuloEstado(u)) + (u.porConfirmar ? ', ' + esc(POR_CONFIRMAR) : '') + '<br>' +
      esc(rubroTexto(u)) + (u.area != null ? ' · ' + esc(area(u.area)) : '') + '<br>' +
      esc(pr ? nb(pr.texto) + ' (' + pr.notasMensaje.join(' ') + ')' : P.sinPrecio) + '<br><small>' +
      (confirmado() ? 'Haz clic para ver su ficha' : 'Disponibilidad sin confirmar: sin conexión') + '</small>';
    el.tooltip.hidden = false;
    el.tooltip.style.left = Math.max(8, Math.min(e.clientX + 16, window.innerWidth - 296)) + 'px';
    el.tooltip.style.top = Math.max(8, Math.min(e.clientY + 16, window.innerHeight - 150)) + 'px';
  });
  el.unidades.addEventListener('pointerleave', ocultarTooltip);
  el.viewport.addEventListener('scroll', ocultarTooltip, { passive: true });

  function zoom(nueva, cx, cy) {
    nueva = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, Math.round(nueva * 100) / 100));
    if (nueva === escala) return;
    var vp = el.viewport, r = vp.getBoundingClientRect();
    var mx = cx == null ? vp.clientWidth / 2 : cx - r.left;
    var my = cy == null ? vp.clientHeight / 2 : cy - r.top;
    var px = (vp.scrollLeft + mx) / escala, py = (vp.scrollTop + my) / escala;
    escala = nueva;
    el.lienzo.style.width = escala * 100 + '%';
    el.lienzo.style.height = escala * 100 + '%';
    vp.scrollLeft = px * escala - mx;
    vp.scrollTop = py * escala - my;
    el.escala.textContent = Math.round(escala * 100) + '%';
    el.alejar.disabled = escala <= ESCALA_MIN;
    el.acercar.disabled = escala >= ESCALA_MAX;
    ocultarTooltip();
  }
  function ajustar() { zoom(ESCALA_MIN); el.viewport.scrollTo(0, 0); }

  el.acercar.addEventListener('click', function () { zoom(escala + 0.5); });
  el.alejar.addEventListener('click', function () { zoom(escala - 0.5); });
  el.ajustar.addEventListener('click', ajustar);

  /* rueda: desplaza el plano o la página, como siempre; con Ctrl, acerca */
  el.viewport.addEventListener('wheel', function (e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoom(escala * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
  }, { passive: false });

  /* teclado sobre el visor: las flechas ya desplazan (es un contenedor con
     scroll); aquí se agregan más, menos y cero */
  el.viewport.addEventListener('keydown', function (e) {
    if (e.target !== el.viewport || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === '+' || e.key === '=') { zoom(escala + 0.5); e.preventDefault(); }
    else if (e.key === '-' || e.key === '_') { zoom(escala - 0.5); e.preventDefault(); }
    else if (e.key === '0') { ajustar(); e.preventDefault(); }
  });

  /* dos dedos: acercan el plano, no la página (touch-action en el CSS) */
  var pinza = null;
  function distancia(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1; }
  el.viewport.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) pinza = { d: distancia(e.touches), e: escala };
  }, { passive: true });
  el.viewport.addEventListener('touchmove', function (e) {
    if (!pinza || e.touches.length !== 2) return;
    if (e.cancelable) e.preventDefault();
    zoom(pinza.e * distancia(e.touches) / pinza.d,
      (e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2);
  }, { passive: false });
  function finPinza(e) { if (e.touches.length < 2) pinza = null; }
  el.viewport.addEventListener('touchend', finPinza);
  el.viewport.addEventListener('touchcancel', finPinza);

  /* con mouse, arrastrar mueve el plano; el clic que cierra un arrastre no abre fichas */
  var arrastre = null, huboArrastre = false;
  el.viewport.addEventListener('pointerdown', function (e) {
    huboArrastre = false;
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    arrastre = { id: e.pointerId, x: e.clientX, y: e.clientY, sl: el.viewport.scrollLeft, st: el.viewport.scrollTop, movio: false };
  });
  window.addEventListener('pointermove', function (e) {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    var dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
    if (!arrastre.movio && Math.abs(dx) + Math.abs(dy) < 6) return;
    if (!arrastre.movio) { arrastre.movio = true; el.viewport.classList.add('arrastrando'); ocultarTooltip(); }
    el.viewport.scrollLeft = arrastre.sl - dx;
    el.viewport.scrollTop = arrastre.st - dy;
  });
  function soltar() {
    if (!arrastre) return;
    huboArrastre = arrastre.movio;
    arrastre = null;
    el.viewport.classList.remove('arrastrando');
  }
  window.addEventListener('pointerup', soltar);
  window.addEventListener('pointercancel', soltar);
  el.viewport.addEventListener('click', function (e) {
    if (!huboArrastre) return;
    huboArrastre = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);

  /* ---------------------------------------------------------------------
     Filtros y vistas
     --------------------------------------------------------------------- */
  el.buscar.addEventListener('input', pintarFiltrado);
  [el.rubro, el.tipo, el.solo].forEach(function (n) { n.addEventListener('change', pintarFiltrado); });
  el.limpiar.addEventListener('click', function () {
    el.buscar.value = ''; el.rubro.value = ''; el.tipo.value = ''; el.solo.checked = true;
    sinUbic = false;
    pintarFiltrado();
  });
  el.sinUbicacion.addEventListener('click', function () {
    sinUbic = !sinUbic;
    pintarLista();
    if (window.innerWidth < 900) el.listaTitulo.scrollIntoView({ block: 'center', behavior: suave() });
  });

  function ponerVista(v) {
    if (v === vista) return;
    vista = v;
    pintarLeyenda();
    pintarMapa();
  }
  el.vistaDisp.addEventListener('click', function () { ponerVista('disponibilidad'); });
  el.vistaZonas.addEventListener('click', function () { ponerVista('zonificacion'); });
  /* la portada enlaza a planos.html#rubros: llega con la vista por rubro */
  function revisarHash() { if (location.hash === '#rubros') ponerVista('zonificacion'); }
  window.addEventListener('hashchange', revisarHash);

  /* ---------------------------------------------------------------------
     Enlaces de WhatsApp de la página, igual que en el resto del sitio
     --------------------------------------------------------------------- */
  (function () {
    var wa = numeroWa();
    if (!wa) return;
    var url = 'https://wa.me/' + wa + (CFG.whatsappTexto ? '?text=' + encodeURIComponent('Hola, vi el plano en la web y quiero preguntar por un puesto.') : '');
    cada(document.querySelectorAll('[data-wa]'), function (a) { a.href = url; a.target = '_blank'; a.rel = 'noopener'; });
  })();

  /* ---------------------------------------------------------------------
     Red, pestaña y vida de la página
     --------------------------------------------------------------------- */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    empujon();
    reconectarYa();
  });
  window.addEventListener('focus', empujon);
  window.addEventListener('online', function () {
    st.sinRed = false;
    ultimoEmpujon = 0;
    empujon();
    reconectarYa();
    revisarConfirmacion(true);
  });
  window.addEventListener('offline', function () {
    st.sinRed = true;
    revisarConfirmacion(true);
  });
  /* una conexión abierta impide que el navegador guarde la página en su
     caché de ida y vuelta: se cierra al salir y se reabre al volver */
  window.addEventListener('pagehide', function () {
    detenido = true;
    clearTimeout(reintento); reintento = null;
    if (ws) cortar(ws);
  });
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    detenido = false;
    empujon();
    reconectarYa();
  });
  setInterval(function () { revisarConfirmacion(false); }, 1000);

  /* ---------------------------------------------------------------------
     Para las pruebas: solo lectura, sin acceso a lo de adentro
     --------------------------------------------------------------------- */
  function estadoPublico() {
    var c = contar();
    return {
      fase: st.fase,
      realtime: st.rt,
      realtimeUnido: st.rt === 'unido',
      confirmado: confirmado(),
      revision: st.revision,
      version: st.version,
      generadoEl: st.generadoEl,
      semaforo: st.semaforo,
      corte: st.corte,
      unidades: unidades.length,
      sinUbicacion: c.sinUbicacion,
      disponibles: { puestos: c.puestos, tiendas: c.tiendas, otros: c.otros, total: c.total },
      separadas: c.separadas,
      noDisponibles: c.noDisponibles,
      preciosCrm: st.preciosCrm,
      porConfirmar: unidades.filter(function (u) { return u.porConfirmar; }).length,
      enLista: el.lista.querySelectorAll('.inv-tarjeta').length,
      enPlano: el.unidades.querySelectorAll('.inv-u').length,
      ultimaLecturaOk: st.ultimoOk ? new Date(st.ultimoOk).toISOString() : null,
      ultimoError: st.ultimoError,
      lecturas: st.lecturas,
      lecturasOk: st.lecturasOk,
      cambiosAplicados: st.aplicadas,
      avisosRealtime: st.avisos,
      intervaloSeg: intervalo() / 1000,
      vista: vista,
      escala: escala,
      seleccion: seleccion
    };
  }
  try {
    Object.defineProperty(window, 'MMLInventario', {
      value: Object.freeze({
        estado: estadoPublico,
        recargar: function () { return leer(true).then(function () { return estadoPublico(); }); }
      }),
      writable: false, configurable: false, enumerable: false
    });
  } catch (e) { /* ya definido */ }

  /* ---------------------------------------------------------------------
     Arranque
     --------------------------------------------------------------------- */
  pintarPrecios();
  pintarLeyenda();
  revisarHash();
  mostrarFase();
  pintarResumen();
  pintarLista();
  pintarSync();
  leer();
  conectar();
})();
