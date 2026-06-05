const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'saves.json');

app.use(express.json());
app.use(express.static(path.join(__dirname)));

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

app.post('/save', (req, res) => {
  const body = req.body;
  const now = Date.now();
  const db = readDB();

  const record = {
    updatedAt:    now,
    px:           body.px           ?? 0,
    py:           body.py           ?? 0,
    angle:        body.angle        ?? 0,
    foundWords:   body.foundWords   ?? [],
    selWords:     body.selWords     ?? [],
    sentenceDone: body.sentenceDone ?? false,
    finalChoice:  body.finalChoice  ?? null,
    scaresFired:  body.scaresFired  ?? [],
  };

  if (body.saveId) {
    if (!db[body.saveId]) {
      return res.status(404).json({ error: 'Save not found' });
    }
    db[body.saveId] = { ...db[body.saveId], ...record };
    writeDB(db);
    return res.json({ saveId: body.saveId });
  }

  const saveId = uuidv4();
  db[saveId] = { ...record, saveId, createdAt: now };
  writeDB(db);
  return res.status(201).json({ saveId });
});

app.get('/load/:saveId', (req, res) => {
  const db = readDB();
  const record = db[req.params.saveId];
  if (!record) return res.status(404).json({ error: 'Save not found' });
  res.json(record);
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const { execSync } = require('child_process');

function killPort(port) {
  try {
    execSync(
      `powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"`,
      { stdio: 'pipe' }
    );
  } catch (_) {}
}

const server = app.listen(PORT, () => {
  console.log(`HOMEBOUND backend → http://localhost:${PORT}`);
  console.log(`Saves stored in: ${DB_FILE}`);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} busy — killing existing process and retrying...`);
    killPort(PORT);
    setTimeout(() => {
      server.listen(PORT, () => {
        console.log(`HOMEBOUND backend → http://localhost:${PORT}`);
        console.log(`Saves stored in: ${DB_FILE}`);
      });
    }, 600);
  } else {
    throw err;
  }
});