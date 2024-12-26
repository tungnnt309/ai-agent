import express from "express";
import {generateAndStoreEmbeddings} from "../scripts/generate_embeddings.js";

const router = express.Router();

// Endpoint to regenerate embeddings
router.post("/generate", async (req, res) => {
    try {
        await generateAndStoreEmbeddings();
        res.status(200).json({message: "Embeddings generated and stored successfully!"});
    } catch (error) {
        console.error(error);
        res.status(500).json({error: "Failed to generate embeddings"});
    }
});

export default router;
