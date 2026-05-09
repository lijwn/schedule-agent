/**
 * CLI Chat Interface - Terminal-based chat interface for the Schedule Manager Agent.
 * Provides interactive chat experience for users.
 */

import inquirer from 'inquirer';
import { ScheduleManagerAgent } from '../agents/ScheduleManagerAgent';
import { Orchestrator } from '../core/Orchestrator';
import { CalendarAgent } from '../agents/CalendarAgent';
import { AgentRequest } from '../types';

export interface CLIConfig {
  welcomeMessage?: string;
  prompt?: string;
  maxHistory?: number;
}

/**
 * CLI Interface for Schedule Management Agent
 */
export class ScheduleCLI {
  private agent: ScheduleManagerAgent;
  private orchestrator: Orchestrator;
  private config: CLIConfig;
  private running: boolean = false;

  constructor(config?: CLIConfig) {
    this.config = {
      welcomeMessage: config?.welcomeMessage || this.getDefaultWelcome(),
      prompt: config?.prompt || '> ',
      maxHistory: config?.maxHistory || 50,
    };

    // Initialize orchestrator
    this.orchestrator = new Orchestrator();

    // Register sub-agents
    const calendarAgent = new CalendarAgent();
    this.orchestrator.register(calendarAgent);

    // Create main schedule manager agent
    this.agent = new ScheduleManagerAgent(this.orchestrator);
  }

  /**
   * Get default welcome message
   */
  private getDefaultWelcome(): string {
    return `
╔══════════════════════════════════════════════════════════════╗
║         📅 Schedule Manager Agent - CLI Interface            ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  我可以帮助你管理日程，包括：                                  ║
║                                                              ║
║    • 查看日程 - "查看我的日程"                                  ║
║    • 创建日程 - "安排明天下午3点会议"                            ║
║    • 修改日程 - "修改日程 evt-xxx"                              ║
║    • 删除日程 - "删除日程 evt-xxx"                              ║
║                                                              ║
║  输入 "help" 查看更多命令                                      ║
║  输入 "exit" 退出                                              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`;
  }

  /**
   * Start the CLI
   */
  async start(): Promise<void> {
    console.log(this.config.welcomeMessage);
    this.running = true;

    await this.mainLoop();
  }

  /**
   * Main interaction loop
   */
  private async mainLoop(): Promise<void> {
    while (this.running) {
      try {
        const { input } = await inquirer.prompt([
          {
            type: 'input',
            name: 'input',
            message: this.config.prompt,
            prefix: '👤 ',
          },
        ]);

        await this.processInput(input.trim());
      } catch (error) {
        if ((error as { isTtyError?: boolean }).isTtyError) {
          console.log('\n❌ Terminal error. Exiting.');
          break;
        } else if ((error as { message?: string }).message === 'User forced exit') {
          console.log('\n👋 再见！');
          break;
        } else {
          console.log(`\n❌ Error: ${error}`);
        }
      }
    }
  }

  /**
   * Process user input
   */
  private async processInput(input: string): Promise<void> {
    // Handle special commands
    if (!input) return;

    const lowerInput = input.toLowerCase();

    // Exit command
    if (lowerInput === 'exit' || lowerInput === 'quit' || lowerInput === '退出') {
      console.log('👋 再见！');
      this.running = false;
      return;
    }

    // Help command
    if (lowerInput === 'help' || lowerInput === '帮助') {
      this.printHelp();
      return;
    }

    // Clear command
    if (lowerInput === 'clear' || lowerInput === '清除') {
      console.clear();
      console.log(this.config.welcomeMessage);
      return;
    }

    // History command
    if (lowerInput === 'history' || lowerInput === '历史') {
      this.printHistory();
      return;
    }

    // Status command
    if (lowerInput === 'status' || lowerInput === '状态') {
      this.printStatus();
      return;
    }

    // Send to agent
    console.log('\n🤔 处理中...\n');

    const request: AgentRequest = {
      id: `req-${Date.now()}`,
      task: input,
      agentType: 'schedule-manager',
    };

    const response = await this.agent.handle(request);

    // Print response
    this.printResponse(response.result);
  }

  /**
   * Print agent response
   */
  private printResponse(result: unknown): void {
    if (!result) {
      console.log('❌ 无响应');
      return;
    }

    const response = result as { message?: string; requiresClarification?: boolean };

    if (response.message) {
      console.log(response.message);
    }

    console.log('');
  }

  /**
   * Print help information
   */
  private printHelp(): void {
    console.log(`
📖 可用命令:

  help / 帮助          - 显示帮助信息
  status / 状态        - 查看 agent 状态
  history / 历史       - 查看对话历史
  clear / 清除         - 清除屏幕
  exit / quit / 退出   - 退出程序

📝 示例对话:

  > 查看我的日程
  > 安排明天下午3点的团队会议
  > 创建 "项目评审会议" 在后天上午10点
  > 删除日程 evt-xxx
`);
  }

  /**
   * Print conversation history
   */
  private printHistory(): void {
    const history = this.agent.getHistory();
    const nonSystem = history.filter((msg) => msg.role !== 'system');

    if (nonSystem.length === 0) {
      console.log('暂无对话历史');
      return;
    }

    console.log('\n📜 对话历史:\n');
    nonSystem.forEach((msg) => {
      const prefix = msg.role === 'user' ? '👤 你' : '🤖 Agent';
      console.log(`${prefix}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
    });
    console.log('');
  }

  /**
   * Print agent status
   */
  private printStatus(): void {
    const agents = this.orchestrator.listAgents();

    console.log('\n🤖 Agent 状态:\n');
    console.log(`  核心 Agent: ${this.agent.name}`);
    console.log(`  类型: ${this.agent.type}\n`);

    console.log('  Sub-agents:\n');
    agents.forEach((a) => {
      console.log(`    • ${a.name} (${a.type})`);
      console.log(`      能力: ${a.capabilities.join(', ')}\n`);
    });
  }
}

/**
 * Run the CLI
 */
export async function runCLI(config?: CLIConfig): Promise<void> {
  const cli = new ScheduleCLI(config);
  await cli.start();
}