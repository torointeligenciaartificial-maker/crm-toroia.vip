import { Client } from './db';

export interface GeneratedEmail {
  subject: string;
  body: string;
}

export function generateEmail(
  client: Client,
  type: string,
  tone: string = 'cercano',
  customBullets: string = ''
): GeneratedEmail {
  const name = client.name || 'Cliente';
  const company = client.company || 'su empresa';
  const services = client.services || 'servicios de consultoría y automatización';
  const budget = client.budget ? `€${client.budget.toLocaleString()}` : 'a convenir';

  // Inyectar viñetas personalizadas si existen
  const extraBulletsText = customBullets
    ? `\n\nParticularidades de tu proyecto que he tenido en cuenta:\n${customBullets
        .split('\n')
        .map(line => line.trim().startsWith('-') || line.trim().startsWith('*') ? line : `- ${line}`)
        .join('\n')}`
    : '';

  if (type === 'bienvenida') {
    if (tone === 'formal') {
      return {
        subject: `Bienvenida a toroia.vip – Inicio del proyecto de ${services}`,
        body: `Estimado/a ${name},

Espero que se encuentre excelente.

Le escribo en nombre de todo el equipo de toroia.vip para agradecerle formalmente su confianza al seleccionarnos para el desarrollo e integración de "${services}" para ${company}.

Hemos inicializado el plan de estructuración técnica para asegurar que optimizamos sus procesos bajo los más altos estándares de rendimiento. Para su registro, el presupuesto de referencia asignado es de ${budget}.${extraBulletsText}

Próximamente recibirá una invitación para agendar nuestra sesión formal de Kickoff (alineación inicial), donde coordinaremos las especificaciones técnicas y accesos requeridos.

Le agradecemos de antemano su colaboración.

Atentamente,

El equipo de toroia.vip
Consultoría Digital y Automatización`
      };
    } else if (tone === 'persuasivo') {
      return {
        subject: `¡Todo listo para revolucionar tus procesos en ${company}! 🚀`,
        body: `Hola ${name},

¡Qué gran noticia comenzar a trabajar juntos!

En toroia.vip estamos listos para arrancar con el proyecto de "${services}" y llevar la eficiencia de ${company} al siguiente nivel. Nuestro objetivo principal es eliminar cuellos de botella y automatizar las tareas repetitivas para que tu equipo se enfoque en aportar el máximo valor.

Tenemos estimado que esta automatización liberará horas clave de trabajo semanal. La inversión acordada para este hito es de ${budget}.${extraBulletsText}

¿Qué te parece si reservamos 15 minutos a principios de semana para el Kickoff técnico? Te prometo que verás el retorno de inversión desde las primeras semanas.

¡Un fuerte abrazo!

El equipo de toroia.vip
Consultoría Digital y Automatización`
      };
    } else if (tone === 'tecnico') {
      return {
        subject: `Especificación Técnica & Kickoff: ${services} – toroia.vip`,
        body: `Hola ${name},

Confirmamos la recepción del acuerdo para implementar "${services}" en la infraestructura de ${company}.

Hemos configurado el repositorio local y el modelo relacional inicial (presupuesto estimado de ${budget}) para procesar los flujos de integración. Durante la fase de Kickoff, estructuraremos las APIs, Webhooks y credenciales de entorno necesarias para la automatización.${extraBulletsText}

Enviamos a continuación los requerimientos para el Kickoff:
1. Definición de endpoints y payloads de datos.
2. Accesos a entornos de staging/producción.

Quedamos a la espera de tu confirmación para agendar el despliegue inicial.

Saludos cordiales,

El equipo de toroia.vip
Arquitectura de Integraciones y Sistemas`
      };
    } else {
      // Tono: cercano (por defecto)
      return {
        subject: `¡Te damos la bienvenida a toroia.vip, ${name}! – Empezamos tu proyecto`,
        body: `Hola ${name},

Espero que estés genial.

Te escribo para darte una calurosa bienvenida a toroia.vip. Estamos encantados de comenzar con el proyecto de "${services}" para ${company}.

Ya hemos abierto tu carpeta de planificación interna para estructurar y automatizar tus flujos lo antes posible. La inversión asignada para este proyecto es de ${budget}.${extraBulletsText}

En breves minutos te llegará un enlace para que elijas el mejor momento y tengamos nuestra sesión de kickoff de 20 minutos para alinear los accesos y arrancar.

¡Cualquier duda, escríbenos directamente por aquí!

Un saludo cordial,

El equipo de toroia.vip
Consultoría Digital y Automatización`
      };
    }
  }

  if (type === 'seguimiento') {
    if (tone === 'formal') {
      return {
        subject: `Seguimiento de propuesta comercial de consultoría – toroia.vip`,
        body: `Estimado/a ${name},

Espero que se encuentre muy bien.

Me pongo en contacto con usted para realizar el seguimiento de la propuesta para el proyecto de "${services}" enviada recientemente para ${company}.

Agradeceríamos saber si ha tenido la oportunidad de evaluar los términos y si requiere alguna aclaración técnica sobre el plan de automatización de procesos planteado.${extraBulletsText}

Quedamos a su entera disposición para coordinar una llamada de aclaración de 10 minutos si lo considera oportuno.

Atentamente,

El equipo de toroia.vip
Consultoría Digital y Automatización`
      };
    } else if (tone === 'persuasivo') {
      return {
        subject: `¿Listo para ahorrar tiempo y automatizar ${company}? ⏳`,
        body: `Hola ${name},

Espero que estés teniendo una gran semana.

Te escribo porque no queremos que ${company} siga perdiendo tiempo en tareas manuales y repetitivas que podríamos automatizar con el proyecto de "${services}".

Con la integración que te propusimos, tu equipo podría delegar procesos completos y ahorrar hasta un 40% del tiempo operativo. Estamos listos para arrancar con el desarrollo y entregarte los primeros prototipos en menos de dos semanas.${extraBulletsText}

¿Hacemos una llamada rápida de 10 minutos mañana para cerrar los últimos detalles y darle luz verde?

¡Un saludo!

El equipo de toroia.vip
Consultoría Digital y Automatización`
      };
    } else if (tone === 'tecnico') {
      return {
        subject: `Status check: Viabilidad técnica de propuesta "${services}"`,
        body: `Hola ${name},

Realizamos un seguimiento técnico a la propuesta de "${services}" diseñada para ${company}.

Hemos validado preliminarmente los esquemas de integración. Nos gustaría confirmar si vuestro equipo técnico ha revisado el diagrama de flujo y las especificaciones que compartimos.${extraBulletsText}

Podemos agendar una llamada de 10 minutos enfocada únicamente en resolver dudas de APIs, accesos u optimización del modelo de datos para poder proceder con la calendarización del sprint.

Saludos cordiales,

El equipo de toroia.vip
Arquitectura de Integraciones`
      };
    } else {
      // Tono: cercano
      return {
        subject: `Seguimiento de la propuesta de toroia.vip – ¿Dudas con ${services}?`,
        body: `Hola ${name},

Espero que vaya todo muy bien.

Te escribo rápidamente para saber si has tenido oportunidad de echarle un vistazo a la propuesta de "${services}" que preparamos para ${company}.

Si tienes cualquier duda técnica o quieres retocar alguna de las fases de automatización que propusimos, dímelo y lo adaptamos enseguida.${extraBulletsText}

¿Te apetece que tengamos una llamada rápida de 10 minutos esta semana para resolver dudas y ver si empezamos?

¡Un saludo!

El equipo de toroia.vip
Consultoría Digital y Automatización`
      };
    }
  }

  if (type === 'upsell') {
    if (tone === 'formal') {
      return {
        subject: `Propuesta de optimización tecnológica adicional para ${company}`,
        body: `Estimado/a ${name},

Espero que se encuentre muy bien.

Durante la fase de análisis del proyecto de "${services}", nuestro equipo de consultores ha detectado un área de oportunidad adicional en los flujos de ${company}.

Consideramos que implementando un asistente o conector de IA en vuestra base de datos, se podría acelerar la respuesta interna hasta en un 50%.${extraBulletsText}

Estaremos encantados de remitirle una propuesta complementaria detallada en caso de que sea de su interés.

Atentamente,

El equipo de toroia.vip
Consultoría Digital y Automatización`
      };
    } else if (tone === 'persuasivo') {
      return {
        subject: `Multiplica por 2 la velocidad de tus procesos en ${company} 🚀`,
        body: `Hola ${name},

Espero que todo marche sobre ruedas.

Mientras estructuramos el proyecto de "${services}", hemos visto una mina de oro sin explotar en ${company}: vuestra gestión de datos diarios.

Al integrar un flujo automatizado con IA para clasificar y responder información clave, tu equipo podría duplicar su velocidad de gestión con cero esfuerzo extra.${extraBulletsText}

Hemos preparado un pequeño mockup interactivo. ¿Te gustaría que te lo enseñemos en una llamada express de 5 minutos la próxima semana?

¡Quedo a tu disposición!

El equipo de toroia.vip
Consultoría Digital y Automatización`
      };
    } else if (tone === 'tecnico') {
      return {
        subject: `Oportunidad técnica: Automatización con LLM & Webhooks en ${company}`,
        body: `Hola ${name},

Analizando los flujos de entrada del proyecto de "${services}", identificamos un cuello de botella en el procesamiento de inputs no estructurados en ${company}.

Proponemos añadir un microservicio con una API de LLM intermedia para clasificar tokens semánticos en vuestros webhooks entrantes antes del guardado en DB. Esto reduciría la tasa de error al 0.05%.${extraBulletsText}

Podemos integrar esto en el pipeline de desarrollo actual como un sprint complementario. Avísanos si deseas revisar la especificación técnica.

Saludos cordiales,

El equipo de toroia.vip
Arquitectura de Integraciones`
      };
    } else {
      // Tono: cercano
      return {
        subject: `Idea de automatización extra para ${company} – ¿Hacemos una demo?`,
        body: `Hola ${name},

Espero que todo vaya genial por allí.

Dándole vueltas a tu proyecto de "${services}", hemos visto que hay otro proceso en ${company} que se beneficiaría muchísimo de una automatización rápida.

Se trata de incorporar un flujo con IA para ahorraros las tareas más aburridas del día a día.${extraBulletsText}

Si te parece buena idea, podemos montarte una pequeña demo rápida sin compromiso la semana que viene para que veas cómo funcionaría.

¡Un saludo!

El equipo de toroia.vip
Consultoría Digital y Automatización`
      };
    }
  }

  // Fallback
  return {
    subject: 'Email personalizado – toroia.vip',
    body: `Hola ${name},`
  };
}
