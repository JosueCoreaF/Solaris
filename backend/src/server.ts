import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import hubRoutes from './routes/hub';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/hub', hubRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Solaris Backend' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en el puerto ${PORT}`);
});
