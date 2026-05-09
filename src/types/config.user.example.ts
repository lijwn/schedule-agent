/**
 * 用户配置文件 - User Configuration
 * 
 * 复制此文件为 config.user.ts 并修改配置
 * Copy this file to config.user.ts and modify the settings
 */

import { AgentConfig } from './config';

export const config: AgentConfig = {
  // LLM 配置
  llm: {
    // 启用 LLM 功能 (需要 API Key)
    enabled: true,
    
    // LLM 提供商: 'openai' | 'anthropic' | 'ollama'
    provider: 'openai',
    
    // API Key (可选，也可以在环境变量中设置 OPENAI_API_KEY)
    apiKey: 'your-api-key-here',
    
    // 使用的模型
    model: 'gpt-4o-mini',
    
    // Temperature (0-1, 越高越有创意)
    temperature: 0.7,
    
    // 自定义 API 地址 (用于代理)
    baseUrl: undefined,
  },
  
  // Agent 配置
  agent: {
    // 响应超时时间 (毫秒)
    timeout: 30000,
    
    // 最大对话历史长度
    maxHistoryLength: 50,
  },
};