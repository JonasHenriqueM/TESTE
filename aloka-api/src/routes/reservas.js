import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// GET /reservas - Lista todas as reservas com espaço, itens de ITEMRESERVA, soma total e status de entrega/montagem
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
        (COALESCE(e.valorespaco, 0.00) + COALESCE(SUM(ir.quantidadealugada * ir.valorunitario), 0.00)) AS valortotal,
        CASE 
          WHEN EXISTS (SELECT 1 FROM entrega ent WHERE ent.id_reserva = r.id_reserva)
            OR EXISTS (SELECT 1 FROM montagem m WHERE m.id_reserva = r.id_reserva)
          THEN 'Agendada'
          ELSE 'Não agendada'
        END AS status_entrega
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

// GET /reservas/:id - Consulta específica de uma reserva + lista de equipamentos vinculados
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const resReserva = await pool.query(
      `SELECT 
        r.*,
        c.nome AS cliente_nome,
        e.nomeespaco AS espaco_nome,
        COALESCE(e.valorespaco, 0.00) AS valorespaco
       FROM reserva r
       INNER JOIN cliente c ON r.id_cliente = c.id_cliente
       LEFT JOIN espaco e ON r.id_espaco = e.id_espaco
       WHERE r.id_reserva = $1`,
      [id]
    );

    if (resReserva.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }

    const resItens = await pool.query(
      `SELECT 
        ir.id_equipamento, 
        ir.quantidadealugada AS quantidade, 
        ir.valorunitario, 
        eq.nomeequipamento
       FROM itemreserva ir
       INNER JOIN equipamento eq ON ir.id_equipamento = eq.id_equipamento
       WHERE ir.id_reserva = $1`,
      [id]
    );

    res.json({
      ...resReserva.rows[0],
      itens_equipamentos: resItens.rows
    });
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
    equipamentos,
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

    // Suporta tanto o array 'equipamentos' quanto o envio único 'id_equipamento'
    const listaItens = Array.isArray(equipamentos) && equipamentos.length > 0
      ? equipamentos
      : (id_equipamento ? [{ id_equipamento, quantidade: quantidade_equipamento || 1 }] : []);

    for (const item of listaItens) {
      if (!item.id_equipamento) continue;
      const qtd = Number(item.quantidade) || 1;
      const eqRes = await client.query(
        'SELECT valorequipamento FROM equipamento WHERE id_equipamento = $1',
        [item.id_equipamento]
      );

      if (eqRes.rows.length === 0) {
        throw new Error('Equipamento informado não encontrado.');
      }

      const valorUnitario = eqRes.rows[0].valorequipamento || 0;

      await client.query(
        `INSERT INTO itemreserva (id_reserva, id_equipamento, quantidadealugada, valorunitario)
         VALUES ($1, $2, $3, $4)`,
        [novaReserva.id_reserva, item.id_equipamento, qtd, valorUnitario]
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

// PUT /reservas/:id - Atualiza dados, status e equipamentos da reserva
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    id_cliente,
    id_espaco,
    data,
    hora_inicio,
    hora_fim,
    statusreserva,
    enderecoevento,
    equipamentos
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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
    const { rows } = await client.query(query, [
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
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }

    if (Array.isArray(equipamentos)) {
      await client.query('DELETE FROM itemreserva WHERE id_reserva = $1', [id]);

      for (const item of equipamentos) {
        if (!item.id_equipamento) continue;
        const qtd = Number(item.quantidade) || 1;

        const eqRes = await client.query(
          'SELECT valorequipamento FROM equipamento WHERE id_equipamento = $1',
          [item.id_equipamento]
        );

        if (eqRes.rows.length === 0) {
          throw new Error(`Equipamento ID ${item.id_equipamento} não encontrado.`);
        }

        const valorUnitario = eqRes.rows[0].valorequipamento || 0;

        await client.query(
          `INSERT INTO itemreserva (id_reserva, id_equipamento, quantidadealugada, valorunitario)
           VALUES ($1, $2, $3, $4)`,
          [id, item.id_equipamento, qtd, valorUnitario]
        );
      }
    }

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.detail || err.message });
  } finally {
    client.release();
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