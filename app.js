import express from "express";
import bodyParser from "body-parser";
import embeddingRoutes from "./routes/embeddings.js";
import searchRoutes from "./routes/search.js";
import fineTuneRoutes from "./routes/fine_tunning_search.js";

const app = express();
app.use(bodyParser.json());

// Routes
app.use("/api/embeddings", embeddingRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/tuning", fineTuneRoutes);

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});


