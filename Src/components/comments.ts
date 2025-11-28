// src/api/comments.ts
const WP_BASE = 'https://noctimago.com';

export async function updateCommentApi(commentId: string, text: string, token?: string) {
  const res = await fetch(`${WP_BASE}/wp-json/app/v1/edit_comment/${commentId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ comment: text }),
  });

  let json: any = {};
  try { json = await res.json(); } catch {}
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
  return json;
}

export async function deleteCommentApi(commentId: string, token?: string) {
  const res = await fetch(`${WP_BASE}/wp-json/app/v1/delete_comment/${commentId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  let json: any = {};
  try { json = await res.json(); } catch {}
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
  return json;
}
