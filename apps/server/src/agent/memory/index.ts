// Memory manager exports - will be implemented in Wave 3
// export { MemoryManager } from "./manager";
// export { SessionMemory } from "./session";
// export { LongTermMemory } from "./longterm";

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
