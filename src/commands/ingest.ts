import { startServer } from '../server.js';

export async function ingestCommand(port?: number) {
  const serverPort = port || parseInt(process.env.PORT || '3000', 10);
  startServer(serverPort);
}
