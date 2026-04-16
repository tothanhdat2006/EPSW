import OpenAI from 'openai';
import { getRuntimeConfig, type WorkerEnv } from './env.js';

export interface AnalysisResult {
  documentType: string;
  urgency: 'NORMAL' | 'URGENT' | 'FLASH';
  securityLevel: 'UNCLASSIFIED' | 'RESTRICTED' | 'CONFIDENTIAL' | 'SECRET';
  department: string;
  summary: string;
  issuingAuthority?: string;
  issueDate?: string;
  expiryDate?: string;
  subjectName?: string;
  subjectId?: string;
  address?: string;
  purpose?: string;
  referenceNumber?: string;
  keywords?: string[];
  extractionConfidence: number;
  classificationConfidence: number;
}

function toBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, Math.min(index + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function pickTextFromOcrResponse(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const record = payload as Record<string, unknown>;
  const directText =
    record['text'] ??
    (record['result'] as Record<string, unknown> | undefined)?.['text'] ??
    (record['output'] as Record<string, unknown> | undefined)?.['text'] ??
    (record['data'] as Record<string, unknown> | undefined)?.['text'];

  if (typeof directText === 'string') {
    return directText;
  }

  const lines =
    (record['lines'] as string[] | undefined) ??
    ((record['result'] as Record<string, unknown> | undefined)?.['lines'] as string[] | undefined);

  if (Array.isArray(lines)) {
    return lines.join('\n').trim();
  }

  return '';
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function createClient(env: WorkerEnv): OpenAI {
  const runtime = getRuntimeConfig(env);
  if (!runtime.llm.apiKey) {
    throw new Error('LLM_API_KEY is required');
  }

  return new OpenAI({
    apiKey: runtime.llm.apiKey,
    baseURL: runtime.llm.baseUrl,
  });
}

export async function extractTextFromFile(
  env: WorkerEnv,
  rawFileUrl: string,
  mimeType: string,
  bytes: Uint8Array,
): Promise<string> {
  const runtime = getRuntimeConfig(env);

  if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    return new TextDecoder().decode(bytes).trim();
  }

  if (runtime.ocr.endpoint && runtime.llm.apiKey) {
    const response = await fetchWithTimeout(
      runtime.ocr.endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${runtime.llm.apiKey}`,
        },
        body: JSON.stringify({
          fileUrl: rawFileUrl,
          mimeType,
          contentBase64: toBase64(bytes),
        }),
      },
      runtime.ocr.timeoutMs,
    );

    if (response.ok) {
      const payload = (await response.json()) as unknown;
      const text = pickTextFromOcrResponse(payload);
      if (text.trim()) {
        return text.trim();
      }
    }
  }

  if (!mimeType.startsWith('image/')) {
    return '';
  }

  if (!runtime.llm.apiKey) {
    return '';
  }

  const client = createClient(env);
  const imageDataUrl = `data:${mimeType};base64,${toBase64(bytes)}`;

  const completion = await client.chat.completions.create({
    model: runtime.llm.ocrModel,
    messages: [
      {
        role: 'system',
        content:
          'Extract all visible text from the image exactly. Return only plain text with line breaks.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Please extract all text from this document image.',
          },
          {
            type: 'image_url',
            image_url: { url: imageDataUrl },
          },
        ],
      },
    ],
    temperature: 0,
    max_tokens: 3000,
  });

  return completion.choices[0]?.message?.content?.trim() ?? '';
}

export async function analyzeDocumentText(env: WorkerEnv, rawText: string): Promise<AnalysisResult> {
  const runtime = getRuntimeConfig(env);
  const client = createClient(env);

  const prompt = `You are an expert Vietnamese administrative document analyst.
Return strictly valid JSON with this schema:
{
  "documentType": string,
  "urgency": "NORMAL" | "URGENT" | "FLASH",
  "securityLevel": "UNCLASSIFIED" | "RESTRICTED" | "CONFIDENTIAL" | "SECRET",
  "department": string,
  "summary": string,
  "issuingAuthority": string | null,
  "issueDate": string | null,
  "expiryDate": string | null,
  "subjectName": string | null,
  "subjectId": string | null,
  "address": string | null,
  "purpose": string | null,
  "referenceNumber": string | null,
  "keywords": string[],
  "classificationConfidence": number,
  "extractionConfidence": number
}

Text:\n${rawText.slice(0, 12000)}`;

  const completion = await client.chat.completions.create({
    model: runtime.llm.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: runtime.llm.temperature,
    response_format: { type: 'json_object' },
    max_tokens: 1200,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('LLM returned empty analysis');
  }

  const parsed = JSON.parse(content) as Partial<AnalysisResult>;

  return {
    documentType: parsed.documentType ?? 'UNKNOWN',
    urgency: parsed.urgency ?? 'NORMAL',
    securityLevel: parsed.securityLevel ?? 'UNCLASSIFIED',
    department: parsed.department ?? 'DEFAULT_DEPT',
    summary: parsed.summary ?? 'No summary',
    issuingAuthority: parsed.issuingAuthority ?? undefined,
    issueDate: parsed.issueDate ?? undefined,
    expiryDate: parsed.expiryDate ?? undefined,
    subjectName: parsed.subjectName ?? undefined,
    subjectId: parsed.subjectId ?? undefined,
    address: parsed.address ?? undefined,
    purpose: parsed.purpose ?? undefined,
    referenceNumber: parsed.referenceNumber ?? undefined,
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    classificationConfidence: Number(parsed.classificationConfidence ?? 60),
    extractionConfidence: Number(parsed.extractionConfidence ?? 60),
  };
}

export function computeOverallConfidence(
  classificationConfidence: number,
  extractionConfidence: number,
): number {
  return Number((classificationConfidence * 0.55 + extractionConfidence * 0.45).toFixed(2));
}
