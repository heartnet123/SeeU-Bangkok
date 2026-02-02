// ResearcherAgent - Specialized in finding places and gathering information
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { RESEARCHER_TOOLS } from "../tools";

// Researcher agent configuration
const RESEARCHER_PROMPT = `You are a Bangkok Travel Research Expert. Your role is to find and gather information about places in Bangkok.

CAPABILITIES:
- Search for places by name, description, or category
- Find places near a specific location
- Perform semantic search to understand user intent

GUIDELINES:
1. When searching, consider synonyms and related terms
2. For location-based queries, always use nearby_places if user location is available
3. Use vector_search for understanding context and finding relevant places
4. Combine results from multiple searches when appropriate
5. Return comprehensive information about places found

RESPONSE FORMAT:
- Provide clear, organized results
- Include relevant details like name, location, and tags
- Highlight key features that match user's interests

Remember: You are gathering information for trip planning. Focus on relevance and quality.`;

// Create the researcher agent
export function createResearcherAgent(model?: ChatOpenAI) {
	const llm = model || new ChatOpenAI({
		modelName: "gpt-4o-mini",
		temperature: 0,
	});

	return createReactAgent({
		llm,
		tools: RESEARCHER_TOOLS,
		name: "researcher_agent",
		prompt: RESEARCHER_PROMPT,
	});
}

// Pre-built researcher agent instance
export const researcherAgent = createResearcherAgent();
