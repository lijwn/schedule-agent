/**
 * Configuration file for Schedule Agent
 * Reads from external config.json file
 */

import * as fs from 'fs';
import * as path from 'path';

export interface AgentConfig {
  llm: {
    enabled: boolean;
    provider: 'openai' | 'anthropic' | 'ollama';
    apiKey?: string;
    model: string;
    temperature: number;
    baseUrl?: string;
  };
  agent: {
    timeout: number;
    maxHistoryLength: number;
  };
}

const DEFAULT_CONFIG: AgentConfig = {
  llm: {
    enabled: false,
    provider: 'openai',
    apiKey: undefined,
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
 * Get config from external config.json file
 */
export function getConfig(): AgentConfig {
  try {
    const configPath = path.resolve(process.cwd(), 'config.json');
    
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      const userConfig = JSON.parse(fileContent) as Partial<AgentConfig>;
      
      return {
        ...DEFAULT_CONFIG,
        ...userConfig,
        llm: {
          ...DEFAULT_CONFIG.llm,
          ...(userConfig.llm || {}),
          // Environment variables override config file
          apiKey: process.env.OPENAI_API_KEY || userConfig.llm?.apiKey,
        },
        agent: {
          ...DEFAULT_CONFIG.agent,
          ...(userConfig.agent || {}),
        },
      };
    }
  } catch (error) {
    console.warn('[Config] Failed to load config.json, using defaults:', error);
  }
  
  // Fallback to environment variables only
  if (process.env.OPENAI_API_KEY) {
    return {
      ...DEFAULT_CONFIG,
      llm: {
        ...DEFAULT_CONFIG.llm,
        enabled: true,
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || DEFAULT_CONFIG.llm.model,
        baseUrl: process.env.OPENAI_BASE_URL,
      },
    };
  }
  
  return DEFAULT_CONFIG;
}