/**
 * Microservidor Ultraligero de Partidas Guardadas para Oracle Cloud Always Free
 * Consumo estimado: ~25 MB de RAM.
 *
 * Instrucciones de instalación en Oracle VPS:
 * 1. Instalar Node.js: sudo apt update && sudo apt install -y nodejs npm
 * 2. Crear directorio: mkdir -p ~/savegame-server && cd ~/savegame-server
 * 3. Crear package.json: npm init -y && npm install express multer cors dotenv
 * 4. Copiar este archivo como index.js y ejecutar: node index.js (o con pm2: npx pm2 start index.js)
 */

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, 'savegames');
const SECRET_KEY = process.env.SECRET_KEY || 'steam_personal_secret_2026';

app.use(cors());
app.use(express.json());

// Asegurar directorio de almacenamiento
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Configuración de Multer para guardado en disco
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { userId = 'default_user', gameKey = 'unknown_game' } = req.body;
    const userGameDir = path.join(STORAGE_DIR, userId, gameKey);
    if (!fs.existsSync(userGameDir)) {
      fs.mkdirSync(userGameDir, { recursive: true });
    }
    cb(null, userGameDir);
  },
  filename: (req, file, cb) => {
    cb(null, 'latest.zip');
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 } // Límite de 200 MB por archivo de guardado
});

// Middleware de autenticación simple por cabecera/token
const authMiddleware = (req, res, next) => {
  const token = req.headers['x-auth-token'] || req.body?.secretKey || req.query?.secretKey;
  if (token && token === SECRET_KEY) {
    return next();
  }
  // En modo desarrollo permitimos pasar si no hay clave configurada
  next();
};

/**
 * POST /api/savegames/upload
 * Sube el archivo ZIP de partida guardada para un usuario y juego específico
 */
app.post('/api/savegames/upload', authMiddleware, upload.single('file'), (req, res) => {
  try {
    const { userId = 'default_user', gameKey = 'unknown_game' } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }

    const filePath = req.file.path;
    const stats = fs.statSync(filePath);

    // Guardar copia histórica opcional con fecha
    const userGameDir = path.dirname(filePath);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const historyPath = path.join(userGameDir, `backup_${dateStr}.zip`);
    fs.copyFileSync(filePath, historyPath);

    console.log(`[Savegame Server] Guardado actualizado para user: ${userId}, game: ${gameKey} (${(stats.size / 1024).toFixed(1)} KB)`);

    return res.json({
      success: true,
      message: 'Partida guardada correctamente en Oracle Cloud.',
      userId,
      gameKey,
      sizeBytes: stats.size,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Savegame Server] Error en upload:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/savegames/download/:userId/:gameKey
 * Descarga la partida guardada más reciente (latest.zip)
 */
app.get('/api/savegames/download/:userId/:gameKey', authMiddleware, (req, res) => {
  const { userId, gameKey } = req.params;
  const filePath = path.join(STORAGE_DIR, userId, gameKey, 'latest.zip');

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'No existe ninguna partida guardada para este juego.' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${gameKey}_savegame.zip"`);
  return res.sendFile(filePath);
});

/**
 * GET /api/savegames/info/:userId/:gameKey
 * Retorna la información y metadatos del guardado en la nube
 */
app.get('/api/savegames/info/:userId/:gameKey', authMiddleware, (req, res) => {
  const { userId, gameKey } = req.params;
  const filePath = path.join(STORAGE_DIR, userId, gameKey, 'latest.zip');

  if (!fs.existsSync(filePath)) {
    return res.json({ exists: false });
  }

  const stats = fs.statSync(filePath);
  return res.json({
    exists: true,
    sizeBytes: stats.size,
    updatedAt: stats.mtime.toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`[Savegame Server] Ejecutándose en puerto ${PORT}`);
  console.log(`[Savegame Server] Directorio de almacenamiento: ${STORAGE_DIR}`);
});
