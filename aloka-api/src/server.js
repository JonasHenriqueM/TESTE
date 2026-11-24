import express from 'express';
import cors from 'cors';

import clientesRoutes from './routes/clientes.js';
import espacosRoutes from './routes/espacos.js';
import equipamentosRoutes from './routes/equipamentos.js';
import reservasRoutes from './routes/reservas.js';
import faturasRoutes from './routes/faturas.js';
import funcionarioRoutes from './routes/funcionario.js';
import montagensRoutes from './routes/montagens.js';
import entregasRoutes from './routes/entrega.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'API ALOKA online!' });
});

app.use('/clientes', clientesRoutes);
app.use('/espacos', espacosRoutes);
app.use('/equipamentos', equipamentosRoutes);
app.use('/reservas', reservasRoutes);
app.use('/faturas', faturasRoutes);
app.use('/funcionarios', funcionarioRoutes);
app.use('/montagens', montagensRoutes);
app.use('/entregas', entregasRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor ALOKA rodando em http://localhost:${PORT}`);
});