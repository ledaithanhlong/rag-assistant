import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(request, { params }) {
  const { id } = params;
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('id, title, content, file_url, hidden, sort_order, created_at')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  return NextResponse.json({ document: data });
}

export async function PATCH(request, { params }) {
  const { id } = params;
  const body = await request.json();
  const patch = {};
  if (typeof body.hidden === 'boolean') patch.hidden = body.hidden;
  if (typeof body.sort_order === 'number') patch.sort_order = body.sort_order;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Không có trường nào để cập nhật.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('documents').update(patch).eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
