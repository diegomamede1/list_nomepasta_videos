const fs = require('fs');
const path = require('path');

function listarVideosEPastas(diretorio) {
  const extensoesVideo = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'];
  const itens = fs.readdirSync(diretorio, { withFileTypes: true });

  const resultado = {
    pastas: [],
    videos: [],
  };

  for (const item of itens) {
    if (item.isDirectory()) {
      resultado.pastas.push(item.name);
    } else if (item.isFile()) {
      const ext = path.extname(item.name).toLowerCase();
      if (extensoesVideo.includes(ext)) {
        resultado.videos.push(item.name);
      }
    }
  }

  return resultado;
}

const diretorioAlvo = process.argv[2] || '.';
const campoAbsoluto = path.resolve(diretorioAlvo);

console.log(`\nListando em: ${campoAbsoluto}\n`);

const { pastas, videos } = listarVideosEPastas(campoAbsoluto);

console.log(`Pastas (${pastas.length}):`);
pastas.forEach(p => console.log(`  [DIR] ${p}`));

console.log(`\nVideos (${videos.length}):`);
videos.forEach(v => console.log(`  [VID] ${v}`));
