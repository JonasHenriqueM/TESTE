import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// LISTAR FUNCIONÁRIOS
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM funcionario ORDER BY id_funcionario');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CRIAR FUNCIONÁRIO (POST /funcionarios)
router.post('/', async (req, res) => {
  const nome = req.body.nomefuncionario || req.body.nome;
  const { cargo, turno, contato } = req.body;

  if (!nome || !cargo || !turno) {
    return res.status(400).json({ error: 'Nome, cargo e turno são obrigatórios.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO funcionario (nomefuncionario, cargo, turno, contato) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nome, cargo, turno.toUpperCase(), contato || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.detail || err.message });
  }
});

// EDITAR FUNCIONÁRIO (PUT /funcionarios/:id)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const nome = req.body.nomefuncionario || req.body.nome;
  const { cargo, turno, contato } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE funcionario 
       SET 
         nomefuncionario = $1, 
         cargo = $2, 
         turno = COALESCE(NULLIF($3, ''), turno), 
         contato = $4
       WHERE id_funcionario = $5
       RETURNING *`,
      [nome, cargo, turno ? turno.toUpperCase() : '', contato || null, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.detail || err.message });
  }
});

// EXCLUIR FUNCIONÁRIO
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'DELETE FROM funcionario WHERE id_funcionario = $1 RETURNING *',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Funcionário não encontrado.' });
    }

    res.json({ message: 'Funcionário excluído com sucesso.', funcionario: rows[0] });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({
        error: 'Não é possível excluir este funcionário pois ele está vinculado a entregas ou montagens.'
      });
    }
    res.status(400).json({ error: err.detail || err.message });
  }
});

export default router;