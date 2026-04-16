import OpenAI from 'openai';
import { config } from '../config.js';

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

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: config.llm.apiKey,
      baseURL: config.llm.baseUrl,
    });
  }
  return client;
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

export async function extractTextWithAlibabaOCR(
  rawFileUrl: string,
  mimeType: string,
  fileBytes: Buffer,
): Promise<string> {
  if (!config.llm.apiKey) {
    throw new Error('LLM_API_KEY/OPENAI_API_KEY is missing');
  }

  if (config.ocr.endpoint) {
    const response = await fetch(config.ocr.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.llm.apiKey}`,
      },
      body: JSON.stringify({
        fileUrl: rawFileUrl,
        mimeType,
        contentBase64: fileBytes.toString('base64'),
      }),
      signal: AbortSignal.timeout(config.ocr.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Alibaba OCR failed (${response.status})`);
    }

    const payload = (await response.json()) as unknown;
    const text = pickTextFromOcrResponse(payload);
    if (text.trim()) {
      return text.trim();
    }
  }

  // Fallback: use OpenAI-compatible Qwen model to transcribe image content.
  if (!mimeType.startsWith('image/')) {
    throw new Error('OCR endpoint not configured for non-image file');
  }

  const imageDataUrl = `data:${mimeType};base64,${fileBytes.toString('base64')}`;
  const openai = getClient();

  const completion = await openai.chat.completions.create({
    model: config.llm.ocrModel,
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
            image_url: {
              url: imageDataUrl,
            },
          },
        ],
      },
    ],
    temperature: 0,
    max_tokens: 3000,
  });

  return completion.choices[0]?.message?.content?.trim() ?? '';
}

export async function analyzeDocumentText(rawText: string): Promise<AnalysisResult> {
  const openai = getClient();

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

  const completion = await openai.chat.completions.create({
    model: config.llm.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: config.llm.temperature,
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
    urgency: (parsed.urgency as AnalysisResult['urgency']) ?? 'NORMAL',
    securityLevel: (parsed.securityLevel as AnalysisResult['securityLevel']) ?? 'UNCLASSIFIED',
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

export async function chatWithDocumentContext(
  message: string,
  history: { role: string; content: string }[],
  context: Record<string, unknown>,
): Promise<string> {
  const openai = getClient();

  const normalizedHistory = history
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .map((item) => ({ role: item.role as 'user' | 'assistant', content: item.content }));

  const completion = await openai.chat.completions.create({
    model: config.llm.model,
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content:
          'You are an administrative assistant for Vietnamese document review. Use only provided context. If information is missing, say it is unavailable in the document.',
      },
      {
        role: 'system',
        content: `Document context: ${JSON.stringify(context).slice(0, 14000)}`,
      },
      ...normalizedHistory,
      { role: 'user', content: message },
    ],
    max_tokens: 500,
  });

  return completion.choices[0]?.message?.content ?? 'No response';
}

export function computeOverallConfidence(
  classificationConfidence: number,
  extractionConfidence: number,
): number {
  return Number((classificationConfidence * 0.55 + extractionConfidence * 0.45).toFixed(2));
}
