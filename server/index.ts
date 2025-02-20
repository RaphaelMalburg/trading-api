import express from "express";
import { registerRoutes } from "./routes";
import cors from "cors";

const app = express();
const PORT = 5000;

// More specific CORS configuration
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"], // Add your client URLs
    credentials: true,
  })
);

app.use(express.json());

// Add this middleware to log all incoming requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`, req.body);
  next();
});

// Start server
async function startServer() {
  try {
    await registerRoutes(app);
    console.log(`Server running on port ${PORT}`);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
