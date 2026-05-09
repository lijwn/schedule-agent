/**
 * Configuration file for Schedule Agent
 * Edit this file to configure your agent
 */

export interface AgentConfig {
  // LLM Configuration
  llm: {
    // Enable LLM features (requires API key)
    enabled: boolean;
    
    // LLM Provider: 'openai' | 'anthropic' | 'ollama'
    provider: 'openai' | 'anthropic' | 'ollama';
    
    // API Key (or set via OPENAI_API_KEY env variable)
    apiKey?: string;
    
    // Model to use
    model: string;
    
    // Temperature (0-1)
    temperature: number;
    
    // Base URL (for proxies or custom endpoints)
    baseUrl?: string;
  };
  
  // Agent Configuration
  agent: {
    // Default timeout for agent responses (ms)
    timeout: number;
    
    // Max conversation history length
    maxHistoryLength: number;
  };
}

/**
 * Default configuration
 */
export const defaultConfig: AgentConfig = {
  llm: {
    enabled: false,  // Set to true to enable LLM
    provider: 'openai',
    apiKey: undefined,  // Set your API key here, or use OPENAI_API_KEY env
    model: 'gpt-4o-mini',
    temperature: 0.7,
    baseUrl: undefined,
  },
  agent: {
    timeout: 30000,
    maxHistoryLength: 50,
  },
};

/**
 * Get configuration (merges with defaults)
 */
export function getConfig(): AgentConfig {
  // Try to load from config file, fall back to defaults
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const userConfig = require('./config.user');
    return {
      ...defaultConfig,
      ...userConfig,
      llm: {
        ...defaultConfig.llm,
        ...(userConfig.llm || {}),
      },
      agent: {
        ...defaultConfig.agent,
        ...(userConfig.agent || {}),
      },
    };
  } catch {
    return defaultConfig;
  }
}