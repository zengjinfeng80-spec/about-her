import { adminClient, requireUser } from '../_shared/auth.ts';
import { corsHeaders, errorResponse, json } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return errorResponse(new Error('只支持 POST'), 405);
  try {
    const { user } = await requireUser(request);
    const admin = adminClient();
    const { data: attachments, error: attachmentError } = await admin.from('attachments').select('storage_path').eq('user_id', user.id);
    if (attachmentError) throw new Error(attachmentError.message);
    const paths = (attachments ?? []).map((item) => item.storage_path);
    if (paths.length) {
      const { error: removeError } = await admin.storage.from('memory-media').remove(paths);
      if (removeError) throw new Error(removeError.message);
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw new Error(deleteError.message);
    return json({ deleted: true });
  } catch (error) { return errorResponse(error); }
});
