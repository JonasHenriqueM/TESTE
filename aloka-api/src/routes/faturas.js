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

export default router;