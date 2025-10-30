import { kv } from '@vercel/kv';

// --- Definiciones (Asegúrate de que DUCKDNS_HOST es correcto) ---
// ⚠️ ¡Verifica que esta es tu URL de DuckDNS!
const DUCKDNS_HOST = "pabloalex123.duckdns.org"; 
const PORTS = {1:8282, 2:8181};
const SEND_DELAY_MS = 750; // Delay entre comandos (aunque aquí no se usa directamente)

// --- Funciones de envío (adaptadas de execute.js) ---
function urlFor({host, board, relay, value}){
  // Usa el host que le pasemos (IP local o DuckDNS), o el DuckDNS por defecto si no se pasa
  const targetHost = host || DUCKDNS_HOST; 
  return `http://${targetHost}:${PORTS[board]}/pwr/relays/${relay}?ac=123456&value=${value}`;
}

async function sendRelay(params){
  const url = urlFor(params);
  console.log(`HTTP GET (manual): ${url}`);
  try { 
    // Intenta enviar la orden con un timeout de 5 segundos
    await fetch(url, { signal: AbortSignal.timeout(5000) }); 
  } catch(e) { 
    console.error(`Error al lanzar URL (manual): ${e.message}`); 
    // Puedes añadir aquí un reintento si quieres, pero por ahora solo registra el error
  }
  // No esperamos el delay aquí; la app cliente ya espera entre llamadas
}

// --- El Manejador de la API ---
export default async function handler(req, res) {
  // Configuración de CORS para permitir peticiones desde tu app de GitHub Pages
  res.setHeader('Access-Control-Allow-Origin', '*'); // Permite cualquier origen (puedes restringirlo a tu URL de GitHub Pages si quieres más seguridad)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // Permite métodos POST y OPTIONS (necesario para preflight)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Permite el header Content-Type

  // Responde OK a las peticiones OPTIONS (preflight de CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Solo permite el método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Espera recibir un cuerpo JSON como: { host, board, relay, value }
    const params = req.body;
    
    // Validar parámetros básicos (puedes añadir más validaciones si quieres)
    if (params && typeof params.board !== 'undefined' && typeof params.relay !== 'undefined' && typeof params.value !== 'undefined') {
      // Enviamos la orden al relé
      await sendRelay(params);
      res.status(200).json({ success: true });
    } else {
      res.status(400).json({ error: 'Parámetros inválidos en la petición' });
    }
    
  } catch (error) {
    console.error('Error procesando /api/manual:', error);
    res.status(500).json({ error: 'Error interno al procesar la orden manual' });
  }
}
