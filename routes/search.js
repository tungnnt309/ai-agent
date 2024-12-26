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

// Simulated in-memory storage for user conversations (use a database in production)
const userConversations = {};

// Helper to retrieve the last 5 messages for a user
function getUserContext(userId) {
    if (!userConversations[userId]) {
        userConversations[userId] = [];
    }
    return userConversations[userId].slice(-5); // Return the last 5 messages
}

function findEsimById(esimId) {
    for (const product of esimProducts) {
        if (product['_id']['$oid'] === esimId) {
            return product;
        }
    }
}

// Helper to save a new message to the user's conversation history
function saveUserMessage(userId, message) {
    if (!userConversations[userId]) {
        userConversations[userId] = [];
    }
    userConversations[userId].push(message);
}

router.post("/", async (req, res) => {
    const {userId, query, prvMessages} = req.body;

    if (!userId || !query) {
        return res.status(400).json({error: "Missing userId or query"});
    }

    try {
        // Step 1: Generate embeddings for the query
        const embeddingResponse = await openai.createEmbedding({
            model: "text-embedding-ada-002",
            input: query,
        });
        const queryEmbedding = embeddingResponse.data.data[0].embedding;

        // Step 2: Search in Pinecone
        const searchResponse = await index.namespace("product-namespace").query({
            vector: queryEmbedding,
            topK: 3,
            includeMetadata: true,
        });


        const matches = searchResponse.matches.map(function (match) {
            const id = match.id;
            const score = match.score;
            const name = match.metadata.name;
            const description = match.metadata.description;
            const type = match.metadata.type;
            const action = match.metadata.action;
            const originalProduct = findEsimById(id);
            const groupId = originalProduct != null ? originalProduct['rawInfo']['productAndPlanTypeGroupKey'] : '';
            return {
                id: id,
                score: score,
                name: name,
                description: description,
                type: type,
                groupId: groupId,
                action: action
            };
        });

        const threshold = 0.8; // Minimum relevance threshold
        const finalMatches = matches.filter((match) => match.score >= threshold);

        // Step 3: Retrieve user context
        // const previousMessages = getUserContext(userId); // Fetch last 5 messages for the user
        console.log('previousMessages', prvMessages);

        // Step 4: Generate GPT response
        if (finalMatches.length === 0) {
            console.log("No matches found. Generating GPT response...");

            // No matches, create a fallback response
            const fallbackPrompt = `
                    The user asked: "${query}". 
                    Unfortunately, no relevant products were found for their query. 🤔 But don't worry! 
                    You are a helpful and friendly assistant 🤖. Always respond in the same language as the user's query, using a friendly tone and emojis to make the response engaging 🌟.
                    
                    Provide clear step-by-step guidance to help the user refine their query or explore alternatives. 
                    For example:
                    - Suggest providing more details like the region (e.g., "eSIM for Canada").
                    - Recommend specifying data needs (e.g., "2GB/day" or "unlimited data").
                    - Ask for validity requirements (e.g., "7 days" or "30 days").
                    
                    Internally, determine the language of the query: "${query}" to ensure your response matches the user's language. 
                    Do not explicitly state the detected language in your response. Instead, proceed directly to providing assistance in the same language as the query. 
                    Make your response friendly, instructional, and delightful 😊.
                    `;

            const chatResponse = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful and friendly assistant 🤖. Using a friendly tone and emojis to make the response engaging 🌟. \n" +
                            "When providing guidance, offer clear step-by-step instructions with examples to help the user. \n" +
                            "Focus on being approachable, helpful, and delightful in all responses 😊",
                    },
                    ...prvMessages, // Include the user's conversation history
                    {role: "user", content: fallbackPrompt},
                ],
            });

            const gptAnswer = chatResponse.data.choices[0].message.content;

            // Save conversation history
            saveUserMessage(userId, {role: "user", content: query});
            saveUserMessage(userId, {role: "assistant", content: gptAnswer});

            return res.status(200).json({
                query,
                matches: [],
                answer: gptAnswer,
            });
        }

        // Matches found, generate a contextual response
        // const context = finalMatches
        //     .map((match, index) => `${index + 1}. ${match.name}: ${match.description}`)
        //     .join("\n");
        const match = finalMatches[0];
        const context = `${index + 1}. ${match.name}: ${match.description}`;

        const contextualPrompt = `
                You are a helpful and friendly assistant 🤖. Always respond in the same language as the user's query, using a friendly tone and emojis to make the response engaging 🌟. 
                When providing guidance, offer clear step-by-step instructions with examples to help the user. 
                Focus on being approachable, helpful, and delightful in all responses 😊.
                The user asked: "${query}". 
                Here are the top product matches:
                ${context}
                Internally, determine the language of the query: "${query}" to ensure your response matches the user's language. 
                Do not explicitly state the detected language in your response. Instead, proceed directly to providing assistance in the same language as the query. 
                Make your response friendly, instructional, and delightful 😊.
                `;

        const chatResponse = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful and friendly assistant 🤖. Always respond in the same language as the user's query, using a friendly tone and emojis to make the response engaging 🌟. \n" +
                        "When providing guidance, offer clear step-by-step instructions with examples to help the user. \n" +
                        "Focus on being approachable, helpful, and delightful in all responses 😊",
                },
                ...prvMessages, // Include the user's conversation history
                {role: "user", content: contextualPrompt},
            ],
        });

        const gptAnswer = chatResponse.data.choices[0].message.content;

        // Save conversation history
        // saveUserMessage(userId, {role: "user", content: query});
        // saveUserMessage(userId, {role: "assistant", content: gptAnswer});

        // Return response to the frontend
        res.status(200).json({
            query,
            finalMatches,
            answer: gptAnswer,
        });
    } catch (error) {
        console.error("Error during search:", error);

        // Handle specific OpenAI or Pinecone errors
        if (error.response) {
            return res.status(500).json({
                error: error.response.data.error || "An error occurred during API interaction",
            });
        }

        return res.status(500).json({error: "Something went wrong during the search."});
    }
});

export default router;
