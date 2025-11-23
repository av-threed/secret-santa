import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_EMAIL = 'antonio.villasenor08@gmail.com';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Validate caller is signed in and is admin by email
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: authData } = await userClient.auth.getUser();
  const user = authData?.user || null;
  if (!user) return json({ error: 'Unauthorized' }, 401);
  const email = String(user.email || '').toLowerCase();
  if (email !== ADMIN_EMAIL.toLowerCase()) return json({ error: 'Forbidden' }, 403);

  const admin = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  try {
    switch (action) {
      case 'list_profiles': {
        const usersRes = await admin.auth.admin.listUsers();
        const users = (usersRes?.data?.users || []).map((u: any) => ({ id: u.id, email: u.email }));
        const { data: profs } = await admin.from('profiles').select('id, full_name');
        const idToName = Object.fromEntries((profs || []).map((p: any) => [p.id, p.full_name || null]));
        const rows = users.map((u: any) => ({ id: u.id, email: u.email, full_name: idToName[u.id] || null }));
        return json({ data: rows });
      }
      case 'list_kids': {
        const { data, error } = await admin.from('kids').select('id, name, created_at').order('name');
        if (error) throw error;
        return json({ data });
      }
      case 'add_kid': {
        const name = String(body?.name || '').trim();
        if (!name) return json({ error: 'Name required' }, 400);
        const { data, error } = await admin.from('kids').insert([{ name, created_by: user.id }]).select('id, name').single();
        if (error) throw error;
        return json({ data });
      }
      case 'rename_kid': {
        const id = body?.id; const name = String(body?.name || '').trim();
        if (!id || !name) return json({ error: 'id and name required' }, 400);
        const { data, error } = await admin.from('kids').update({ name }).eq('id', id).select('id, name').single();
        if (error) throw error;
        return json({ data });
      }
      case 'delete_kid': {
        const id = body?.id; if (!id) return json({ error: 'id required' }, 400);
        const { error } = await admin.from('kids').delete().eq('id', id);
        if (error) throw error;
        return json({ data: { id } });
      }
      case 'list_kid_gifts': {
        const kid_id = body?.kid_id; if (!kid_id) return json({ error: 'kid_id required' }, 400);
        const { data, error } = await admin
          .from('kid_gifts')
          .select('id, name, link, notes, price, kid_id, claimed_by, claimed_at')
          .eq('kid_id', kid_id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        const rows = data || [];
        const claimerIds = Array.from(new Set(rows.map((r: any) => r.claimed_by).filter(Boolean)));
        let idToName: Record<string, string|null> = {};
        if (claimerIds.length) {
          const { data: profs } = await admin.from('profiles').select('id, full_name').in('id', claimerIds);
          idToName = Object.fromEntries((profs || []).map((p: any) => [p.id, p.full_name || null]));
        }
        const result = rows.map((r: any) => ({ ...r, claimed_by_full_name: r.claimed_by ? (idToName[r.claimed_by] || null) : null }));
        return json({ data: result });
      }
      case 'update_kid_gift': {
        const id = body?.id; const fields = body?.fields || {};
        if (!id) return json({ error: 'id required' }, 400);
        const allowed: any = {};
        ['name', 'link', 'notes', 'price'].forEach(k => { if (typeof fields[k] !== 'undefined') allowed[k] = fields[k]; });
        if (Object.keys(allowed).length === 0) return json({ error: 'No fields' }, 400);
        const { data, error } = await admin.from('kid_gifts').update(allowed).eq('id', id).select('id').single();
        if (error) throw error;
        return json({ data });
      }
      case 'delete_kid_gift': {
        const id = body?.id; if (!id) return json({ error: 'id required' }, 400);
        const { error } = await admin.from('kid_gifts').delete().eq('id', id);
        if (error) throw error;
        return json({ data: { id } });
      }
      case 'clear_claim': {
        const id = body?.id; if (!id) return json({ error: 'id required' }, 400);
        const { data, error } = await admin.from('kid_gifts').update({ claimed_by: null, claimed_at: null }).eq('id', id).select('id').single();
        if (error) throw error;
        return json({ data });
      }
      case 'set_claim': {
        const id = body?.id; const user_id = body?.user_id;
        if (!id || !user_id) return json({ error: 'id and user_id required' }, 400);
        const { data, error } = await admin.from('kid_gifts').update({ claimed_by: user_id, claimed_at: new Date().toISOString() }).eq('id', id).select('id').single();
        if (error) throw error;
        return json({ data });
      }
      case 'get_app_settings': {
        const { data, error } = await admin.from('app_settings').select('key, value');
        if (error) throw error;
        return json({ data });
      }
      case 'set_app_setting': {
        const key = body?.key; const value = String(body?.value ?? '');
        if (!key) return json({ error: 'key required' }, 400);
        const { data, error } = await admin.from('app_settings').upsert([{ key, value }], { onConflict: 'key' }).select('key, value').single();
        if (error) throw error;
        return json({ data });
      }
      case 'list_assignments': {
        const year = parseInt(body?.year) || new Date().getFullYear();
        const { data, error } = await admin.from('assignments').select('buyer_user_id, recipient_user_id, year').eq('year', year);
        if (error) throw error;
        const rows = data || [];
        const userIds = Array.from(new Set(rows.flatMap((r: any) => [r.buyer_user_id, r.recipient_user_id]).filter(Boolean)));
        const { data: profs } = await admin.from('profiles').select('id, full_name').in('id', userIds);
        const idToName = Object.fromEntries((profs||[]).map((p:any)=>[p.id, p.full_name||null]));
        const result = rows.map((r:any)=>({ ...r, buyer_name: idToName[r.buyer_user_id] || null, recipient_name: r.recipient_user_id ? (idToName[r.recipient_user_id] || null) : null }));
        return json({ data: result });
      }
      case 'upsert_assignment': {
        const buyer_user_id = body?.buyer_user_id; const recipient_user_id = body?.recipient_user_id; const year = parseInt(body?.year) || new Date().getFullYear();
        if (!buyer_user_id || !recipient_user_id) return json({ error: 'buyer_user_id and recipient_user_id required' }, 400);
        // Ensure each recipient is assigned to only one buyer per year.
        await admin
          .from('assignments')
          .delete()
          .eq('year', year)
          .eq('recipient_user_id', recipient_user_id)
          .neq('buyer_user_id', buyer_user_id);
        const payload = [{ year, buyer_user_id, recipient_user_id }];
        const { data, error } = await admin
          .from('assignments')
          .upsert(payload, { onConflict: 'year,buyer_user_id' })
          .select('buyer_user_id, recipient_user_id, year')
          .single();
        if (error) throw error;
        return json({ data });
      }
      case 'delete_assignment': {
        const buyer_user_id = body?.buyer_user_id;
        const year = parseInt(body?.year) || new Date().getFullYear();
        if (!buyer_user_id) return json({ error: 'buyer_user_id required' }, 400);
        const { error } = await admin.from('assignments').delete().eq('buyer_user_id', buyer_user_id).eq('year', year);
        if (error) throw error;
        return json({ data: { buyer_user_id, year } });
      }
      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (e) {
    console.error('Admin function error:', e);
    const msg = e?.message || 'Server error';
    return json({ error: String(msg) }, 400);
  }
});


