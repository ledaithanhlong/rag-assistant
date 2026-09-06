import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function DELETE(request, { params }) {
  const { id } = params;
  const { error } = await supabaseAdmin.from('chat_sessions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(request, { params }) {
  const { id } = params;
  const body = await request.json();
  if (!body.title) return NextResponse.json({ error: 'Thiếu title.' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('chat_sessions')
    .update({ title: body.title })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
