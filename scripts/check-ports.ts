import net from 'net';

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

async function main() {
  const p5432 = await checkPort(5432);
  const p5433 = await checkPort(5433);
  const p6379 = await checkPort(6379);

  console.log(`Port 5432 (Standard Postgres): ${p5432 ? '🟢 OPEN' : '🔴 CLOSED'}`);
  console.log(`Port 5433 (Docker Postgres):   ${p5433 ? '🟢 OPEN' : '🔴 CLOSED'}`);
  console.log(`Port 6379 (Redis):             ${p6379 ? '🟢 OPEN' : '🔴 CLOSED'}`);
}

main();
