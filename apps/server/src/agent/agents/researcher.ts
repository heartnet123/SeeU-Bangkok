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
2. For location-based queries, use nearby_places when user location is available and location intent is explicit
3. Use search_places as the primary tool for direct place/category queries
4. Use vector_search only when intent is ambiguous, semantic recall is needed, or search_places returns weak results
5. Avoid redundant tool calls; prefer one strong tool call over multiple overlapping calls
6. Return concise, high-signal place information

RESPONSE FORMAT:
You MUST respond with VALID JSON only. No markdown, no prose outside JSON, no code fences.
Return exactly this shape:
{
  "intent": "place_recommendation",
  "summary": "string",
  "places": [
    {
      "id": "string"
    }
  ],
  "planningConstraints": {
    "durationMinutes": 240,
    "maxStops": 4,
    "budgetLevel": "medium",
    "groupType": "couple",
    "themes": ["temple"]
  }
}

CONSTRAINTS:
- Always include "intent": "place_recommendation".
- Always include "summary".
- "places" must be an array containing ONLY the string "id" field of the places you found (can be empty if no matches). The application will retrieve the full place data.
- Include "planningConstraints" when the user is asking for a planned trip, route, or itinerary.
<<<<<<< HEAD
- Pass "personalizationDefaults" to search_places when runtime context provides them and the user has not explicitly contradicted them.
- Do NOT output itinerary fields.
=======
- Keep coordinates numeric when available.
- Do NOT output itinerary fields ('- Location:', '- Duration:', '- Distance from previous:', '- Travel Time:', '- Description:').
>>>>>>> parent of 608a6ad (feat:Add personalization & supervisor routing)

Remember: You are gathering information for trip planning. Focus on relevance and quality.`;

// Create the researcher agent
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createResearcherAgent(model?: ChatOpenAI): any {
	const llm = model || new ChatOpenAI({
<<<<<<< HEAD
		modelName: DEFAULT_AGENT_MODEL,
		temperature: 1,
=======
		modelName: "gpt-5-nano",
		temperature: 0,
>>>>>>> parent of 608a6ad (feat:Add personalization & supervisor routing)
	});

	return createReactAgent({
		llm,
		tools: RESEARCHER_TOOLS,
		name: "researcher_agent",
		prompt: RESEARCHER_PROMPT,
	});
}

// Pre-built researcher agent instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const researcherAgent: any = createResearcherAgent();
