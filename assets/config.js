/* =========================================================================
   Mercado Media Luna — configuración del sitio
   Este es el ÚNICO archivo que hay que tocar para cambiar enlaces o llaves.
   Nada de aquí es un dato del negocio: son direcciones y llaves técnicas.
   La llave publishable de Supabase es pública por diseño. La service_role
   NUNCA va aquí (07-crm/CLAUDE.md §5).
   ========================================================================= */
window.MML = {

  /* ---- 0 · A dónde va el formulario ---------------------------------------
     'whatsapp' → al enviar se abre el WhatsApp del visitante con su mensaje
                  escrito. No guardamos ningún dato: lo manda él mismo.
     'crm'      → escribe directo en el CRM (fn_captar_prospecto). Solo cuando
                  Dirección cargue aviso_privacidad_version en verde; si no,
                  el CRM rechaza el 100% de los leads.
     Cambiar esta línea es todo lo que hace falta para pasar al CRM. */
  destinoFormulario: 'whatsapp',

  /* ---- 1 · CRM (Supabase) -------------------------------------------------
     Proyecto vivo: crm-mml · nmqwibcxqkaifszzbloo · región sa-east-1.
     Verificado el 17/09/2026: fn_captar_prospecto existe y el rol anónimo
     puede ejecutarla. La llave anon antigua (JWT) está DESACTIVADA en el
     proyecto: se usa la publishable nueva. */
  supabaseUrl: 'https://nmqwibcxqkaifszzbloo.supabase.co',
  supabaseAnonKey: 'sb_publishable_JOUJf0oPbYyHDTPrtiAdtw_qU1hVjAX',

  /* ---- 1b · Inventario en vivo (planos.html → assets/inventario.js) --------
     Desde el 02/10/2026 el plano de planos.html no es una imagen: lo dibuja el
     inventario del CRM, que es la ÚNICA fuente de la disponibilidad. Lo que
     Rosa cambia en /inventario del CRM aparece en la web en pocos
     segundos, sin tocar este archivo ni volver a publicar el sitio.
     · Lectura: la función pública fn_inventario_publico() (solo código, tipo,
       área, rubro, polígono, estado y, desde 19-precio-por-unidad.sql, el
       precio de la unidad disponible cuyo nivel está en verde; nada de
       titulares ni observaciones). "Disponible" sale de v_unidades_ofrecibles,
       no se recalcula aquí. Los polígonos salen del PDF de arquitectura
       (18-geometria-plano.sql, 06/10/2026).
     · Aviso de cambio: el canal público de Realtime 'inventario-publico'
       (evento 'cambio', sin datos: la página vuelve a leer la función).
     · Si el canal se cae, la página vuelve a leer cada sondeoSinRealtimeSeg;
       con el canal arriba, cada sondeoConRealtimeSeg por si se perdió un aviso.
     🟢 16, 18 y 19 están aplicados en el proyecto vivo (comprobado el
     06/10/2026: la función responde con la clave "precio" y P-264 ya tiene
     polígono). Si la función no responde, la página muestra la lámina de
     arquitectura sin disponibilidad y reintenta sola. */
  inventario: {
    rpc: 'fn_inventario_publico',
    canal: 'inventario-publico',
    evento: 'cambio',
    /* la respuesta pesa unos 10 KB comprimida: leer cada 20 s cuesta poco y
       deja la web al día aunque se pierda un aviso de Realtime */
    sondeoConRealtimeSeg: 20,
    sondeoSinRealtimeSeg: 10,
    /* Precios: los MISMOS textos que ya publica la portada (index.html, "Qué se
       vende"), sacados de 00-fuente-de-verdad/precios-vigentes.md (05/10/2026: puesto US$25,000, tienda US$82,000,
       aprobados por Walter y comunicados por SCP; respaldo escrito pendiente).
       El precio de tienda se muestra SOLO para las tiendas de 22 a 23 m²
       (precios-vigentes.md §0.2 y su fila "22-23 m²"): las demás, y cualquier
       unidad sin área, se cotizan según su área. El tipo de cambio es el de
       todo el sitio, S/3.37 al 23/09/2026 (BCRP), según moneda-de-comunicacion.md
       y precios-vigentes.md; NO el S/3.44 (SBS) del diseño InventarioGraficoWeb.
       El precio de puesto se muestra SOLO para el puesto estándar de 9 a 10 m²
       (356 de los 423 puestos, inventario-maestro.md; el parámetro del CRM es
       precio_puesto_9m2 y el Acta 03-O02 vende puestos de 9 m²). Los puestos de
       otra área se cotizan según su área. 🟡 Por validar con Walter (02/10/2026):
       precios-vigentes.md no dice si los US$25,000 valen para un puesto de 19.70 m².
       Cuentas: US$ × 3.37 → 25,000 = 84,250 · 82,000 = 276,340.
       Desde el 06/10/2026 ("cada unidad con su precio", SCP por chat): en cuanto
       el CRM publica el precio de alguna unidad, el plano muestra SOLO los
       precios del CRM y esta regla de 9-10 m² y 22-23 m² deja de usarse ahí. */
    precios: {
      puesto: 'US$ 25,000 · S/ 84,250',
      puestoAreaMin: 9,
      puestoAreaMax: 10,
      tienda: 'US$ 82,000 · S/ 276,340',
      tiendaAreaMin: 22,
      tiendaAreaMax: 23,
      sinPrecio: 'Precio según su área: te lo cotizamos',
      igv: 'IGV incluido.',
      /* sin plazo: "hasta completar la venta de 10 puestos más" era del precio de US$24,000 y
         Walter no dijo si sigue (precios-vigentes.md, bloque del 05/10/2026) */
      condicionPuesto: 'Si el precio cambia, lo actualizamos aquí.',
      notarial: 'No incluye el trámite notarial de S/2,500.',
      tipoCambio: 'Tipo de cambio referencial S/3.37 al 23/09/2026 (BCRP).',
      /* el MISMO número del texto de arriba: con él se pasan a soles los
         precios en dólares que manda el CRM. Si cambia uno, cambia el otro; si
         no coinciden, el plano no publica ningún precio del CRM en dólares. */
      tipoCambioValor: 3.37,
    },
  },

  /* ---- 2 · WhatsApp -------------------------------------------------------
     Número en formato internacional, solo dígitos. Ej: '51987654321'.
     Número del proyecto confirmado por Patriccio el 17/09/2026 (+51 992 755 150).
     Si se vacía, los botones de WhatsApp llevan al formulario.
     Si cambias este número, cámbialo también en el <noscript> de index.html
     (sección #hablemos), que no puede leer este archivo. */
  whatsapp: '51992755150',
  whatsappTexto: 'Hola, vi la web de Mercado Media Luna y quiero información.',

  /* ---- 2b · Medición: Píxel de Meta ----------------------------------------
     Solo se carga si el visitante acepta el aviso de cookies (assets/medicion.js).
     Vacío = sin píxel y sin aviso. Nunca se envían nombre, teléfono ni respuestas.
     APAGADO A PROPÓSITO: el aviso de privacidad (privacidad.html) todavía no
     tiene la identidad del responsable, el correo de derechos ARCO ni el
     plazo de conservación completos (ver PENDIENTES-WEB.md #1). Sin eso, el
     consentimiento del aviso de cookies no es "informado" (D.S. 016-2024-JUS
     art. 6.1). Cuando Dirección ratifique el aviso, cambiar esta línea a
     true: no hace falta tocar nada más, el aviso y el píxel se activan solos. */
  avisoPrivacidadListo: false,
  metaPixelId: '28950555004562397',

  /* ---- 3 · Redes ---------------------------------------------------------- */
  redes: {
    youtube: 'https://www.youtube.com/@MercadoMediaLuna',
    instagram: 'https://www.instagram.com/mercadomedialuna/',
    tiktok: 'https://www.tiktok.com/@mercadomedialuna',
    facebook: 'https://www.facebook.com/profile.php?id=61573313321939',
  },

  /* ---- 4 · Testimonios ----------------------------------------------------
     Una tarjeta por comprador en la portada y en /evento: foto,
     estrellas, sus palabras, nombre y rubro. Al tocar la foto se reproduce
     el video (assets/testimonios.js).
     REGLAS DEL PROYECTO:
     · cada comprador que sale en la web necesita su autorización de imagen.
       Si "autorizacion" trae la palabra PENDIENTE, la web muestra el aviso;
     · la cita es TEXTUAL, sacada de su video, y no puede prometer
       rentabilidad, plusvalía, fechas ni "título de propiedad". Si en el
       video dicen algo así, se elige otra frase (ver PENDIENTES-WEB.md, E19).
     · la foto va recortada 4:5 en assets/, con nombre nuevo si cambia. */
  testimonios: [
    {
      id: 'B83FezzbXAg',
      nombre: 'Julia Ortiz',
      descripcion: 'Rubro de comida',
      /* textual, de 0:14 a 0:21 de su video */
      cita: 'Quiero trabajar lo que es mío, ya no alquilar, sino mi propio negocio, mi propio puesto.',
      foto: 'assets/testimonio-julia-ortiz.jpg',
      duracion: '1:53',
      autorizacion: 'Accedió a la entrevista y a su publicación (Patriccio, 25/09/2026). Falta archivar la firma.',
    },
    {
      id: '1cvIRgGigTg',
      nombre: 'Vilma Ferrer',
      descripcion: 'Compradora del mercado',
      /* textual, de 0:04 a 0:13 de su video, según la transcripción de
         YouTube (leída el 28/09/2026; se quitaron las muletillas). Patriccio
         pidió una frase positiva que invite a ver su testimonio. Se eligió una
         que no promete ganancia ni revalorización. 🟡 Confirmar escuchando el
         video: la transcripción es automática. */
      cita: 'Cuando hubo el proyecto del mercado me emocioné, invertí porque me encanta el negocio.',
      foto: 'assets/testimonio-vilma-ferrer.jpg',
      duracion: '2:42',
      /* entregado por Patriccio para publicar el 25/09/2026 */
      autorizacion: 'Entregado por Patriccio para publicar (25/09/2026). Falta archivar la firma.',
    },
    {
      id: 'pdMXMdVjZ2o',
      nombre: 'Emilio',
      descripcion: 'Compró cuando esto era desierto',
      /* textual: 0:22 y 1:00 de su video */
      cita: 'Era prácticamente el desierto, no había nada. […] Para tener un progreso hay que ver hacia delante.',
      /* foto entregada por Patriccio el 24/09/2026. Se difuminó un letrero del
         fondo ("pago hasta en 12 meses" y teléfonos de terceros): podía
         leerse como una oferta de financiamiento nuestra. */
      foto: 'assets/testimonio-emilio.jpg',
      duracion: '2:59',
      /* Autorizó de viva voz a Patriccio el 23/09/2026. Falta archivar la firma. */
      autorizacion: 'Verbal, 23/09/2026. Falta archivar la firma.',
    },
    {
      id: 'll-ct7oEnPo',
      nombre: 'Víctor Arbieto',
      /* así lo presenta el canal: "nuestro socio Víctor Arbieto" */
      descripcion: 'Socio del mercado',
      /* textual, de 0:16 a 0:37 de su video, según la transcripción de YouTube
         (leída el 28/09/2026; sin muletillas). 🟡 Confirmar escuchando.
         OJO: el video completo dice "el único mercado que tiene su título de
         propiedad" (1:49, 2:51) y "lo dupliqué" / "van a ganar su dinero"
         (2:51-3:10). Patriccio decidió publicarlo completo el 28/09/2026: ver
         PENDIENTES-WEB.md E28. */
      cita: 'Siempre quise tener un puesto en un mercado y opté en invertir en el mercado Media Luna […] para poder dejar buena herencia también a mis hijos.',
      /* video vertical subido como video normal, no como Short: la tarjeta lo
         muestra vertical igual que los demás. Foto: cuadro del video entregado
         por Patriccio el 28/09/2026, recortado a 4:5. */
      foto: 'assets/testimonio-victor-arbieto.jpg',
      duracion: '3:40',
      autorizacion: 'Entregado por Patriccio para publicar (28/09/2026). Falta archivar la firma.',
    },
    {
      id: 'dX_l9PNLOC0',
      nombre: 'María Alejandrina',
      /* así la presenta el canal: "una de nuestras socias fundadoras" */
      descripcion: 'Socia fundadora del mercado',
      /* textual, de 0:11 a 0:19 de su video, según la transcripción de YouTube
         (leída el 05/10/2026; se quitó la muletilla "yo"). 🟡 Confirmar
         escuchando: la transcripción es automática.
         OJO: el video completo dice "con título, con bas, con todo" (0:30),
         "más adelante él va a ganar más" (1:47), "su título de ahí testimonio"
         (2:04): ver PENDIENTES-WEB.md E29. */
      cita: 'Yo también voy a comprar mi puesto para motivarme, trabajar también y seguir adelante.',
      /* cuadro del video entregado por SCP el 05/10/2026, recortado a 4:5 sin
         la marca "CapCut AI" de la esquina */
      foto: 'assets/testimonio-maria-alejandrina.jpg',
      duracion: '2:51',
      autorizacion: 'Entregado por SCP para publicar (05/10/2026). Falta archivar la firma.',
    },
    {
      id: '9kLxIYqXZSY',
      nombre: 'Waldo Arias',
      descripcion: 'Socio del mercado',
      /* textual, de 0:04 a 0:11 de su video, según la transcripción de YouTube
         (leída el 05/10/2026). 🟡 Confirmar escuchando: la transcripción
         automática lo escribe "el punto eséntrico" y repite palabras.
         OJO: el video completo dice "va a pasar un boom" (0:29), "es una
         inversión para el futuro, para que tenga un ingreso" (1:18),
         "tiene su propiedad" (1:59) y "tiene título de propiedad" (2:31):
         ver PENDIENTES-WEB.md E29. */
      cita: 'A mí me motivó el mercado para invertir por la zona, que es el punto céntrico.',
      /* cuadro del video entregado por SCP el 05/10/2026, recortado a 4:5 sin
         la marca "CapCut AI". Se difuminó un letrero del fondo ("atención 24
         horas"): podía leerse como un servicio nuestro. */
      foto: 'assets/testimonio-waldo-arias.jpg',
      duracion: '2:50',
      autorizacion: 'Entregado por SCP para publicar (05/10/2026). Falta archivar la firma.',
    },
    {
      id: 'DjQuVSABEuo',
      nombre: 'Neil Salvatierra',
      descripcion: 'Socio del mercado',
      /* textual, de 0:22 a 0:31 de su video, según la transcripción de YouTube
         (leída el 05/10/2026). 🟡 Confirmar escuchando. Se omitió con […] "de
         la mano de seis zonas poblacionales", una cifra sin fuente.
         OJO: el video completo dice "una gran inversión que va a respaldar el
         futuro de ustedes y de su familia" (0:00), "desde la primera cuota
         contarán ustedes con su minuta" (1:20) y, al final, una frase de
         entre cámaras ("La última respuesta no me gustó, Waltercito", 2:02):
         ver PENDIENTES-WEB.md E29. */
      cita: 'Ya que Lima está creciendo, me pareció una muy buena oportunidad poder invertir esta vez en una zona que […] está creciendo.',
      /* cuadro del video entregado por SCP el 05/10/2026, recortado a 4:5 sin
         la marca "CapCut AI" */
      foto: 'assets/testimonio-neil-salvatierra.jpg',
      duracion: '2:11',
      autorizacion: 'Entregado por SCP para publicar (05/10/2026). Falta archivar la firma.',
    },
  ],

  /* ---- 4a · Walter, en sus palabras (sección "Quiénes lo construyen") -----
     Short del canal oficial @MercadoMediaLuna. Patriccio lo entregó el
     23/09/2026 como la historia de Walter en primera persona, confirmada por
     Walter, y con eso se cerró ese pendiente. La foto de la sección hace de
     portada: YouTube no se toca hasta que alguien le da reproducir.
     Vacío = la sección muestra la foto sola, sin botón. */
  walter: {
    youtubeId: 'ZJXQzHrq6fE',
  },

  /* ---- 4b · El evento en vivo de los miércoles (evento.html → /evento) ----
     Desde el 28/09/2026 es la página del sábado 26 con la fecha de los
     miércoles, por decisión de Patriccio ("manteniendo todo como está, solo
     cambiando la fecha"). La fecha no se escribe en ningún lado: la página
     calcula sola el próximo miércoles en hora de Lima. De 7:30 p.m. a las
     11:59 p.m. de ese miércoles cuenta hasta el cierre del descuento; pasada la
     medianoche pasa sola al miércoles siguiente. No hay que tocar nada cada
     semana.
     En los textos, {fecha} se reemplaza por "miércoles 30 de septiembre" y
     {hora} por la hora de abajo.
     El descuento de US$2,000 es un dato de precio: está registrado en
     00-fuente-de-verdad/precios-vigentes.md §2b (sábado) y §2c (miércoles). */
  evento: {
    diaSemana: 3,              // 0 domingo, 3 miércoles
    hora: 19, minuto: 30,      // 7:30 p.m., hora de Lima (Patriccio, 28/09/2026)
    horaTexto: '7:30 p.m.',
    /* CUPO DEL DESCUENTO: 10 puestos y 2 tiendas EN TOTAL entre todos los
       miércoles, hasta agotarlos (Patriccio, 28/09/2026: no se renueva cada
       semana). Después de cada evento, anotar aquí cuántos quedan y la fecha:
         quedan: { puestos: 7, tiendas: 2, al: '2026-10-01' }
       · null (como está) = no se sabe cuántos quedan: la página dice solo el
         total, "10 puestos y 2 tiendas en total, hasta agotarlos", y nunca
         "quedan". [PENDIENTE: ¿el sábado 26 se separó alguna unidad con el
         descuento? Ver precios-vigentes.md §2c]
       · con números Y fecha (al: 'AAAA-MM-DD') = la página agrega "Con el
         descuento quedan N puestos y M tiendas (al <fecha>)". Sin fecha no
         lo publica: un "quedan" sin fecha envejece sin que se note. Si un
         tipo llega a 0, su tarjeta dice "Agotado".
       · 0 puestos y 0 tiendas = la promoción terminó: la página deja de
         ofrecer el descuento y sigue invitando a la transmisión. OJO: la
         vista previa (evento.html, <meta name="description"> y
         <meta property="og:title">) no cambia sola: ese día hay que
         quitarle a mano el descuento. */
    cupo: {
      total: { puestos: 10, tiendas: 2 },
      quedan: null
    },
    /* VIDEO DE INTRODUCCIÓN: pegar aquí el enlace de YouTube tal cual (sirve
       el normal, el corto youtu.be o el de Shorts). Aparece arriba en la
       página y arranca solo, con sonido donde el navegador lo deja (si no,
       sin sonido hasta el primer toque). Vacío = el espacio no se muestra.
       formato: 'horizontal' (16:9) o 'vertical' (Shorts, 9:16). */
    videoIntro: { enlace: 'https://youtu.be/CIRhBK0UnQI', formato: 'horizontal' },   // "Evento 26 de Septiembre", entregado por Patriccio el 26/09/2026. [PENDIENTE: su título en YouTube dice "26 de Septiembre" y se ve arriba del video]
    videoIntroTitulo: 'Video de introducción del evento de los miércoles',
    /* 'opcional' → se puede saltar (recomendado arriba del embudo: pedir el
       documento antes de la primera conversación cuesta registros).
       'obligatorio' → no se puede saltar.  'no' → ni se pregunta. */
    pedirDocumento: 'opcional',
    /* no dice "estamos en vivo": nadie fijó cuánto dura la transmisión, y entre
       el final y la medianoche sería falso */
    rotuloEnVivo: 'El evento de hoy empezó a las {hora} El descuento de US$2,000 (S/6,740) vence a la medianoche, hora de Perú. Para el cierre faltan:',
    /* cuando la promoción se agota (cupo.quedan en 0 y 0) y la transmisión
       de hoy ya empezó */
    rotuloEnVivoSinPromo: 'La transmisión de hoy empezó a las {hora}, hora de Perú. La siguiente es el {fechaSiguiente}.',
    rotuloEnVivoSinPromoFija: 'La transmisión empezó a las {hora}, hora de Perú.',   // evento de una sola fecha
    saludo: [
      'Hola. Este es el registro automático del evento en vivo del {fecha}.',
      'Son cuatro preguntas rápidas y tu nombre. Menos de un minuto.'
    ],
    preguntaAsistencia: {
      id: 'miercoles', texto: '¿Te conectas este {fecha} a las {hora}?', rotulo: 'El {fecha}',
      opciones: [
        { v: 'si', t: 'Sí, me conecto' },
        { v: 'quizas', t: 'Voy a intentarlo' },
        { v: 'info', t: 'Mándame la información primero' }
      ],
      eco: {
        quizas: 'Te mandamos los enlaces igual. El descuento es solo para quienes se conecten esa noche y se unan a la comunidad, mientras queden unidades de la promoción.',
        info: 'Listo. Te mandamos la información y los enlaces de la transmisión y de la comunidad.'
      },
      /* si la promoción se agotó (cupo.quedan en 0 y 0) */
      ecoSinPromo: {
        quizas: 'Te mandamos los enlaces igual, para que te conectes cuando puedas.'
      }
    },
    mensajeRegistro: 'Quiero registrarme al evento en vivo del {fecha}, {hora}',
    mensajeWa: 'Hola, vi la página del evento en vivo de los miércoles de Mercado Media Luna y quiero información.',
    confirmacion: 'Listo. Si se abrió tu WhatsApp, dale enviar y te mandamos los enlaces de la transmisión y de la comunidad.',
    /* Un evento de UNA sola fecha (como fue el sábado 26) se arma agregando
       aquí fecha: '2026-10-10T21:00:00-05:00' y cierreOferta: '...T23:59:59-05:00':
       la página cuenta hasta esa fecha y, pasado el cierre, dice que terminó. */
  },

  /* ---- 5 · Video del hero -------------------------------------------------
     El timelapse de la construcción (entregado por Patriccio el 24/09/2026)
     recodificado desde el original HEVC de 10 bits: H.264 con un cuadro clave
     cada 8 para que el scroll vaya y vuelva sin trabarse. Escritorio a CRF 18,
     que a tamaño real no se distingue del original.
     Cuando cambie el video, cambia el nombre del archivo: /assets/ guarda
     imágenes y videos 7 días en el navegador y un nombre repetido dejaría a
     quien ya visitó el sitio viendo el video viejo. */
  video: 'assets/hero-scrub-v2.mp4',                  // 1920×1080
  videoLigero: 'assets/hero-scrub-v2-lite.mp4',       // 1280×720: solo con conexión lenta o ahorro de datos
  videoBytes: 7100592,                                // respaldo cuando falta Content-Length
  videoLigeroBytes: 2947814,
  poster: 'assets/hero-poster-v2.jpg',                // primer cuadro del video, idéntico
  /* En celular (vertical) el hero es compacto: un recorte cuadrado centrado
     en el mercado, que así se ve completo en el ancho del teléfono. */
  videoMovil: 'assets/hero-scrub-v2-movil.mp4',       // 1080×1080
  videoMovilLigero: 'assets/hero-scrub-v2-movil-lite.mp4', // 720×720
  videoMovilBytes: 3422425,
  videoMovilLigeroBytes: 1639454,
  posterMovil: 'assets/hero-poster-v2-movil.jpg',
};
