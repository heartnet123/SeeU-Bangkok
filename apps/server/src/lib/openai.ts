/**
 * OpenAI client wrappers for text generation and embeddings
 */
import OpenAI from 'openai'

export interface OpenAIOptions {
  model?: string
  max_completion_tokens?: number
  temperature?: number
  system?: string
  timeout_ms?: number
  retries?: number
}

export async function openaiGenerateText(input: string, opts: OpenAIOptions = {}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  const model = opts.model || 'gpt-4o-mini'
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
    max_completion_tokens: typeof opts.max_completion_tokens === 'number' ? opts.max_completion_tokens : 512,
    temperature: typeof opts.temperature === 'number' ? opts.temperature : 1,
  }, requestOptions)

  const content = res?.choices?.[0]?.message?.content
  if (content) return content
  return JSON.stringify(res)
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

// Embeddings via OpenAI Embeddings API
export interface OpenAIEmbedOptions {
  model?: string
  timeout_ms?: number
}

export async function openaiEmbed(text: string, opts: OpenAIEmbedOptions = {}): Promise<number[]> {
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