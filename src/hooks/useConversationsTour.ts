import { useCallback, useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_KEY = 'conversations_tour_v1_completed';

export function useConversationsTour() {
  const start = useCallback(() => {
    const d = driver({
      showProgress: true,
      allowClose: true,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Atrás',
      doneBtnText: 'Listo',
      progressText: '{{current}} de {{total}}',
      steps: [
        {
          popover: {
            title: '✨ Novedades en Conversaciones',
            description:
              'Te mostramos en 30 segundos las nuevas herramientas para responder más rápido y mejor.',
          },
        },
        {
          popover: {
            title: '📌 Notas internas',
            description:
              'En el composer, activa el modo "Nota interna" para dejar comentarios visibles solo para tu equipo (no se envían al cliente).',
          },
        },
        {
          popover: {
            title: '⏰ Posponer y programar',
            description:
              'En el menú de 3 puntos del chat puedes posponer la conversación (snooze) y programar mensajes para que se envíen automáticamente más tarde.',
          },
        },
        {
          popover: {
            title: '✨ IA Assist',
            description:
              'Pulsa el botón de IA en el chat para generar 3 borradores de respuesta (formal, empático, directo) usando el mismo motor que Análisis IA.',
          },
        },
        {
          popover: {
            title: '🔍 Búsqueda global',
            description:
              'Usa Ctrl/Cmd + K en cualquier pantalla para buscar mensajes en todas las conversaciones.',
          },
        },
        {
          element: '[data-tour="duplicates-sidebar"]',
          popover: {
            title: '👥 Contactos duplicados',
            description:
              'Detecta y fusiona contactos repetidos desde aquí. Mantén tu CRM limpio en un clic.',
            side: 'right',
            align: 'start',
          },
        },
      ],
      onDestroyed: () => {
        try {
          localStorage.setItem(TOUR_KEY, '1');
        } catch {}
      },
    });
    d.drive();
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(TOUR_KEY)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => start(), 800);
    return () => clearTimeout(t);
  }, [start]);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(TOUR_KEY);
    } catch {}
    start();
  }, [start]);

  return { start, reset };
}
