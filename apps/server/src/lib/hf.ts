/**
 * Hugging Face Inference SDK client wrappers for text and embeddings
 */
import { HfInference } from '@huggingface/inference'
import OpenAI from 'openai'

export interface HFOptions {
  model?: string
  max_new_tokens?: number
  temperature?: number
  system?: string
  timeout_ms?: number
  retries?: number
}

export async function hfGenerateText(input: string, opts: HFOptions = {}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  const model = opts.model || process.env.OPENAI_TEXT_MODEL || 'gpt-5-nano-2025-08-07'
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

  const baseURL = process.env.OPENAI_BASE_URL // optional (Azure/proxy)
  const client = new OpenAI({ apiKey, baseURL })

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
  if (opts.system) {
    messages.push({ role: 'system', content: opts.system })
  }
  messages.push({ role: 'user', content: input })

  const requestOptions: any = {}
  if (opts.timeout_ms) requestOptions.timeout = opts.timeout_ms

  const res = await client.chat.completions.create({
    model,
    messages,
    max_tokens: typeof opts.max_new_tokens === 'number' ? opts.max_new_tokens : 512,
    temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.3,
  }, requestOptions)

  const content = res?.choices?.[0]?.message?.content
  if (content) return content
  return JSON.stringify(res)
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

// Embeddings via HF feature-extraction pipeline
export interface HFEmbedOptions {
  model?: string
  timeout_ms?: number
}

export async function hfEmbed(text: string, opts: HFEmbedOptions = {}): Promise<number[]> {
  // Switch to OpenAI Embeddings API per request
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  const baseURL = process.env.OPENAI_BASE_URL // optional (Azure/proxy)
  const model = opts.model || process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small'

  const client = new OpenAI({ apiKey, baseURL })
  const requestOptions: any = {}
  if (opts.timeout_ms) requestOptions.timeout = opts.timeout_ms

  const resp = await client.embeddings.create({ model, input: text }, requestOptions)
  const vec = resp?.data?.[0]?.embedding
  if (!vec || !Array.isArray(vec)) {
    throw new Error('OpenAI returned no embedding vector')
  }
  return vec as number[]
}
