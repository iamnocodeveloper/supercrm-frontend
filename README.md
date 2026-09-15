# Capibet

Aplicación web (SPA) para la gestión de conversaciones y ventas por WhatsApp con agente de IA.
Este repositorio contiene **únicamente el frontend**. El backend vive en Supabase
(PostgreSQL + Auth + Realtime + Storage + Edge Functions) y la mensajería se conecta a través
, Zernio (WhatsApp Cloud API de Meta), Twilio, Telegram y un widget de Web Chat propio.

- **Producto:** Capibet
- **Versión de la aplicación:** 3.11.0
- **Última actualización documentada:** 2026-09-10

---

## 1. Qué es el sistema

Capibet es una plataforma **multi-tenant** que centraliza en una sola interfaz:

- La **mensajería de WhatsApp** de una o varias sesiones/números por cuenta.
- Un **embudo de ventas Kanban** donde cada conversación se representa como un lead.
- Un **agente de IA** que responde automáticamente según reglas configurables.
- **Campañas masivas**, contactos, listas, respuestas rápidas y etiquetas.
- **Reportes y análisis** de volumen, conversión y consumo de IA.
- Un **flujo específico de casino** (alta de usuario, CBU, comprobantes de pago).

La aplicación se opera por roles: un `superadmin` de plataforma, un `client` (admin de la
cuenta) y los `cajero` (operadores de chat) que dependen de ese cliente.

---

## 2. Arquitectura

```
Navegador (SPA React + Vite)
        │  supabase-js (Auth, PostgREST, Realtime, Storage)
        ▼
Supabase (PostgreSQL + RLS + Auth + Realtime + Storage + Edge Functions)
        │
        ├── Zernio / Meta       → WhatsApp Cloud API oficial (multi-cuenta, failover)
        ├── Twilio              → SMS / WhatsApp
        ├── Telegram Bot API    → Telegram
        └── Web Chat (widget)   → chat embebido y chat de landing
```

- **Frontend:** SPA con `react-router-dom`. Todas las páginas se cargan con `React.lazy`
  y quedan detrás de `ProtectedRoute` (las de administración exigen `requireSuperAdmin`).
- **Backend:** Supabase. El cliente del frontend usa solo la **clave publicable**; la
  `service_role` y las claves de canal viven exclusivamente en Supabase Secrets.
- **Tiempo real:** Supabase Realtime sobre `messages`, `conversations`, `agent_presence`
  y `campaign_sends`; el polling del frontend es solo respaldo.
- **Aislamiento de datos:** Row Level Security por `account_owner_id` en cada tabla.

### Modelo multi-tenant y roles

- Cada fila de negocio se asocia al `account_owner_id` (el dueño de la cuenta). La función
  `get_account_owner_id(uid)` resuelve el dueño real de cualquier usuario (incluidos subusuarios).
- Jerarquía de tres niveles (`profile_type`): `superadmin` > `client` > `cajero`.
- Roles granulares en `user_roles` (`app_role`) y permisos por usuario en `user_permissions`
  (~60 flags booleanos `puede_*`) que administra el dueño de la cuenta.
- **Asignación de conversaciones a cajeros** mediante `agent_presence` (presencia/estado) y
  `assignment_settings` (estrategia `manual`, `round_robin` o `least_load`).

---

## 3. Módulos

| Ruta | Módulo | Descripción |
| --- | --- | --- |
| `/` | Panel principal | Métricas y accesos rápidos de la cuenta. |
| `/reportes` | Reportes | Volumen por hora, heatmap de mensajes, conversión. |
| `/analisis-conversaciones` | Análisis IA | Analítica de conversaciones asistida por IA. |
| `/conversaciones` | Conversaciones | Bandeja estilo WhatsApp Web con Realtime. |
| `/crear-conversacion` | Crear conversación | Inicio de conversación con contacto/sesión. |
| `/chat-landing` | Chat - Landing | Conversaciones originadas en la landing pública. |
| `/chat-interno` | Chat interno | Mensajería entre usuarios de la cuenta. |
| `/campanas-masivas` | Campañas masivas | Envíos segmentados multi-sesión. |
| `/chat-jugadores` | Chat jugadores | Conversaciones del módulo de casino. |
| `/grupos-whatsapp` | Grupos de WhatsApp | Gestión de grupos por sesión. |
| `/estados-whatsapp` | Estados de WhatsApp | Programación y publicación de estados. |
| `/soporte-trucoarg` | Soporte TrucoArg | Bandeja de soporte de la integración TrucoArg. |
| `/leads` | Embudos | Tablero Kanban de leads (drag & drop entre columnas). |
| `/leads-webchat` | Embudos WebChat | Embudo de contactos del widget web. |
| `/contactos` | Contactos | Directorio de contactos de la cuenta. |
| `/listas-contactos` | Listas de contactos | Listas para campañas. |
| `/contactos-duplicados` | Contactos duplicados | Detección y depuración (solo admin). |
| `/asistente-ia` | Asistente IA | Agentes de IA por canal. |
| `/crear-agente` | Crear agente IA | Alta y configuración de un agente. |
| `/email-masivo` | Email masivo | Envíos por correo (habilitado por entorno). |
| `/calendario` | Calendario | Tareas y eventos. |
| `/ventas` | Ventas | Registro de ventas del negocio. |
| `/planes-pago` | Planes de pago | Catálogo de planes (solo lectura). |
| `/uso-plan` | Uso del plan | Consumo del plan contratado. |
| `/conexiones` | Conexiones WhatsApp | Alta y estado de sesiones de canal. |
| `/configuracion` | Configuración | Perfil, contraseña, sesiones, usuarios, IA, etiquetas, costos, casino API. |
| `/admin` y `/admin/*` | Panel superadmin | Usuarios, estadísticas, mensajes, conversaciones y auditoría de la plataforma. |

---

## 4. Canales e IA

**Canales soportados**

- WhatsApp Business API oficial vía **Zernio / Meta Cloud API** (varias API keys por cuenta,
  con failover).
- **Twilio** (SMS / WhatsApp).
- **Telegram** (Bot API).
- **Web Chat**: widget embebido propio y chat de landing pública.

> Facebook / Instagram fueron retirados del sistema (edge functions, frontend y tabla).

**Inteligencia artificial**

- Modelo base **Gemini 2.5 Flash**, con paso por el gateway de Lovable cuando aplica.
- Cada canal tiene su `ai_agent` configurable; la IA se activa por conversación (`ai_enabled`).
- `ai_response_buffer` agrupa mensajes entrantes (antiflood) antes de responder.
- `ia_humanization_settings` controla retrasos, temperatura y frecuencia de emojis.
- `ia_default_settings` define el flujo global del casino (CBU, números de caja, enlace).
- Claves de proveedor propias por usuario en `ai_api_keys`.

---

## 5. Requisitos

- Node.js 18+ (o Bun, el repo incluye `bun.lock`).
- Un proyecto de Supabase con el backend desplegado (tablas, RLS, Edge Functions y canales).

## 6. Instalación

```bash
git clone https://github.com/iamnocodeveloper/supercrm-frontend.git
cd supercrm-frontend
npm install
cp .env.example .env
npm run dev
```

Scripts disponibles:

| Script | Acción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (Vite). |
| `npm run build` | Build de producción. |
| `npm run build:dev` | Build en modo desarrollo. |
| `npm run preview` | Sirve el build generado. |
| `npm run lint` | ESLint sobre todo el proyecto. |

## 7. Variables de entorno

El frontend solo requiere las claves públicas de Supabase (ver `.env.example`):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```



## 8. Estructura del proyecto

```
src/
├── App.tsx              # Definición de rutas (lazy) y providers globales
├── components/          # UI y componentes por dominio
│   ├── ui/              # Base shadcn/ui (Radix)
│   ├── layout/          # Sidebar, Header y layouts
│   ├── conversations/   # Bandeja de conversaciones
│   ├── contacts/        # Contactos y listas
│   ├── campaigns/       # Campañas masivas
│   ├── settings/        # Pestañas de configuración
│   ├── sessions/        # Formularios de conexión de canales
│   ├── system/          # Información del sistema (Acerca de)
│   └── ...
├── pages/               # Una página por ruta (+ pages/admin)
├── hooks/               # Hooks de datos y estado (React Query, auth, permisos)
├── services/            # Acceso a datos y lógica de dominio
├── integrations/        # Cliente de Supabase y tipos generados
├── lib/                 # Utilidades
└── types/               # Tipos compartidos
public/                  # Estáticos (favicon, robots.txt)
index.html               # Shell de la SPA
```

## 9. Stack

React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui (Radix UI) · TanStack React Query ·
React Router · Supabase JS · React Hook Form + Zod · Recharts · react-beautiful-dnd ·
date-fns · next-themes · lucide-react.

## 10. Documentación

La documentación operativa del sistema (backend, changelog, auditoría de seguridad,
rendimiento y rollback) se mantiene fuera de este repositorio, junto al proyecto completo.
