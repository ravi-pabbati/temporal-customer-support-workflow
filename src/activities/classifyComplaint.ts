import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

export type ComplaintCategory = 'missing_item' | 'quality_issue' | 'other';

export interface ClassificationResult {
  category: ComplaintCategory;
  confidence: number;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function classifyComplaintActivity(complaintText: string): Promise<ClassificationResult> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: `You are a customer support classifier for a food delivery service.
Classify the customer complaint into exactly one of these categories:
- "missing_item": The customer says a food item or their entire order was not delivered
- "quality_issue": The customer says the food quality was bad (cold, wrong, spoiled, taste, etc.)
- "other": Any other type of complaint

Respond with ONLY valid JSON in this format:
{"category": "missing_item"|"quality_issue"|"other", "confidence": 0.0-1.0}`,
    messages: [
      { role: 'user', content: `Customer complaint: "${complaintText}"` }
    ]
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const result = JSON.parse(text) as ClassificationResult;
  console.log(`[classify] "${complaintText}" → ${result.category} (confidence: ${result.confidence})`);
  return result;
}
