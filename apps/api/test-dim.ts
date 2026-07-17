import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
async function main() {
  const model = ai.getGenerativeModel({ model: 'gemini-embedding-001' });
  const res = await model.embedContent({
    content: { parts: [{ text: 'Hello' }], role: 'user' },
    // Google SDK might not support this type directly in embedContent but we can try
    // @ts-ignore
    outputDimensionality: 768
  });
  console.log("Dimensions:", res.embedding.values.length);
}
main().catch(console.error);
