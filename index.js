import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Use an IIFE to handle async/await
(async () => {
  // Open the database file
  const db = await open({
    filename: 'chat.db',
    driver: sqlite3.Database
  });

  // Create our 'messages' table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_offset TEXT UNIQUE,
        content TEXT
    );
  `);

  const app = express();
  const server = createServer(app);
  const io = new Server(server);

  const filename = fileURLToPath(import.meta.url);
  const dirName = dirname(filename);

  app.get('/', (req, res) => {
    res.sendFile(join(dirName, 'index.html'));
  });

  io.on('connection', (socket) => {
    socket.on('chat message', async (msg) => {
      let result;
      try {
        // Store the message in the database
        result = await db.run('INSERT INTO messages (content) VALUES (?)', msg);
      } catch (e) {
        // Handle the failure
        return;
      }
      // Include the offset with the message
      io.emit('chat message', msg, result.lastID);
    });

    if (!socket.recovered) {
      // If the connection state recovery was not successful
      try {
        db.each('SELECT id, content FROM messages WHERE id > ?',
          [socket.handshake.auth.serverOffset || 0],
          (_err, row) => {
            socket.emit('chat message', row.content, row.id);
          }
        );
      } catch (e) {
        // Something went wrong
        console.log("Something went wrong");
      }
    }
  });

  server.listen(3000, () => {
    console.log("Server is running at 3000");
  });
})();
