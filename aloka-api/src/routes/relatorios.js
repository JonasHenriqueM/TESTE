import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// GET /relatorios/clientes-frequentes?min_reservas=2
// Filtra grupos de clientes que possuem pelo menos N reservas não canceladas
router.get('/clientes-frequentes', async (req, res) => {
  const minReservas = Number(req.query.min_reservas) || 2;

  try {
    const query = `
      SELECT 
        c.id_cliente,
        c.nome AS cliente_nome,
        c.email,
        COUNT(DISTINCT r.id_reserva) AS total_reservas,
        COALESCE(SUM(DISTINCT e.valorespaco), 0.00) + COALESCE(SUM(ir.quantidadealugada * ir.valorunitario), 0.00) AS total_gasto
      FROM cliente c
      INNER JOIN reserva r ON r.id_cliente = c.id_cliente
      LEFT JOIN espaco e ON e.id_espaco = r.id_espaco
      LEFT JOIN itemreserva ir ON ir.id_reserva = r.id_reserva
      WHERE r.statusreserva <> 'CANCELADA'
      GROUP BY c.id_cliente, c.nome, c.email
      HAVING COUNT(DISTINCT r.id_reserva) >= $1
      ORDER BY total_reservas DESC, total_gasto DESC;
    `;
    const { rows } = await pool.query(query, [minReservas]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;