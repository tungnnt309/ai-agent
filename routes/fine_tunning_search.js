import express from "express";
import {Pinecone} from "@pinecone-database/pinecone";
import {Configuration, OpenAIApi} from "openai";
import dotenv from "dotenv";
import esimProducts from '../data/esims.json' assert {type: 'json'};

dotenv.config();

const router = express.Router();

// Initialize OpenAI and Pinecone
const openai = new OpenAIApi(new Configuration({apiKey: process.env.OPENAI_API_KEY}));
const pc = new Pinecone({apiKey: process.env.PINECONE_API_KEY});
const index = pc.index(process.env.PINECONE_INDEX_NAME, process.env.PINECONE_INDEX_HOST); // Replace YOUR_INDEX_HOST with Pinecone Dashboard value

router.post("/", async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "Prompt is required." });
    }

    try {
        // Gửi request đến mô hình fine-tuning
        const response = await openai.createChatCompletion({
            model: process.env.FINE_TUNED_MODEL,
            messages: [
                { role: "system", content: "You are a fine-tuned assistant. Always respond strictly based on your training data and use a friendly tone." },
                { role: "user", content: prompt },
            ],
            max_tokens: 150,
            temperature: 0.0, // Không sáng tạo
            top_p: 0.1, // Giới hạn các câu trả lời có xác suất cao nhất
        });

        console.log('ChatGPT response');
        console.log(response.data);

        return res.status(200).json({
            prompt: prompt,
            response: response.data.choices[0].message,
        });
    } catch (error) {
        console.error("Error calling OpenAI API:", error.response?.data || error.message);
        return res.status(500).json({ error: "Something went wrong while processing your request." });
    }
});
export default router;
