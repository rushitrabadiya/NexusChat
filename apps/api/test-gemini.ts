import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
async function test(modelName: string) {
  try {
    const model = ai.getGenerativeModel({ model: modelName });
    const res = await model.embedContent('Hello');
    console.log(`${modelName}: success, dimensions: ${res.embedding.values.length}`);
  } catch (e: any) {
    console.log(`${modelName}: failed - ${e.message}`);
  }
}
async function main() {
  await test('text-embedding-004');
  await test('gemini-embedding-001');
  await test('embedding-001');
}
main();
