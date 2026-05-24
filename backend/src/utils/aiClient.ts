import fetch from 'node-fetch';

// ════ TIPOS ════════════════════════════════════════════════════════════════

export type AIModelProvider = 'claude' | 'openai' | 'gemini' | 'groq' | 'mistral' | 'deepseek';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  model: AIModelProvider;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AIClientConfig {
  provider: AIModelProvider;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// ════ CLIENTE BASE ════════════════════════════════════════════════════════

abstract class AIClient {
  protected config: AIClientConfig;

  constructor(config: AIClientConfig) {
    this.config = config;
  }

  abstract sendMessage(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse>;
}

// ════ CLAUDE (Anthropic) ══════════════════════════════════════════════════

class ClaudeClient extends AIClient {
  async sendMessage(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: this.config.maxTokens || 1024,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`);
    }

    const data: any = await response.json();
    return {
      content: data.content[0]?.text || '',
      model: 'claude',
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      },
    };
  }
}

// ════ OPENAI (GPT) ════════════════════════════════════════════════════════

class OpenAIClient extends AIClient {
  async sendMessage(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse> {
    const allMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4-turbo',
        messages: allMessages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 1024,
      }),
    });

    if (!response.ok) {
      const error: any = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data: any = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      model: 'openai',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      },
    };
  }
}

// ════ GOOGLE GEMINI ═══════════════════════════════════════════════════════

class GeminiClient extends AIClient {
  async sendMessage(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse> {
    const systemInstruction = systemPrompt ? { text: systemPrompt } : undefined;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${
        this.config.model || 'gemini-2.0-flash'
      }:generateContent?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: systemInstruction,
          contents: messages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            temperature: this.config.temperature || 0.7,
            maxOutputTokens: this.config.maxTokens || 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data: any = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      content,
      model: 'gemini',
      usage: {
        inputTokens: data.usageMetadata?.prompt_token_count || 0,
        outputTokens: data.usageMetadata?.candidates_token_count || 0,
      },
    };
  }
}

// ════ GROQ ═══════════════════════════════════════════════════════════════

class GroqClient extends AIClient {
  async sendMessage(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse> {
    const allMessages = systemPrompt
      ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
      : messages;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'mixtral-8x7b-32768',
        messages: allMessages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.statusText}`);
    }

    const data: any = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      model: 'groq',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      },
    };
  }
}

// ════ MISTRAL ═════════════════════════════════════════════════════════════

class MistralClient extends AIClient {
  async sendMessage(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse> {
    const allMessages = systemPrompt
      ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
      : messages;

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'mistral-large-latest',
        messages: allMessages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.statusText}`);
    }

    const data: any = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      model: 'mistral',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      },
    };
  }
}

// ════ DEEPSEEK ════════════════════════════════════════════════════════════

class DeepSeekClient extends AIClient {
  async sendMessage(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse> {
    const allMessages = systemPrompt
      ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
      : messages;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'deepseek-chat',
        messages: allMessages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`);
    }

    const data: any = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      model: 'deepseek',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      },
    };
  }
}

// ════ FACTORY ══════════════════════════════════════════════════════════════

export function createAIClient(config: AIClientConfig): AIClient {
  switch (config.provider) {
    case 'claude':
      return new ClaudeClient(config);
    case 'openai':
      return new OpenAIClient(config);
    case 'gemini':
      return new GeminiClient(config);
    case 'groq':
      return new GroqClient(config);
    case 'mistral':
      return new MistralClient(config);
    case 'deepseek':
      return new DeepSeekClient(config);
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}

// ════ SINGLETON MANAGER ════════════════════════════════════════════════════

let currentClient: AIClient | null = null;
let currentProvider: AIModelProvider | null = null;

export function initializeAIClient(config: AIClientConfig): void {
  if (!config.apiKey) {
    console.warn(`⚠️ No API key provided for ${config.provider}. AI features disabled.`);
    currentClient = null;
    return;
  }

  try {
    currentClient = createAIClient(config);
    currentProvider = config.provider;
    console.log(`✅ AI Client initialized: ${config.provider}`);
  } catch (error) {
    console.error(`❌ Failed to initialize AI client: ${error}`);
    currentClient = null;
  }
}

export async function callAI(
  messages: AIMessage[],
  systemPrompt?: string
): Promise<AIResponse | null> {
  if (!currentClient) {
    console.warn('⚠️ AI client not initialized');
    return null;
  }

  try {
    return await currentClient.sendMessage(messages, systemPrompt);
  } catch (error) {
    console.error(`❌ AI API error:`, error);
    return null;
  }
}

export function getActiveProvider(): AIModelProvider | null {
  return currentProvider;
}

export function isAIEnabled(): boolean {
  return currentClient !== null;
}

// ════ ENVIRONMENT DETECTION ════════════════════════════════════════════════

export function detectAndInitializeAI(): void {
  const env = process.env;

  // Intenta en orden de preferencia
  if (env.ANTHROPIC_API_KEY) {
    initializeAIClient({
      provider: 'claude',
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.CLAUDE_MODEL,
    });
  } else if (env.OPENAI_API_KEY) {
    initializeAIClient({
      provider: 'openai',
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || 'gpt-4-turbo',
    });
  } else if (env.GOOGLE_API_KEY) {
    initializeAIClient({
      provider: 'gemini',
      apiKey: env.GOOGLE_API_KEY,
      model: env.GEMINI_MODEL || 'gemini-2.0-flash',
    });
  } else if (env.GROQ_API_KEY) {
    initializeAIClient({
      provider: 'groq',
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL || 'mixtral-8x7b-32768',
    });
  } else if (env.MISTRAL_API_KEY) {
    initializeAIClient({
      provider: 'mistral',
      apiKey: env.MISTRAL_API_KEY,
      model: env.MISTRAL_MODEL || 'mistral-large-latest',
    });
  } else if (env.DEEPSEEK_API_KEY) {
    initializeAIClient({
      provider: 'deepseek',
      apiKey: env.DEEPSEEK_API_KEY,
      model: env.DEEPSEEK_MODEL || 'deepseek-chat',
    });
  } else {
    console.warn('⚠️ No AI API keys found. AI features disabled.');
  }
}
