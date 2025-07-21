
import { CoreMessage, streamText } from 'ai';
// import { openai } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

// const MODEL = "google/gemini-2.5-flash";
// const MODEL = "google/gemini-2.5-pro";
const MODEL = "anthropic/claude-3-7-sonnet";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

export async function POST(req: Request) {
  const { messages }: { messages: CoreMessage[] } = await req.json();

  // 添加数据分析系统提示词
  const systemMessage: CoreMessage = {
    role: 'system',
    content: `你是一个专业的数据分析助手。你的任务是帮助用户分析上传的数据文件。

能力说明：
1. 能够理解和分析 CSV、Excel 等格式的数据文件
2. 基于 DuckDB 数据库引擎的 SUMMARIZE 结果进行分析
3. 能够解答关于数据结构、数据内容、数据趋势等问题
4. 可以提供数据可视化建议
5. 支持中文交流

回答原则：
- 基于用户上传的实际数据进行分析
- 提供准确、有用的数据洞察
- 使用简洁明了的语言解释复杂的数据概念
- 主动提供数据分析建议和最佳实践
- 如果数据有异常值或模式，主动指出

请始终以友好、专业的态度回答用户的问题。`
  };

  // 将系统消息添加到消息列表开头（如果还没有系统消息）
  const hasSystemMessage = messages.some(msg => msg.role === 'system');
  const finalMessages = hasSystemMessage ? messages : [systemMessage, ...messages];

  const result = await streamText({
    model: openrouter.chat(MODEL),
    messages: finalMessages,
  });

  return result.toDataStreamResponse();
}

