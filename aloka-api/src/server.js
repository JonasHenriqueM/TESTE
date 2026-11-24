import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

import clientesRoutes from './routes/clientes.js';
import espacosRoutes from './routes/espacos.js';
import equipamentosRoutes from './routes/equipamentos.js';
import reservasRoutes from './routes/reservas.js';
import faturasRoutes from './routes/faturas.js';

const app = express();
app.use(cors());
app.use(express.json());

// Rota pública de status
app.get('/', (req, res) => {
  res.json({ status: 'API ALOKA online!' });
});

// Rota pública de login
app.post('/login', (req, res) => {
  const { usuario, senha } = req.body;

  if (usuario === process.env.ADMIN_USER && senha === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ usuario }, process.env.JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token });
  }

  return res.status(401).json({ error: 'Usuário ou senha inválidos' });
});

// Middleware de proteção JWT
function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido ou expirado' });
    }
    req.usuario = decoded;
    next();
  });
}

// A partir desta linha, TODAS as rotas abaixo exigem token válido
app.use(autenticarToken);

app.use('/clientes', clientesRoutes);
app.use('/espacos', espacosRoutes);
app.use('/equipamentos', equipamentosRoutes);
app.use('/reservas', reservasRoutes);
app.use('/faturas', faturasRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor ALOKA rodando em http://localhost:${PORT}`);
});