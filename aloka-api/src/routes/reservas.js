import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// GET /reservas - Lista todas as reservas com espaço, itens de ITEMRESERVA e soma total
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id_reserva,
        r.id_cliente,
        c.nome AS cliente_nome,
        r.id_espaco,
        e.nomeespaco AS espaco_nome,
        COALESCE(e.valorespaco, 0.00) AS valorespaco,
        r.enderecoevento,
        r.datareserva,
        r.horainicio,
        r.horafim,
        r.statusreserva,
        COALESCE(
          STRING_AGG(eq.nomeequipamento || ' (' || ir.quantidadealugada || 'x)', ', '),
          '-'
        ) AS equipamentos_nome,
        COALESCE(SUM(ir.quantidadealugada * ir.valorunitario), 0.00) AS valorequipamentos,
        (COALESCE(e.valorespaco, 0.00) + COALESCE(SUM(ir.quantidadealugada * ir.valorunitario), 0.00)) AS valortotal
      FROM reserva r
      INNER JOIN cliente c ON r.id_cliente = c.id_cliente
      LEFT JOIN espaco e ON r.id_espaco = e.id_espaco
      LEFT JOIN itemreserva ir ON r.id_reserva = ir.id_reserva
      LEFT JOIN equipamento eq ON ir.id_equipamento = eq.id_equipamento
      GROUP BY 
        r.id_reserva, r.id_cliente, c.nome, 
        r.id_espaco, e.nomeespaco, e.valorespaco,
        r.enderecoevento, r.datareserva, r.horainicio, r.horafim, r.statusreserva
      ORDER BY r.id_reserva DESC;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /reservas - Cria reserva (híbrida) e vincula equipamento em ITEMRESERVA se informado
router.post('/', async (req, res) => {
  const {
    id_cliente,
    id_espaco,
    enderecoevento,
    id_equipamento,
    quantidade_equipamento,
    data,
    hora_inicio,
    hora_fim,
    statusreserva
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const resInsert = await client.query(
      `INSERT INTO reserva (id_cliente, id_espaco, enderecoevento, horainicio, horafim, statusreserva, datareserva)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id_cliente,
        id_espaco || null,
        enderecoevento || null,
        hora_inicio,
        hora_fim,
        statusreserva || 'PENDENTE',
        data
      ]
    );
    const novaReserva = resInsert.rows[0];

    if (id_equipamento) {
      const qtd = Number(quantidade_equipamento) || 1;
      const eqRes = await client.query(
        'SELECT valorequipamento FROM equipamento WHERE id_equipamento = $1',
        [id_equipamento]
      );

      if (eqRes.rows.length === 0) {
        throw new Error('Equipamento informado não encontrado.');
      }

      const valorUnitario = eqRes.rows[0].valorequipamento || 0;

      await client.query(
        `INSERT INTO itemreserva (id_reserva, id_equipamento, quantidadealugada, valorunitario)
         VALUES ($1, $2, $3, $4)`,
        [novaReserva.id_reserva, id_equipamento, qtd, valorUnitario]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(novaReserva);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.detail || err.message });
  } finally {
    client.release();
  }
});

// PUT /reservas/:id - Atualiza dados e status da reserva
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { id_cliente, id_espaco, data, hora_inicio, hora_fim, statusreserva, enderecoevento } = req.body;
  try {
    const query = `
      UPDATE reserva 
      SET id_cliente = $1,
          id_espaco = $2,
          datareserva = $3,
          horainicio = $4,
          horafim = $5,
          statusreserva = COALESCE($6, statusreserva),
          enderecoevento = $7
      WHERE id_reserva = $8
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [
      id_cliente,
      id_espaco || null,
      data,
      hora_inicio,
      hora_fim,
      statusreserva || null,
      enderecoevento || null,
      id
    ]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.detail || err.message });
  }
});

// PATCH /reservas/:id/status - Atualiza o status da reserva
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE RESERVA SET StatusReserva = $1 WHERE ID_RESERVA = $2 RETURNING *',
      [status, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Reserva não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.detail || err.message });
  }
});

// DELETE /reservas/:id - Exclui a reserva e seus vínculos dependentes
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM montagem WHERE id_reserva = $1', [id]);
    await client.query('DELETE FROM entrega WHERE id_reserva = $1', [id]);
    await client.query('DELETE FROM fatura WHERE id_reserva = $1', [id]);
    await client.query('DELETE FROM itemreserva WHERE id_reserva = $1', [id]);
    const { rowCount } = await client.query('DELETE FROM reserva WHERE id_reserva = $1', [id]);
    await client.query('COMMIT');

    if (!rowCount) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }
    res.json({ message: 'Reserva excluída com sucesso.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.detail || err.message });
  } finally {
    client.release();
  }
});

export default router;