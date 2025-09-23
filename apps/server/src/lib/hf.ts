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
  const token = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_API_KEY
  const model = opts.model || process.env.HF_TEXT_MODEL || 'HuggingFaceH4/zephyr-7b-beta'
  if (!token) throw new Error('HUGGINGFACE_API_TOKEN (or HF_API_KEY) is not set')

  const hf = new HfInference(token)
  const res = await hf.textGeneration({
    model,
    inputs: opts.system ? `${opts.system}\n\n${input}` : input,
    parameters: {
      max_new_tokens: typeof opts.max_new_tokens === 'number' ? opts.max_new_tokens : 512,
      temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.3,
      return_full_text: false,
    },
  }) as any

  if (typeof res?.generated_text === 'string') return res.generated_text
  if (Array.isArray(res)) return String(res[0]?.generated_text ?? '')
  const nested = res?.choices?.[0]?.text ?? res?.choices?.[0]?.message?.content
  if (nested) return String(nested)
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
