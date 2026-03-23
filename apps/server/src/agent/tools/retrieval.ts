// Retrieval tools - Vector search and document retrieval
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { traceable } from "langsmith/traceable";
import { supabase } from "@/lib/supabase";
import { openaiEmbed } from "@/lib/openai";
import type { RetrievedDoc } from "../state";

interface MatchPlaceRow {
  id: string;
  name: string;
  description?: string | null;
  tags?: string[] | null;
  lat?: number | null;
  lng?: number | null;
  similarity: number;
}

// Retrieve documents using vector search
export const retrieveDocuments = traceable(
	async (
		query: string,
		topK = 5,
		minSimilarity = 0.20 // Lowered from 0.35 - Thai text embeddings often have lower similarity scores
	): Promise<RetrievedDoc[]> => {
		try {
			const queryEmbedding = await openaiEmbed(query);

			// Try with similarity_threshold parameter (new version)
			// Use a lower threshold (0.15) for better recall with Thai text
			let { data, error } = await supabase.rpc("match_places", {
				query_embedding: queryEmbedding,
				match_count: topK,
				search: null,
				similarity_threshold: 0.15, // Lower threshold for initial retrieval
			});

			// If error due to unknown parameter, retry without it
			if (error && error.message?.includes("similarity_threshold")) {
				console.warn(
					"Falling back to match_places without threshold parameter"
				);
				const result = await supabase.rpc("match_places", {
					query_embedding: queryEmbedding,
					match_count: topK,
					search: null,
				});
				data = result.data;
				error = result.error;
			}

			if (error || !data) {
				console.warn("Vector search failed:", error);
				return [];
			}

			// Client-side filtering to ensure quality
			const filtered = (data as MatchPlaceRow[]).filter(
				(item: MatchPlaceRow) => item.similarity >= minSimilarity
			);

			return filtered.map((item: MatchPlaceRow) => ({
				content: `${item.name}: ${item.description || "No description"}`,
				metadata: {
					id: item.id,
					name: item.name,
					tags: item.tags || [],
					lat: item.lat,
					lng: item.lng,
					similarity: item.similarity,
				},
				score: item.similarity,
			}));
		} catch (err) {
			console.error("Retrieval error:", err);
			return [];
		}
	},
	{ name: "tools.retrieve_documents", run_type: "retriever" }
);

// Vector search tool for LangGraph
export const vectorSearchTool = tool(
	async (input) => {
		const results = await retrieveDocuments(input.query, input.top_k);
		return JSON.stringify(results);
	},
	{
		name: "vector_search",
		description:
			"Perform semantic vector search using embeddings to find relevant places. Best for understanding user intent and finding contextually relevant results.",
		schema: z.object({
			query: z.string().describe("Query text to embed and search"),
			top_k: z
				.number()
				.optional()
				.default(10)
				.describe("Number of results to return"),
		}),
	}
);
