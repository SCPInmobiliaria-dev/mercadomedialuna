# Mercado Media Luna · landing

Sitio público de **Mercado Media Luna**, el mercado en construcción de SCP Inmobiliaria en
Jicamarca, Sector Media Luna. En vivo en **https://mercadomedialuna.com**.

Es un sitio estático: HTML, CSS y JavaScript sin frameworks ni paso de compilación. Lo que ves en
esta carpeta es exactamente lo que se publica.

## Qué hay en la página

- **Hero con scroll:** el mercado se construye desde el lote vacío hasta la proyección del modelo 3D
  (Blender V11 + Seedance). Lleva siempre la barra *Proyección arquitectónica — obra en construcción*.
- **Calculadora de alquiler:** el visitante hace la cuenta con sus propios números.
- **Embudo de calificación** (`assets/embudo.js`): un chat automático con las preguntas del guion de
  calificación. Al final abre el WhatsApp del visitante con el resumen escrito para el equipo.
- **`[PENDIENTE]` visibles** donde falta un dato confirmado en `00-fuente-de-verdad/` del repositorio
  de trabajo (SCPCMO). Ningún precio, área, cantidad, fecha o condición se escribe sin fuente.

## Cómo se publica

El proyecto de Vercel `mercado-media-luna` (equipo `mml11`) está conectado a este repositorio:
**cada push a `main` se publica solo en producción** en uno o dos minutos.

- Panel: https://vercel.com/mml11/mercado-media-luna
- Dominios: https://vercel.com/mml11/mercado-media-luna/settings/domains
- DNS: en Banahosting (DNS Management del dominio). `@` y `www` → A `76.76.21.21`.
  El registro `staff` (CNAME) es el CRM: no se toca.

Las ramas que no son `main` generan una vista previa con su propia URL, sin tocar el sitio en vivo.

**Antes de cada push que toque `assets/*.css` o `assets/*.js`**, sellar la versión:

```
node sellar-version.mjs
```

`/assets/` se sirve con caché de 7 días; sin el sello, quien ya visitó el sitio ve el HTML nuevo
pintado con el CSS o JS viejo. El script deriva el `?v=` del contenido y lo escribe en todas las
páginas (`--revisar` solo comprueba, sin tocar nada). Detalle en la cabecera de `sellar-version.mjs`.

## Lo que se cambia sin tocar código

Todo está en **`assets/config.js`**:

| Qué | Clave |
|---|---|
| Número de WhatsApp | `whatsapp` (si cambia, también en el `<noscript>` de `index.html`) |
| Adónde va el embudo | `destinoFormulario`: `'whatsapp'` hoy, `'crm'` cuando Dirección cargue el aviso de privacidad en verde |
| Testimonios en video | `testimonios` (un objeto por video, con autorización firmada) |
| Redes | `redes` |

## Pruebas

Las pruebas con navegador real viven fuera de esta carpeta, en `08-web/review/test/` del repositorio
de trabajo: `audit.mjs` (sitio completo) y `embudo-test.mjs` (el chat, incluido el modo CRM simulado).
