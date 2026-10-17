/** Canonical message kept in the conversation history sent to the backend. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** A tool the backend reported having executed for a turn. */
export interface ToolUsed {
  name: string;
  arguments: Record<string, unknown>;
}

/** A UI action emitted by the backend (F3: navigation/filtering). */
export interface CopilotAction {
  type: string;
  [key: string]: unknown;
}

/** Response shape of POST copilot_chat. */
export interface CopilotChatResponse {
  answer: string;
  actions: CopilotAction[];
  provider: string;
  model: string;
  tools_used: ToolUsed[];
  usage: { input: number; output: number };
  conversation: unknown[];
}

/** A bubble rendered in the chat transcript. */
export interface ChatBubble {
  id: number;
  role: "user" | "assistant";
  text: string;
  toolsUsed?: ToolUsed[];
  error?: boolean;
  pending?: boolean;
}
