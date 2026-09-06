import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('id, title, hidden, sort_order, created_at')
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ documents: data });
}

export async function DELETE(request) {
  const body = await request.json();

  if (body.all) {
    // Xóa toàn bộ tài liệu (và chunks liên quan qua cascade)
    const { error } = await supabaseAdmin.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: 'Thiếu id tài liệu.' }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from('documents').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
