import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function GET(request, { params }) {
  const { id } = params;
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('id, role, content, sources, created_at')
    .eq('session_id', id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}
