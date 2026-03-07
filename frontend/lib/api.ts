export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ChatRequest {
  message: string;
  conversationId?: string;
  apiKey: string;
  model: string;
}

export const chatApi = {
  sendMessage: async (
    data: ChatRequest,
  ): Promise<ReadableStream<Uint8Array>> => {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.body) {
      throw new Error("No response body");
    }

    return response.body;
  },
};
