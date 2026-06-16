import express from 'express';
import { config } from 'dotenv';

config();

const router = express.Router();

const GEMINI_KEYS = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ─── Tools expuestas al modelo (proxean al servidor MCP-Solarys) ──────────────
const TOOLS = [
  {
    function_declarations: [
      {
        name: 'get_solaris_schema',
        description:
          'Obtiene el esquema completo de la base de datos de Solaris: todas las tablas públicas, sus columnas y tipos de datos. Úsalo antes de escribir cualquier consulta SQL para conocer la estructura exacta.',
        parameters: { type: 'OBJECT', properties: {}, required: [] },
      },
      {
        name: 'run_solaris_query',
        description:
          'Ejecuta una consulta SQL de SOLO LECTURA (SELECT / WITH / EXPLAIN) sobre la base de datos de Solaris. Los resultados están filtrados automáticamente por Row Level Security, por lo que solo verás datos de tus propios negocios (hoteles, gimnasios, restaurantes). NO uses INSERT, UPDATE, DELETE ni DDL.',
        parameters: {
          type: 'OBJECT',
          properties: {
            sql_query: {
              type: 'STRING',
              description:
                'Consulta SQL válida de solo lectura. Ejemplo: SELECT id_gimnasio, nombre_gimnasio FROM public.gimnasios LIMIT 10',
            },
          },
          required: ['sql_query'],
        },
      },
    ],
  },
];

const SYSTEM_INSTRUCTION = `Eres "Solaris", el copiloto de negocios del propietario. No eres un chatbot genérico: tienes personalidad, criterio y opinión propia. Tu trabajo es ayudarlo a entender y hacer crecer sus negocios (hoteles, gimnasios, restaurantes) con datos reales de la plataforma Solaris.

PERSONALIDAD:
- Habla como un analista de confianza y no como un robot de soporte: directo, seguro, sin rodeos, sin disculpas innecesarias ni relleno tipo "¡claro, aquí tienes!".
- No te limites a entregar números fríos: cuando los datos lo permitan, añade una lectura breve (una tendencia, una alerta, algo que destaca) además de responder lo que se preguntó.
- Si algo en los datos es preocupante, raro o muy bueno, dilo abiertamente — con criterio, no en automático.
- Tono cálido pero firme, con chispa ocasional (el nombre "Solaris" da para algún guiño solar de vez en cuando, sin forzarlo ni abusar de emojis).
- Sé conciso, pero con carácter: ve al grano sin sonar seco.

REGLAS ABSOLUTAS:
1. SIEMPRE usa las herramientas para obtener datos reales. NUNCA inventes IDs, nombres, cifras ni fechas.
2. Antes de escribir una consulta SQL sobre una tabla que no conozcas bien, llama a get_solaris_schema para confirmar nombres exactos de tablas y columnas.
3. Usa run_solaris_query con SELECT/WITH de solo lectura. Las consultas ya están filtradas por Row Level Security: solo verás los negocios del propietario autenticado.
4. Si una herramienta devuelve un error, repórtalo tal cual, no inventes el resultado.
5. Responde siempre en español, usando markdown (tablas, negritas, listas) cuando ayude a leer los datos.
6. Si el usuario pregunta algo general sobre "mis negocios", primero identifica qué tipos de negocio tiene (hotel, gym, restaurant) consultando business_modules.
7. NUNCA anuncies que vas a consultar algo y te quedes ahí (ej. "dame un momento", "voy a calcularlo"). Si necesitas datos, llama a la herramienta correspondiente EN ESE MISMO TURNO, en la misma respuesta — nunca en un turno separado sin acción.`;

// ─── Llamada al servidor MCP-Solarys con el token personal del usuario ───────
async function mcpRequest(mcpUrl: string, mcpToken: string, path: string, init: any = {}): Promise<any> {
  const res = await fetch(`${mcpUrl.replace(/\/+$/, '')}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mcpToken}`,
      ...(init.headers || {}),
    },
  });
  const data: any = await res.json();
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || `MCP error (${res.status})`);
  }
  return data;
}

async function executeTool(name: string, args: any, mcpUrl: string, mcpToken: string): Promise<any> {
  switch (name) {
    case 'get_solaris_schema':
      return mcpRequest(mcpUrl, mcpToken, '/tools/get_solaris_schema');
    case 'run_solaris_query':
      return mcpRequest(mcpUrl, mcpToken, '/tools/run_solaris_query', {
        method: 'POST',
        body: JSON.stringify({ sql_query: args?.sql_query }),
      });
    default:
      return { error: `Herramienta '${name}' no reconocida.` };
  }
}

// ─── Llamada a Gemini, rotando entre las API keys configuradas ───────────────
async function callGemini(contents: any[]): Promise<any> {
  let lastError: any;
  for (const key of GEMINI_KEYS) {
    try {
      const response = await fetch(`${GEMINI_URL}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents,
          tools: TOOLS,
          generationConfig: { temperature: 0.65, maxOutputTokens: 2048 },
        }),
      });
      if (response.ok) return await response.json();
      lastError = new Error(`Gemini ${response.status}: ${await response.text()}`);
    } catch (err: any) {
      lastError = err;
    }
  }
  throw lastError || new Error('Todas las API keys de Gemini fallaron.');
}

// ─── Endpoint ─────────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    if (!GEMINI_KEYS.length) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada.' });

    const { prompt, history = [], mcpUrl, mcpToken } = req.body;
    if (!prompt || !mcpUrl || !mcpToken) {
      return res.status(400).json({ error: 'prompt, mcpUrl y mcpToken son requeridos.' });
    }

    const contents: any[] = (history as { role: string; text: string }[])
      .filter(h => h.text?.trim())
      .map(h => ({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: h.text }] }));
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const toolsUsed: string[] = [];
    let maxIter = 8;
    let nudged = false;

    while (maxIter-- > 0) {
      const data = await callGemini(contents);
      const candidate = data.candidates?.[0];

      if (!candidate) {
        return res.json({ reply: 'No se pudo obtener respuesta del modelo.', toolsUsed });
      }

      const parts = candidate.content?.parts || [];
      const functionCalls = parts.filter((p: any) => p.functionCall);
      const textParts = parts.filter((p: any) => p.text);

      if (functionCalls.length === 0) {
        const reply = textParts.map((p: any) => p.text).join('').trim();

        if (!reply && !nudged) {
          nudged = true;
          contents.push({
            role: 'user',
            parts: [{
              text: 'Continúa ahora mismo: ejecuta las herramientas que necesites y entrega la respuesta completa, sin anunciar pasos intermedios.',
            }],
          });
          continue;
        }

        return res.json({ reply: reply || '(Sin respuesta de texto)', toolsUsed });
      }

      contents.push({ role: 'model', parts });

      const functionResponses: any[] = [];
      for (const part of functionCalls) {
        const { name, args } = part.functionCall;
        toolsUsed.push(name);
        let result: any;
        try {
          result = await executeTool(name, args || {}, mcpUrl, mcpToken);
        } catch (e: any) {
          result = { error: e.message };
        }
        functionResponses.push({ functionResponse: { name, response: result } });
      }

      contents.push({ role: 'user', parts: functionResponses });
    }

    return res.json({ reply: 'Se alcanzó el límite de iteraciones.', toolsUsed });
  } catch (err: any) {
    console.error('Solaris AI Chat Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
