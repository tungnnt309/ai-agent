import {Pinecone} from '@pinecone-database/pinecone';
import {Configuration, OpenAIApi} from 'openai';
import dotenv from 'dotenv';
import products from '../data/products.json' assert {type: 'json'};
import esimProducts from '../data/esims.json' assert {type: 'json'};
import questions from '../data/questions.json' assert {type: 'json'};

dotenv.config();

// Khởi tạo OpenAI API
const openai = new OpenAIApi(new Configuration({apiKey: process.env.OPENAI_API_KEY}));

// Kết nối với Pinecone
const pc = new Pinecone({apiKey: process.env.PINECONE_API_KEY});
const index = pc.index(process.env.PINECONE_INDEX_NAME, process.env.PINECONE_INDEX_HOST); // Thay YOUR_INDEX_HOST bằng giá trị từ Pinecone Dashboard

function exportEsimText(item) {
    const country = item.rawInfo.countryName || "Unknown country";
    const name = item.name || "Unnamed product";
    const dataCap = item.rawInfo.highFlowSize
        ? `${Math.round(parseInt(item.rawInfo.highFlowSize, 10) / 1024)}GB`
        : "Unknown data cap";
    const validity = item.rawInfo.days ? `${item.rawInfo.days} days` : "Unknown validity";
    const network = "5G"; // Extracted from description
    const description = item.description || "No description available";
    const currency = item.rawInfo.currencyCode || "Unknown currency";
    const prices = item.denominations.length > 0 ? `Prices start at ${item.denominations[0]} ${currency}` : "";
    const id = item['_id']['$oid'];
    const embedText = `${name}: ${country} ${dataCap} eSIM for ${validity}. Network: ${network}. ${description}. ${prices}`;

    return {
        name: name,
        description: description,
        country: country,
        dataCap: dataCap,
        validity: validity,
        embedText: embedText,
        id: id
    };
}

async function generateAndStoreEmbeddings() {
    try {
        const namespace = "product-namespace"; // Namespace để lưu trữ dữ liệu
        let vectors = [];

        // let count = 0;
        // for (const product of esimProducts) {
        //     count++;
        //     const extract = exportEsimText(product);
        //
        //     // if (count === 100) {
        //     //     break;
        //     // }
        //     // Gửi mô tả sản phẩm đến OpenAI để tạo embeddings
        //     const response = await openai.createEmbedding({
        //         model: "text-embedding-ada-002",
        //         input: extract.embedText,
        //     });
        //
        //     const embedding = response.data.data[0].embedding;
        //
        //     // Thêm vector vào danh sách
        //     console.log('Product extract ', count);
        //     vectors.push({
        //         id: extract.id,
        //         values: embedding,
        //         metadata: {
        //             name: extract.name,
        //             description: extract.description,
        //             country: extract.country,
        //             dataCap: extract.dataCap,
        //             validity: extract.validity,
        //             type: 'esim',
        //             id: extract.id
        //         },
        //     });
        //
        //     if (count === 10) {
        //         // Lưu vectors vào Pinecone trong namespace đã chỉ định
        //         await index.namespace(namespace).upsert(vectors);
        //         count = 0;
        //         vectors = [];
        //     }
        // }

        for (const qu of questions) {
            const response = await openai.createEmbedding({
                model: "text-embedding-ada-002",
                input: qu.question,
            });

            const embedding = response.data.data[0].embedding;
            vectors.push({
                id: qu.id,
                values: embedding,
                metadata: {
                    name: qu.question,
                    description: qu.answer,
                    type: qu.type,
                    id: qu.id,
                    action: qu.action,

                },
            });

        }
        await index.namespace(namespace).upsert(vectors);

        console.log(`Embeddings successfully stored in namespace: ${namespace}`);
    } catch (error) {
        console.error("Error during embedding generation:", error);
    }
}

export {
    generateAndStoreEmbeddings
}
