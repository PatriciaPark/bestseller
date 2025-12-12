import express from 'express';
import cors from 'cors';
import booksRouter from './routes/books.js';
import bookDetailRouter from './routes/bookDetail.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/', booksRouter);
app.use('/', bookDetailRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 Books API:`);
  console.log(`   - KR: http://localhost:${PORT}/kr-books`);
  console.log(`   - US: http://localhost:${PORT}/us-books`);
  console.log(`   - JP: http://localhost:${PORT}/jp-books`);
  console.log(`   - UK: http://localhost:${PORT}/uk-books`);
  console.log(`   - CH: http://localhost:${PORT}/ch-books`);
  console.log(`   - TW: http://localhost:${PORT}/tw-books`);
  console.log(`   - FR: http://localhost:${PORT}/fr-books`);
  console.log(`📖 Book Detail API:`);
  console.log(`   - KR: http://localhost:${PORT}/kr-book-detail`);
  console.log(`   - US: http://localhost:${PORT}/us-book-detail`);
  console.log(`   - JP: http://localhost:${PORT}/jp-book-detail`);
  console.log(`   - UK: http://localhost:${PORT}/uk-book-detail`);
  console.log(`   - CH: http://localhost:${PORT}/ch-book-detail`);
  console.log(`   - TW: http://localhost:${PORT}/tw-book-detail`);
  console.log(`   - FR: http://localhost:${PORT}/fr-book-detail`);
});

