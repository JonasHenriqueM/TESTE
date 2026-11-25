import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// GET /equipamentos - Lista todos os equipamentos ou filtra por substring via ?busca=
router.get('/', async (req, res) => {
  const { busca } = req.query;

  try {
    if (busca && busca.trim() !== '') {
      const termo = `%${busca.trim()}%`;
      const { rows } = await pool.query(
        `SELECT *, observacao AS observacoes, observacao AS descricao
         FROM equipamento
         WHERE nomeequipamento ILIKE $1
            OR marca ILIKE $1
            OR numeropatrimonio ILIKE $1
         ORDER BY id_equipamento DESC`,
        [termo]
      );
      return res.json(rows);
    }

    const { rows } = await pool.query(
      'SELECT *, observacao AS observacoes, observacao AS descricao FROM equipamento ORDER BY id_equipamento DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /equipamentos/:id - Consulta específica de um equipamento pelo ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT *, observacao AS observacoes, observacao AS descricao FROM equipamento WHERE id_equipamento = $1',
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Equipamento não encontrado.' });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /equipamentos - Cadastra um novo equipamento
router.post('/', async (req, res) => {
  const nome = req.body.nomeEquipamento ?? req.body.nomeequipamento ?? req.body.nome;
  const patrimonio = req.body.numeroPatrimonio ?? req.body.numeropatrimonio;
  const quantidade = Number(req.body.quantidade);
  const marca = req.body.marca || null;
  const observacao = (req.body.observacoes ?? req.body.observacao ?? req.body.descricao) || null;
  const valorBruto = req.body.valorEquipamento ?? req.body.valorequipamento ?? req.body.valor;
  const valorEquipamento =
    valorBruto !== undefined && valorBruto !== null && valorBruto !== ''
      ? Number(valorBruto)
      : null;

  try {
    const { rows } = await pool.query(
      `INSERT INTO equipamento 
        (nomeequipamento, numeropatrimonio, quantidade, marca, observacao, valorequipamento)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *, observacao AS observacoes, observacao AS descricao`,
      [nome, patrimonio, quantidade, marca, observacao, valorEquipamento]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Já existe um equipamento com este número de patrimônio.' });
    }
    res.status(400).json({ error: err.detail || err.message });
  }
});

// PUT /equipamentos/:id - Atualiza um equipamento existente
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const nome = req.body.nomeEquipamento ?? req.body.nomeequipamento ?? req.body.nome;
  const patrimonio = req.body.numeroPatrimonio ?? req.body.numeropatrimonio;
  const quantidade = Number(req.body.quantidade);
  const marca = req.body.marca || null;
  const observacao = (req.body.observacoes ?? req.body.observacao ?? req.body.descricao) || null;
  const valorBruto = req.body.valorEquipamento ?? req.body.valorequipamento ?? req.body.valor;
  const valorEquipamento =
    valorBruto !== undefined && valorBruto !== null && valorBruto !== ''
      ? Number(valorBruto)
      : null;

  try {
    const { rows } = await pool.query(
      `UPDATE equipamento
       SET nomeequipamento = $1,
           numeropatrimonio = $2,
           quantidade = $3,
           marca = $4,
           observacao = $5,
           valorequipamento = $6
       WHERE id_equipamento = $7
       RETURNING *, observacao AS observacoes, observacao AS descricao`,
      [nome, patrimonio, quantidade, marca, observacao, valorEquipamento, id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Equipamento não encontrado.' });
    }
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Já existe um equipamento com este número de patrimônio.' });
    }
    res.status(400).json({ error: err.detail || err.message });
  }
});

// DELETE /equipamentos/:id - Exclui um equipamento
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM equipamento WHERE id_equipamento = $1',
      [id]
    );

    if (!rowCount) {
      return res.status(404).json({ error: 'Equipamento não encontrado.' });
    }
    res.json({ message: 'Equipamento excluído com sucesso.' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({
        error: 'Não é possível excluir este equipamento porque ele está vinculado a uma ou mais reservas.'
      });
    }
    res.status(400).json({ error: err.detail || err.message });
  }
});

export default router;