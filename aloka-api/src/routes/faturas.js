import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// GET /faturas - Lista faturas calculando o valor total da reserva e o status dinâmico
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        f.id_fatura,
        f.id_reserva,
        c.nome AS cliente_nome,
        (COALESCE(e.valorespaco, 0.00) + COALESCE(SUM(ir.quantidadealugada * ir.valorunitario), 0.00)) AS valortotal,
        f.datavencimento,
        f.datapagamento,
        f.comprovante,
        CASE 
          WHEN f.datapagamento IS NOT NULL THEN 'Faturado'
          ELSE 'Pagamento Pendente'
        END AS status_fatura
      FROM fatura f
      INNER JOIN reserva r ON f.id_reserva = r.id_reserva
      INNER JOIN cliente c ON r.id_cliente = c.id_cliente
      LEFT JOIN espaco e ON r.id_espaco = e.id_espaco
      LEFT JOIN itemreserva ir ON r.id_reserva = ir.id_reserva
      GROUP BY 
        f.id_fatura, f.id_reserva, c.nome, e.valorespaco, 
        f.datavencimento, f.datapagamento, f.comprovante
      ORDER BY f.id_reserva DESC;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /faturas - Cria uma nova fatura para uma reserva (com pagamento opcional)
router.post('/', async (req, res) => {
  const { id_reserva, datavencimento, datapagamento, comprovante } = req.body;

  try {
    const query = `
      INSERT INTO FATURA (ID_RESERVA, DataVencimento, DataPagamento, Comprovante)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const values = [
      id_reserva,
      datavencimento,
      datapagamento || null,
      comprovante || null
    ];

    const { rows } = await pool.query(query, values);
    res.status(201).json({ message: 'Fatura criada com sucesso!', fatura: rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.detail || err.message });
  }
});

// PATCH /faturas/:id/pagar - Baixa rápida de pagamento na data atual
router.patch('/:id/pagar', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      'UPDATE FATURA SET DataPagamento = CURRENT_DATE WHERE ID_FATURA = $1 RETURNING *',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Fatura não encontrada' });
    res.json({ message: 'Pagamento registrado!', fatura: rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /faturas/:id - Edita vencimento, data de pagamento e comprovante
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { datavencimento, datapagamento, comprovante } = req.body;

  try {
    const query = `
      UPDATE FATURA
      SET 
        DataVencimento = $1,
        DataPagamento = $2,
        Comprovante = $3
      WHERE ID_FATURA = $4
      RETURNING *
    `;

    const values = [
      datavencimento,
      datapagamento || null,
      comprovante || null,
      id
    ];

    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Fatura não encontrada.' });
    }

    res.json({ message: 'Fatura atualizada com sucesso!', fatura: rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.detail || err.message });
  }
});

// DELETE /faturas/:id - Exclui uma fatura
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'DELETE FROM FATURA WHERE ID_FATURA = $1 RETURNING *',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Fatura não encontrada.' });
    }

    res.json({ message: 'Fatura excluída com sucesso.', fatura: rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.detail || err.message });
  }
});

export default router;