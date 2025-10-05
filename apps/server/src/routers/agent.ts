import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { optionalAuthMiddleware } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import { streamSSE } from 'hono/streaming'
import { hfGenerateText, hfEmbed } from '../lib/hf'
import { search_places, nearby_places, build_route, map_suggest_viewport, type PlaceItem } from '../lib/tools'

const agent = new Hono()

// Schema definitions
const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().min(1),
  name: z.string().optional(),
})

const agentRequestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  userLocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
  context: z.record(z.string(), z.any()).optional(),
  stream: z.boolean().optional().default(true),
})

// LangGraph State Interface
interface AgentState {
  messages: Array<{ role: string; content: string; name?: string }>
  userLocation?: { lat: number; lng: number }
  context: Record<string, any>
  currentStep: string
  toolCalls: Array<{ tool: string; args: any; result?: any }>
  retrievedDocs: Array<{ content: string; metadata: any; score?: number }>
  finalResponse?: string
  error?: string
}

// Tool definitions for the agent
const AVAILABLE_TOOLS = {
  search_places: {
    name: 'search_places',
    description: 'Search for places in Bangkok by name, description, or categories. Returns up to 10 places.',
    parameters: {
      query: { type: 'string', description: 'Search query text' },
      categories: { type: 'array', items: { type: 'string' }, description: 'Optional categories to filter by' },
      limit: { type: 'number', description: 'Maximum number of results (default: 10)' },
    },
  },
  nearby_places: {
    name: 'nearby_places',
    description: 'Find places near a specific location within a radius.',
    parameters: {
      location: { type: 'object', properties: { lat: 'number', lng: 'number' }, description: 'Center location' },
      radius_km: { type: 'number', description: 'Search radius in kilometers (default: 5)' },
      limit: { type: 'number', description: 'Maximum number of results (default: 10)' },
    },
  },
  vector_search: {
    name: 'vector_search',
    description: 'Perform semantic vector search using embeddings to find relevant places.',
    parameters: {
      query: { type: 'string', description: 'Query text to embed and search' },
      top_k: { type: 'number', description: 'Number of results to return (default: 10)' },
    },
  },
  build_route: {
    name: 'build_route',
    description: 'Build an optimized route through multiple places using nearest-neighbor algorithm.',
    parameters: {
      place_slugs: { type: 'array', items: { type: 'string' }, description: 'Array of place slugs to route through' },
      origin: { type: 'object', properties: { lat: 'number', lng: 'number' }, description: 'Optional starting location' },
    },
  },
}

// RAG: Retrieve relevant documents using vector search
async function retrieveDocuments(query: string, topK = 5, minSimilarity = 0.35): Promise<Array<{ content: string; metadata: any; score?: number }>> {
  try {
    const queryEmbedding = await hfEmbed(query)
    
    // Try with similarity_threshold parameter (new version)
    let { data, error } = await supabase.rpc('match_places', {
      query_embedding: queryEmbedding as any,
      match_count: topK,
      search: null,
      similarity_threshold: minSimilarity,
    })

    // If error due to unknown parameter, retry without it
    if (error && error.message?.includes('similarity_threshold')) {
      console.warn('Falling back to match_places without threshold parameter')
      const result = await supabase.rpc('match_places', {
        query_embedding: queryEmbedding as any,
        match_count: topK,
        search: null,
      })
      data = result.data
      error = result.error
    }

    if (error || !data) {
      console.warn('Vector search failed:', error)
      return []
    }

    console.log(`Vector search found ${data.length} results for query: "${query}"`)

    // Client-side filtering to ensure quality
    const filtered = data.filter((item: any) => item.similarity >= minSimilarity)
    
    console.log(`After filtering (min similarity ${minSimilarity}): ${filtered.length} results`)

    return filtered.map((item: any) => ({
      content: `${item.name}: ${item.description || 'No description'}`,
      metadata: {
        id: item.id,
        name: item.name,
        tags: item.tags || [],
        lat: item.lat,
        lng: item.lng,
        similarity: item.similarity,
      },
      score: item.similarity,
    }))
  } catch (err) {
    console.error('Retrieval error:', err)
    return []
  }
}

// Execute tool calls
async function executeTool(toolName: string, args: any): Promise<any> {
  switch (toolName) {
    case 'search_places':
      return await search_places({
        query: args.query,
        categories: args.categories,
        limit: args.limit || 10,
      })

    case 'nearby_places':
      return await nearby_places({
        location: args.location,
        radius_km: args.radius_km,
        limit: args.limit || 10,
      })

    case 'vector_search': {
      const docs = await retrieveDocuments(args.query, args.top_k || 10, 0.35)
      return docs.map((d) => d.metadata)
    }

    case 'build_route': {
      // First fetch the places by slugs
      const { data: places, error } = await supabase
        .from('bangkok_unseen')
        .select('*')
        .in('id', args.place_slugs)
      
      if (error || !places) return { error: 'Failed to fetch places' }

      const placeItems: PlaceItem[] = places.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.id,
        lat: p.lat,
        lng: p.lng,
        tags: p.tags || [],
        price: p.price,
        image_url: p.image_url || '',
      }))

      return build_route({ places: placeItems, origin: args.origin })
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

// LangGraph Node: Analyze user intent and decide on tools
async function analyzeIntent(state: AgentState): Promise<Partial<AgentState>> {
  const lastMessage = state.messages[state.messages.length - 1]
  if (lastMessage.role !== 'user') {
    return { currentStep: 'generate' }
  }

  const content = lastMessage.content.toLowerCase()
  const toolsToCall: Array<{ tool: string; args: any }> = []

  // Intent detection patterns
  const hasLocation = state.userLocation !== undefined
  const wantsNearby = /(\b(near|nearby|around|close)\b|ใกล้|แถว)/i.test(content)
  const wantsRoute = /(\b(route|plan|itinerary|tour|trip)\b|แผน|เที่ยว)/i.test(content)
  const hasSearchTerms = content.length > 3

  // Determine which tools to use
  if (wantsNearby && hasLocation) {
    toolsToCall.push({
      tool: 'nearby_places',
      args: { location: state.userLocation, radius_km: 5, limit: 10 },
    })
  } else if (hasSearchTerms) {
    // Always do vector search for semantic understanding
    toolsToCall.push({
      tool: 'vector_search',
      args: { query: content, top_k: 10 },
    })
  }

  return {
    currentStep: toolsToCall.length > 0 ? 'retrieve' : 'generate',
    toolCalls: toolsToCall,
  }
}

// LangGraph Node: Retrieve information using tools and RAG
async function retrieve(state: AgentState): Promise<Partial<AgentState>> {
  const results: Array<{ tool: string; args: any; result: any }> = []
  const retrievedDocs: Array<{ content: string; metadata: any; score?: number }> = []

  // Execute all planned tool calls
  for (const toolCall of state.toolCalls) {
    try {
      const result = await executeTool(toolCall.tool, toolCall.args)
      results.push({ ...toolCall, result })

      // If it's a vector search, store as retrieved documents
      if (toolCall.tool === 'vector_search') {
        const lastMessage = state.messages[state.messages.length - 1].content
        const docs = await retrieveDocuments(lastMessage, toolCall.args.top_k || 10, 0.35)
        retrievedDocs.push(...docs)
      }
    } catch (err: any) {
      results.push({ ...toolCall, result: { error: err.message } })
    }
  }

  return {
    toolCalls: results,
    retrievedDocs: [...state.retrievedDocs, ...retrievedDocs],
    currentStep: 'generate',
  }
}

// LangGraph Node: Generate response using LLM with retrieved context
async function generate(state: AgentState): Promise<Partial<AgentState>> {
  try {
    // Build context from retrieved documents
    const contextDocs = state.retrievedDocs
      .slice(0, 5)
      .map((doc, i) => `[${i + 1}] ${doc.content}`)
      .join('\n')

    // Build tool results summary
    const toolResults = state.toolCalls
      .filter((tc) => tc.result && !tc.result.error)
      .map((tc) => {
        const res = tc.result
        if (Array.isArray(res)) {
          return `${tc.tool} found ${res.length} results: ${res.slice(0, 3).map((r: any) => r.name || r.slug || JSON.stringify(r)).join(', ')}`
        }
        return `${tc.tool}: ${JSON.stringify(res).slice(0, 100)}`
      })
      .join('\n')

    // System prompt with RAG context
    const systemPrompt = `You are TripPlannerAI, an expert travel assistant for Bangkok.

RETRIEVED CONTEXT:
${contextDocs || 'No specific context retrieved.'}

TOOL RESULTS:
${toolResults || 'No tools were used.'}

Instructions:
- Use the retrieved context and tool results to provide accurate, helpful responses
- Only reference places that appear in the context or tool results
- Be conversational and friendly
- If the user's language is Thai, respond in Thai
- Keep responses concise but informative`

    // Get conversation history
    const conversationHistory = state.messages
      .slice(-5) // Last 5 messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n')

    const userPrompt = `${conversationHistory}\n\nBased on the context and tool results above, provide a helpful response.`

    // Generate response
    const response = await hfGenerateText(userPrompt, {
      system: systemPrompt,
      max_new_tokens: 300,
      temperature: 0.7,
      retries: 2,
      timeout_ms: 20000,
    })

    return {
      finalResponse: response,
      currentStep: 'complete',
      messages: [...state.messages, { role: 'assistant', content: response }],
    }
  } catch (err: any) {
    return {
      error: err.message || 'Failed to generate response',
      currentStep: 'error',
    }
  }
}

// LangGraph workflow executor
async function runAgentGraph(initialState: AgentState): Promise<AgentState> {
  let state = { ...initialState }

  // Step 1: Analyze intent
  state = { ...state, ...(await analyzeIntent(state)) }

  // Step 2: Retrieve (if needed)
  if (state.currentStep === 'retrieve') {
    state = { ...state, ...(await retrieve(state)) }
  }

  // Step 3: Generate response
  if (state.currentStep === 'generate') {
    state = { ...state, ...(await generate(state)) }
  }

  return state
}

// POST /api/agent - RAG Agent endpoint with optional streaming
agent.post('/', optionalAuthMiddleware, zValidator('json', agentRequestSchema), async (c) => {
  const body = c.req.valid('json')
  const user = c.get('user')

  // Initialize agent state
  const initialState: AgentState = {
    messages: body.messages,
    userLocation: body.userLocation,
    context: body.context || {},
    currentStep: 'analyze',
    toolCalls: [],
    retrievedDocs: [],
  }

  // Streaming mode
  if (body.stream) {
    return streamSSE(c, async (stream) => {
      try {
        await stream.writeSSE({ event: 'start', data: JSON.stringify({ status: 'processing' }) })

        // Run the agent graph
        const finalState = await runAgentGraph(initialState)

        // Stream the steps
        await stream.writeSSE({
          event: 'tools',
          data: JSON.stringify({
            tools: finalState.toolCalls.map((tc) => ({ tool: tc.tool, args: tc.args })),
          }),
        })

        await stream.writeSSE({
          event: 'context',
          data: JSON.stringify({
            documents: finalState.retrievedDocs.length,
            top_docs: finalState.retrievedDocs.slice(0, 3).map((d) => d.metadata),
          }),
        })

        if (finalState.error) {
          await stream.writeSSE({ event: 'error', data: finalState.error })
        } else {
          await stream.writeSSE({ event: 'message', data: finalState.finalResponse || '' })
        }

        await stream.writeSSE({ event: 'done', data: 'ok' })
      } catch (err: any) {
        await stream.writeSSE({ event: 'error', data: err.message || 'Processing failed' })
      } finally {
        stream.close()
      }
    })
  }

  // Non-streaming mode
  try {
    const finalState = await runAgentGraph(initialState)

    if (finalState.error) {
      return c.json({ error: finalState.error }, 500)
    }

    return c.json({
      success: true,
      response: finalState.finalResponse,
      tools_used: finalState.toolCalls.map((tc) => tc.tool),
      documents_retrieved: finalState.retrievedDocs.length,
      user: user?.id || null,
    })
  } catch (err: any) {
    return c.json({ error: err.message || 'Agent processing failed' }, 500)
  }
})

// GET /api/agent/tools - List available tools
agent.get('/tools', (c) => {
  return c.json({
    tools: Object.values(AVAILABLE_TOOLS),
    count: Object.keys(AVAILABLE_TOOLS).length,
  })
})

// GET /api/agent/health - Health check
agent.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'agent', langgraph: 'active' })
})

export default agent