import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS Headers para permitir que tu app de GitHub Pages hable con esta API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const lights = await kv.get('domo_schedulesLights') || [];
    const shutters = await kv.get('domo_schedulesShutters') || [];
    res.status(200).json({ lights, shutters });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al leer de KV' });
  }
}
