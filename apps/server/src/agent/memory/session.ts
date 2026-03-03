// Session memory - manages conversation sessions and message history
import { supabase } from "@/lib/supabase";
import type { Session, SessionMessage } from "./index";

export interface CreateSessionOptions {
	userId?: string;
	metadata?: Record<string, any>;
}

export interface AddMessageOptions {
	sessionId: string;
	role: "user" | "assistant" | "system" | "tool";
	content: string;
	name?: string;
}

/**
 * Session Memory Manager
 * Handles conversation session lifecycle and message history
 */
export class SessionMemory {
	/**
	 * Create a new conversation session
	 */
	static async createSession(options: CreateSessionOptions = {}): Promise<Session> {
		const { data, error } = await supabase
			.from("agent_sessions")
			.insert({
				user_id: options.userId || null,
				metadata: options.metadata || {},
			})
			.select()
			.single();

		if (error) {
			throw new Error(`Failed to create session: ${error.message}`);
		}

		return {
			id: data.id,
			userId: data.user_id,
			createdAt: new Date(data.created_at),
			updatedAt: new Date(data.updated_at),
			metadata: data.metadata,
		};
	}

	/**
	 * Get a session by ID
	 */
	static async getSession(sessionId: string): Promise<Session | null> {
		const { data, error } = await supabase
			.from("agent_sessions")
			.select()
			.eq("id", sessionId)
			.single();

		if (error) {
			if (error.code === "PGRST116") {
				return null; // Not found
			}
			throw new Error(`Failed to get session: ${error.message}`);
		}

		return {
			id: data.id,
			userId: data.user_id,
			createdAt: new Date(data.created_at),
			updatedAt: new Date(data.updated_at),
			metadata: data.metadata,
		};
	}

	/**
	 * Update session metadata
	 */
	static async updateSessionMetadata(
		sessionId: string,
		metadata: Record<string, any>
	): Promise<void> {
		const { error } = await supabase
			.from("agent_sessions")
			.update({ metadata })
			.eq("id", sessionId);

		if (error) {
			throw new Error(`Failed to update session: ${error.message}`);
		}
	}

	/**
	 * Add a message to a session
	 */
	static async addMessage(options: AddMessageOptions): Promise<SessionMessage> {
		const { data, error } = await supabase
			.from("agent_messages")
			.insert({
				session_id: options.sessionId,
				role: options.role,
				content: options.content,
				name: options.name || null,
			})
			.select()
			.single();

		if (error) {
			throw new Error(`Failed to add message: ${error.message}`);
		}

		return {
			id: data.id,
			sessionId: data.session_id,
			role: data.role,
			content: data.content,
			createdAt: new Date(data.created_at),
		};
	}

	/**
	 * Get all messages for a session
	 */
	static async getMessages(
		sessionId: string,
		options: { limit?: number; offset?: number } = {}
	): Promise<SessionMessage[]> {
		let query = supabase
			.from("agent_messages")
			.select()
			.eq("session_id", sessionId)
			.order("created_at", { ascending: true });

		if (options.limit) {
			query = query.limit(options.limit);
		}

		if (options.offset) {
			query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
		}

		const { data, error } = await query;

		if (error) {
			throw new Error(`Failed to get messages: ${error.message}`);
		}

		return data.map((msg) => ({
			id: msg.id,
			sessionId: msg.session_id,
			role: msg.role,
			content: msg.content,
			createdAt: new Date(msg.created_at),
		}));
	}

	/**
	 * Get recent messages for context window (for LLM)
	 */
	static async getRecentMessages(
		sessionId: string,
		limit: number = 20
	): Promise<Array<{ role: string; content: string }>> {
		const messages = await this.getMessages(sessionId, { limit });

		return messages.map((msg) => ({
			role: msg.role,
			content: msg.content,
		}));
	}

	/**
	 * Delete a session and all its messages (cascade)
	 */
	static async deleteSession(sessionId: string): Promise<void> {
		const { error } = await supabase
			.from("agent_sessions")
			.delete()
			.eq("id", sessionId);

		if (error) {
			throw new Error(`Failed to delete session: ${error.message}`);
		}
	}

	/**
	 * Get all sessions for a user
	 */
	static async getUserSessions(
		userId: string,
		options: { limit?: number } = {}
	): Promise<Session[]> {
		let query = supabase
			.from("agent_sessions")
			.select()
			.eq("user_id", userId)
			.order("updated_at", { ascending: false });

		if (options.limit) {
			query = query.limit(options.limit);
		}

		const { data, error } = await query;

		if (error) {
			throw new Error(`Failed to get user sessions: ${error.message}`);
		}

		return data.map((session) => ({
			id: session.id,
			userId: session.user_id,
			createdAt: new Date(session.created_at),
			updatedAt: new Date(session.updated_at),
			metadata: session.metadata,
		}));
	}
}
