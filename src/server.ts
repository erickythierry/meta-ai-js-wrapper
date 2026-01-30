import app from './api';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Meta AI API rodando em http://localhost:${PORT}`);
  console.log(`📍 Teste em: http://localhost:${PORT}/health`);
  console.log(`💬 Envie prompts para: POST http://localhost:${PORT}/api/prompt`);
});
