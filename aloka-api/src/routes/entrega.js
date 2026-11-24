import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// GET /entregas - Lista todas as entregas (reservas sem espaço alocado), puxando data e hora da Reserva
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        ent.id_entrega,
        ent.id_reserva,
        ent.id_equipamento,
        ent.id_funcionario,
        r.datareserva AS data, 
        r.horainicio AS horario,
        r.horafim,
        ent.tipoentrega,
        COALESCE(ent.enderecoentrega, r.enderecoevento, c.endereco) AS enderecoentrega,
        c.nome AS cliente_nome, 
        eq.nomeequipamento AS equipamento_nome,
        f.nomefuncionario AS funcionario_nome
      FROM entrega ent
      INNER JOIN reserva r ON ent.id_reserva = r.id_reserva
      INNER JOIN cliente c ON r.id_cliente = c.id_cliente
      INNER JOIN equipamento eq ON ent.id_equipamento = eq.id_equipamento
      INNER JOIN funcionario f ON ent.id_funcionario = f.id_funcionario
      WHERE r.id_espaco IS NULL
      ORDER BY r.datareserva DESC, r.horainicio DESC;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /entregas - Cria uma nova entrega puxando datareserva e horainicio automaticamente da Reserva
router.post('/', async (req, res) => {
  const { id_reserva, id_funcionario, id_equipamento, enderecoentrega, tipoentrega } = req.body;
  try {
    // 1. Busca data, horário e endereço diretamente da reserva selecionada
    const resReserva = await pool.query(
      'SELECT datareserva, horainicio, enderecoevento, id_espaco FROM reserva WHERE id_reserva = $1',
      [id_reserva]
    );

    if (resReserva.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }

    const { datareserva, horainicio, enderecoevento, id_espaco } = resReserva.rows[0];

    if (id_espaco !== null) {
      return res.status(400).json({ error: 'Reservas com espaço alocado devem ser registradas em Montagens, não em Entregas.' });
    }

    // 2. Insere a entrega usando a data e o horário da reserva
    const { rows } = await pool.query(
      `INSERT INTO entrega (id_reserva, id_funcionario, id_equipamento, data, horario, enderecoentrega, tipoentrega) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        id_reserva,
        id_funcionario,
        id_equipamento,
        datareserva,
        horainicio,
        enderecoentrega || enderecoevento || null,
        tipoentrega || 'ENTREGA EM EVENTO PRÓPRIO'
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.detail || err.message });
  }
});

// PUT /entregas/:id - Edita uma entrega (mantendo data e hora sincronizadas com a reserva)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { enderecoentrega, id_funcionario, tipoentrega } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE entrega ent
       SET 
         id_funcionario = COALESCE($1, ent.id_funcionario),
         enderecoentrega = COALESCE($2, ent.enderecoentrega),
         tipoentrega = COALESCE($3, ent.tipoentrega),
         data = r.datareserva,
         horario = r.horainicio
       FROM reserva r
       WHERE ent.id_reserva = r.id_reserva
         AND ent.id_entrega = $4
       RETURNING ent.*`,
      [id_funcionario || null, enderecoentrega || null, tipoentrega || null, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Entrega não encontrada.' });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.detail || err.message });
  }
});

// DELETE /entregas/:id - Exclui uma entrega (fazendo a reserva voltar automaticamente para 'Não agendada')
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      'DELETE FROM entrega WHERE id_entrega = $1 RETURNING *',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Entrega não encontrada.' });
    }

    res.json({ message: 'Entrega excluída com sucesso.', entrega: rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.detail || err.message });
  }
});

export default router;