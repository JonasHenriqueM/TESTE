import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// LISTAR MONTAGENS (GET /montagens) - Puxa data e horários diretamente da Reserva
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        m.id_reserva,
        r.datareserva,
        r.horainicio,
        r.horafim,
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
      ORDER BY r.datareserva DESC, r.horainicio DESC, m.id_reserva DESC;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CRIAR MONTAGEM (POST /montagens) - Garante que a reserva possui espaço alocado
router.post('/', async (req, res) => {
  const { id_reserva, id_equipamento, id_funcionario } = req.body;
  try {
    const resReserva = await pool.query(
      'SELECT id_espaco FROM reserva WHERE id_reserva = $1',
      [id_reserva]
    );

    if (resReserva.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }

    if (resReserva.rows[0].id_espaco === null) {
      return res.status(400).json({ error: 'Reservas sem espaço alocado devem ser registradas em Entregas, não em Montagens.' });
    }

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

// EDITAR MONTAGEM (PUT /montagens/:id_reserva/:id_equipamento/:id_funcionario)
router.put('/:id_reserva/:id_equipamento/:id_funcionario', async (req, res) => {
  const { id_reserva, id_equipamento, id_funcionario } = req.params;
  const novoReserva = req.body.id_reserva || id_reserva;
  const novoEquipamento = req.body.id_equipamento || id_equipamento;
  const novoFuncionario = req.body.id_funcionario || id_funcionario;

  try {
    const { rows } = await pool.query(
      `UPDATE montagem 
       SET id_reserva = $1, id_equipamento = $2, id_funcionario = $3
       WHERE id_reserva = $4 AND id_equipamento = $5 AND id_funcionario = $6
       RETURNING *`,
      [novoReserva, novoEquipamento, novoFuncionario, id_reserva, id_equipamento, id_funcionario]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Montagem não encontrada.' });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.detail || err.message });
  }
});

// EXCLUIR MONTAGEM (DELETE /montagens/:id_reserva/:id_equipamento/:id_funcionario)
router.delete('/:id_reserva/:id_equipamento/:id_funcionario', async (req, res) => {
  const { id_reserva, id_equipamento, id_funcionario } = req.params;
  try {
    const { rows } = await pool.query(
      `DELETE FROM montagem 
       WHERE id_reserva = $1 AND id_equipamento = $2 AND id_funcionario = $3
       RETURNING *`,
      [id_reserva, id_equipamento, id_funcionario]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Montagem não encontrada.' });
    }

    res.json({ message: 'Montagem excluída com sucesso.', montagem: rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.detail || err.message });
  }
});

export default router;