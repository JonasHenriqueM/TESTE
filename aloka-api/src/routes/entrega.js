const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /entregas - Lista todas as entregas com dados de reserva, cliente, equipamento e funcionário
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        e.id_entrega,
        e.id_reserva,
        c.nome AS cliente_nome,
        c.endereco AS cliente_endereco,
        eq.nomeequipamento AS equipamento_nome,
        f.nome AS funcionario_nome,
        e.dataentrega AS data,
        e.horarioentrega AS horario,
        e.statusentrega AS status
      FROM ENTREGA e
      LEFT JOIN RESERVA r ON e.id_reserva = r.id_reserva
      LEFT JOIN CLIENTE c ON r.id_cliente = c.id_cliente
      LEFT JOIN EQUIPAMENTO eq ON e.id_equipamento = eq.id_equipamento
      LEFT JOIN FUNCIONARIO f ON e.id_funcionario = f.id_funcionario
      ORDER BY e.id_entrega DESC
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar entregas:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;