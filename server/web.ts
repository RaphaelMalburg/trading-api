import http from "http";
import { neonClient } from "./services/database";

const requestHandler = async (req: http.IncomingMessage, res: http.ServerResponse) => {
  try {
    const result = await neonClient`SELECT version()`;
    const { version } = result[0];
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(version);
  } catch (error) {
    console.error("Error:", error);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
};

const server = http.createServer(requestHandler);

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
