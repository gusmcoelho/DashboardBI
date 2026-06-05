const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Servir os arquivos estáticos da pasta raiz
app.use(express.static(__dirname));

// Rota padrão para servir o index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Inicia o servidor local
app.listen(PORT, () => {
  console.log(`Servidor local de testes rodando em: http://localhost:${PORT}`);
});
