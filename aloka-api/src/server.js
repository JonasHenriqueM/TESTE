import express from 'express';
import cors from 'cors';
import { pool } from './db.js';

import clientesRoutes from './routes/clientes.js';
import espacosRoutes from './routes/espacos.js';
import equipamentosRoutes from './routes/equipamentos.js';
import reservasRoutes from './routes/reservas.js';
import faturasRoutes from './routes/faturas.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'API ALOKA online!' });
});

app.use('/clientes', clientesRoutes);
app.use('/espacos', espacosRoutes);
app.use('/equipamentos', equipamentosRoutes);
app.use('/reservas', reservasRoutes);
app.use('/faturas', faturasRoutes);

app.get('/funcionarios', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM funcionario ORDER BY id_funcionario');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ENTREGAS (Somente reservas sem espaço alocado)
app.get('/entregas', async (req, res) => {
  try {
    const query = `
      SELECT 
        ent.id_entrega,
        ent.id_reserva, 
        ent.data, 
        ent.horario,
        ent.tipoentrega,
        COALESCE(ent.enderecoentrega, r.enderecoevento, c.endereco) AS enderecoentrega,
        c.nome AS cliente_nome, 
        eq.nomeequipamento AS equipamento_nome,
        f.nomefuncionario AS funcionario_nome
      FROM entrega ent
      INNER JOIN reserva r ON ent.id_reserva = r.id_reserva
      INNER JOIN cliente c ON r.id_cliente = c.id_cliente
      INNER JOIN equipamento eq ON ent.id_equipamento = eq.id_equipamento
      INNER JOIN funcionario f ON ent.id_funcionario = f.id_funcionario
      WHERE r.id_espaco IS NULL
      ORDER BY ent.data DESC, ent.horario DESC;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/entregas', async (req, res) => {
  const { id_reserva, id_funcionario, id_equipamento, data, horario, enderecoentrega } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO entrega (id_reserva, id_funcionario, id_equipamento, data, horario, enderecoentrega) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id_reserva, id_funcionario, id_equipamento, data, horario, enderecoentrega || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.detail || err.message });
  }
});

// MONTAGENS (Relacionamento Ternário: reservas com espaço alocado + equipamentos)
app.get('/montagens', async (req, res) => {
  try {
    const query = `
      SELECT 
        m.id_reserva,
        r.datareserva,
        c.nome AS cliente_nome,
        e.nomeespaco AS local_nome,
        m.id_equipamento,
        eq.nomeequipamento AS equipamento_nome,
        m.id_funcionario,
        f.nomefuncionario AS funcionario_nome,
        f.cargo AS funcionario_cargo
      FROM montagem m
      INNER JOIN reserva r ON m.id_reserva = r.id_reserva
      INNER JOIN cliente c ON r.id_cliente = c.id_cliente
      INNER JOIN espaco e ON r.id_espaco = e.id_espaco
      INNER JOIN equipamento eq ON m.id_equipamento = eq.id_equipamento
      INNER JOIN funcionario f ON m.id_funcionario = f.id_funcionario
      ORDER BY r.datareserva DESC, m.id_reserva DESC;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/montagens', async (req, res) => {
  const { id_reserva, id_equipamento, id_funcionario } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO montagem (id_reserva, id_equipamento, id_funcionario) 
       VALUES ($1, $2, $3) RETURNING *`,
      [id_reserva, id_equipamento, id_funcionario]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.detail || err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor ALOKA rodando em http://localhost:${PORT}`);
});