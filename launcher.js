#!/usr/bin/env node
/**
 * IoT Simulator Launcher
 * Express 서버를 시작하고 기본 브라우저에서 웹 UI를 엽니다.
 */
const path = require('path');
const { exec } = require('child_process');

// backend 경로 설정 (pkg 패키징 시 snapshot 경로 대응)
const backendDir = path.join(__dirname, 'backend');
process.chdir(backendDir);

const app = require('./backend/app');
const http = require('http');

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('');
  console.log('  ╔═══════════════════════════════════════╗');
  console.log('  ║       IoT Device Simulator            ║');
  console.log('  ╠═══════════════════════════════════════╣');
  console.log(`  ║  Web UI : ${url}            ║`);
  console.log('  ║                                       ║');
  console.log('  ║  Protocols:                           ║');
  console.log('  ║    MQTT      : localhost:1883         ║');
  console.log('  ║    CoAP      : localhost:5683         ║');
  console.log('  ║    BACnet    : localhost:47808        ║');
  console.log('  ║    OPC-UA    : localhost:4840         ║');
  console.log('  ║    Modbus TCP: localhost:5020         ║');
  console.log('  ║                                       ║');
  console.log('  ║  Press Ctrl+C to stop                 ║');
  console.log('  ╚═══════════════════════════════════════╝');
  console.log('');

  // 기본 브라우저에서 열기
  openBrowser(url);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try: PORT=3001 node launcher.js`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => {
    if (err) console.log('  (브라우저를 수동으로 열어주세요: ' + url + ')');
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n  Shutting down...');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000);
});
