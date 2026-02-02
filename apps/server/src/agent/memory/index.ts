// Memory manager exports
export { SessionMemory } from "./session";
export { LongTermMemory } from "./longterm";

// Memory types
export interface Session {
	id: string;
	userId: string | null;
	createdAt: Date;
	updatedAt: Date;
	metadata: Record<string, any>;
}

export interface SessionMessage {
	id: string;
	sessionId: string;
	role: "user" | "assistant" | "system" | "tool";
	content: string;
	createdAt: Date;
}

export interface UserPreference {
	id: string;
	userId: string;
	key: string;
	value: any;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Unified Memory Manager
 * Combines session memory and long-term memory for the agent
 */
export class MemoryManager {
	private sessionId: string | null = null;
	private userId: string | null = null;

	constructor(options: { sessionId?: string; userId?: string } = {}) {
		this.sessionId = options.sessionId || null;
		this.userId = options.userId || null;
	}

	/**
	 * Initialize or get a session for the conversation
	 */
	async getOrCreateSession(): Promise<Session> {
		const { SessionMemory } = await import("./session");

		if (this.sessionId) {
			const session = await SessionMemory.getSession(this.sessionId);
			if (session) {
				return session;
			}
		}

		// Create new session
		const session = await SessionMemory.createSession({
			userId: this.userId || undefined,
		});

		this.sessionId = session.id;
		return session;
	}

	/**
	 * Add a message to the current session
	 */
	async addMessage(
		role: "user" | "assistant" | "system" | "tool",
		content: string
	): Promise<void> {
		if (!this.sessionId) {
			await this.getOrCreateSession();
		}

		const { SessionMemory } = await import("./session");
		await SessionMemory.addMessage({
			sessionId: this.sessionId!,
			role,
			content,
		});
	}

	/**
	 * Get conversation history for context
	 */
	async getConversationHistory(
		limit: number = 20
	): Promise<Array<{ role: string; content: string }>> {
		if (!this.sessionId) {
			return [];
		}

		const { SessionMemory } = await import("./session");
		return SessionMemory.getRecentMessages(this.sessionId, limit);
	}

	/**
	 * Get user preferences for personalization
	 */
	async getUserPreferences(): Promise<Record<string, any>> {
		if (!this.userId) {
			return {};
		}

		const { LongTermMemory } = await import("./longterm");
		return LongTermMemory.getAllPreferences(this.userId);
	}

	/**
	 * Set a user preference
	 */
	async setUserPreference(key: string, value: any): Promise<void> {
		if (!this.userId) {
			throw new Error("Cannot set preference without userId");
		}

		const { LongTermMemory } = await import("./longterm");
		await LongTermMemory.setPreference(this.userId, key, value);
	}

	/**
	 * Get combined context for the agent
	 * Includes conversation history and user preferences
	 */
	async getAgentContext(): Promise<{
		messages: Array<{ role: string; content: string }>;
		userPreferences: Record<string, any>;
		sessionId: string | null;
		userId: string | null;
	}> {
		const [messages, userPreferences] = await Promise.all([
			this.getConversationHistory(),
			this.getUserPreferences(),
		]);

		return {
			messages,
			userPreferences,
			sessionId: this.sessionId,
			userId: this.userId,
		};
	}

	/**
	 * Get the current session ID
	 */
	getSessionId(): string | null {
		return this.sessionId;
	}

	/**
	 * Set the session ID (for resuming sessions)
	 */
	setSessionId(sessionId: string): void {
		this.sessionId = sessionId;
	}

	/**
	 * Set the user ID (for authenticated users)
	 */
	setUserId(userId: string): void {
		this.userId = userId;
	}
}
