/**
 * Schedule Agent - Entry Point
 * A multi-agent scheduling system with chat-based interaction.
 * 
 * Usage:
 *   npm run dev              - Start in development mode (interactive CLI)
 *   npm run build            - Build TypeScript
 *   npm start                - Run built version
 */

import { runCLI } from './cli';

async function main() {
  console.log('Starting Schedule Agent...\n');
  
  try {
    await runCLI({
      welcomeMessage: `
╔══════════════════════════════════════════════════════════════╗
║         📅 Schedule Manager Agent - CLI Interface            ║
╠══════════════════════════════════════════════════════════════╣
║  我可以帮助你管理日程！                                        ║
║  输入 "help" 查看所有命令                                      ║
║  输入 "exit" 退出                                              ║
╚══════════════════════════════════════════════════════════════╝
`,
    });
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();