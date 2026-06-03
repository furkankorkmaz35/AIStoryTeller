import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/db.js";
import { outputsRoot } from "./utils/paths.js";
import { projectsRouter } from "./routes/projects.js";
import { systemRouter } from "./routes/system.js";


await connectDatabase();

const app = express();

// Static outputs expose generated MP4/image/audio files to the Vue preview panel.
app.use(cors());
app.use(express.json({ limit: "90mb" }));
app.use("/outputs", express.static(outputsRoot));

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "ai-video-api" });
});

// API is intentionally small for the course demo: projects and provider/system status.
app.use("/api/projects", projectsRouter);
app.use("/api/system", systemRouter);

// Central error shape keeps frontend error handling simple.
app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  const message = error instanceof Error ? error.message : "Unexpected server error";
  response.status(400).json({ message });
});

app.listen(env.port, () => {
  console.log(`AI Video API listening on http://localhost:${env.port}`);
});
