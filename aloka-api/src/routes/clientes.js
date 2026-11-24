import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// GET /clientes - Lista todos os clientes (PF, PJ e telefones)
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        c.id_cliente, c.nome, c.email, c.endereco,
        pf.cpf, pf.rg,
        pj.cnpj, pj.razaosocial,
        CASE WHEN pf.id_cliente IS NOT NULL THEN 'PF' ELSE 'PJ' END AS tipo_cliente,
        COALESCE(array_agg(tc.numero_cliente) FILTER (WHERE tc.numero_cliente IS NOT NULL), '{}') AS telefones
      FROM CLIENTE c
      LEFT JOIN PESSOA_FISICA pf ON c.id_cliente = pf.id_cliente
      LEFT JOIN PESSOA_JURIDICA pj ON c.id_cliente = pj.id_cliente
      LEFT JOIN TELEFONE_CLIENTE tc ON c.id_cliente = tc.id_cliente
      GROUP BY c.id_cliente, pf.id_cliente, pf.cpf, pf.rg, pj.id_cliente, pj.cnpj, pj.razaosocial
      ORDER BY c.id_cliente DESC;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /clientes - Cadastra um novo cliente
router.post('/', async (req, res) => {
  const { nome, email, endereco, cpf, rg, cnpj, telefone, telefones } = req.body;
  const tipo = (req.body.tipo ?? req.body.tipo_cliente ?? '').toUpperCase();
  const razaoSocial = req.body.razaoSocial ?? req.body.razaosocial ?? null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const resCliente = await client.query(
      'INSERT INTO CLIENTE (Nome, Email, Endereco) VALUES ($1, $2, $3) RETURNING ID_CLIENTE',
      [nome, email, endereco]
    );
    const idCliente = resCliente.rows[0].id_cliente;

    if (tipo === 'PF') {
      await client.query(
        'INSERT INTO PESSOA_FISICA (ID_CLIENTE, CPF, RG) VALUES ($1, $2, $3)',
        [idCliente, cpf, rg || null]
      );
    } else if (tipo === 'PJ') {
      await client.query(
        'INSERT INTO PESSOA_JURIDICA (ID_CLIENTE, Cnpj, RazaoSocial) VALUES ($1, $2, $3)',
        [idCliente, cnpj, razaoSocial]
      );
    } else {
      throw new Error("Tipo de cliente inválido. Informe 'PF' ou 'PJ'.");
    }

    const listaTelefones = Array.isArray(telefones)
      ? telefones.filter(Boolean)
      : (telefone ? [telefone] : []);

    for (const num of listaTelefones) {
      await client.query(
        'INSERT INTO TELEFONE_CLIENTE (ID_CLIENTE, NUMERO_CLIENTE) VALUES ($1, $2)',
        [idCliente, num]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Cliente cadastrado com sucesso!', id_cliente: idCliente });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(400).json({ error: 'CPF, CNPJ ou e-mail já cadastrado para outro cliente.' });
    }
    res.status(400).json({ error: err.detail || err.message });
  } finally {
    client.release();
  }
});

// PUT /clientes/:id - Atualiza um cliente existente
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, email, endereco, cpf, rg, cnpj, telefone, telefones } = req.body;
  const tipo = (req.body.tipo ?? req.body.tipo_cliente ?? '').toUpperCase();
  const razaoSocial = req.body.razaoSocial ?? req.body.razaosocial ?? null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const resUpdate = await client.query(
      `UPDATE CLIENTE
       SET Nome = $1, Email = $2, Endereco = $3
       WHERE ID_CLIENTE = $4
       RETURNING *`,
      [nome, email, endereco, id]
    );

    if (!resUpdate.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    // Limpa registros anteriores de PF/PJ para permitir atualização ou troca de tipo
    await client.query('DELETE FROM PESSOA_FISICA WHERE ID_CLIENTE = $1', [id]);
    await client.query('DELETE FROM PESSOA_JURIDICA WHERE ID_CLIENTE = $1', [id]);

    if (tipo === 'PF') {
      await client.query(
        'INSERT INTO PESSOA_FISICA (ID_CLIENTE, CPF, RG) VALUES ($1, $2, $3)',
        [id, cpf, rg || null]
      );
    } else if (tipo === 'PJ') {
      await client.query(
        'INSERT INTO PESSOA_JURIDICA (ID_CLIENTE, Cnpj, RazaoSocial) VALUES ($1, $2, $3)',
        [id, cnpj, razaoSocial]
      );
    } else {
      throw new Error("Tipo de cliente inválido. Informe 'PF' ou 'PJ'.");
    }

    // Atualiza telefones vinculados
    await client.query('DELETE FROM TELEFONE_CLIENTE WHERE ID_CLIENTE = $1', [id]);

    const listaTelefones = Array.isArray(telefones)
      ? telefones.filter(Boolean)
      : (telefone ? [telefone] : []);

    for (const num of listaTelefones) {
      await client.query(
        'INSERT INTO TELEFONE_CLIENTE (ID_CLIENTE, NUMERO_CLIENTE) VALUES ($1, $2)',
        [id, num]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Cliente atualizado com sucesso!', cliente: resUpdate.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(400).json({ error: 'CPF, CNPJ ou e-mail já cadastrado para outro cliente.' });
    }
    res.status(400).json({ error: err.detail || err.message });
  } finally {
    client.release();
  }
});

// DELETE /clientes/:id - Exclui um cliente e seus dados auxiliares
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM TELEFONE_CLIENTE WHERE ID_CLIENTE = $1', [id]);
    await client.query('DELETE FROM PESSOA_FISICA WHERE ID_CLIENTE = $1', [id]);
    await client.query('DELETE FROM PESSOA_JURIDICA WHERE ID_CLIENTE = $1', [id]);

    const { rowCount } = await client.query('DELETE FROM CLIENTE WHERE ID_CLIENTE = $1', [id]);

    if (!rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    await client.query('COMMIT');
    res.json({ message: 'Cliente excluído com sucesso!' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23503') {
      return res.status(400).json({
        error: 'Não é possível excluir este cliente porque ele possui reservas vinculadas.'
      });
    }
    res.status(400).json({ error: err.detail || err.message });
  } finally {
    client.release();
  }
});

export default router;