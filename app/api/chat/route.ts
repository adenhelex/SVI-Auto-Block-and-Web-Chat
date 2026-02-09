import { NextRequest, NextResponse } from 'next/server';
import { runChatFlow, type AiProvider, type ChatFlowOptions } from '@/lib/chat-flow';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const aiProvider = (body.aiProvider as AiProvider) || 'gemini';
    const history = Array.isArray(body.history)
      ? (body.history as { role: string; content: string }[]).filter(
          (e) => typeof e?.role === 'string' && typeof e?.content === 'string'
        )
      : undefined;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const opts: ChatFlowOptions | undefined = history?.length ? { history } : undefined;
    const responseBody = await runChatFlow(message, aiProvider, opts);
    return NextResponse.json({ responseBody });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to process chat request',
      },
      { status: 500 }
    );
  }
}
