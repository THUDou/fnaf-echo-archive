/* 构建单文件发行版：把 CSS / JS 全部内联进一个 HTML */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

html = html.replace(
  /<link rel="stylesheet" href="([^"]+)">/g,
  (m, p) => '<style>\n' + fs.readFileSync(path.join(root, p), 'utf8') + '\n</style>'
);

html = html.replace(
  /<script src="([^"]+)"><\/script>/g,
  (m, p) => {
    const code = fs.readFileSync(path.join(root, p), 'utf8').replace(/<\/script/gi, '<\\/script');
    return '<script>\n' + code + '\n</script>';
  }
);

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'fnaf-echo-archive.html');
fs.writeFileSync(outFile, html);
console.log('built: ' + outFile + '  (' + (Buffer.byteLength(html) / 1024).toFixed(1) + ' KB)');
