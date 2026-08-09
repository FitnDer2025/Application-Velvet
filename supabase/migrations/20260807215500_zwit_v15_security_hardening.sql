-- Zwit v1.5 — durcissement post-déploiement.
-- La fonction de trigger n'est pas une RPC cliente : elle reste utilisable par le trigger
-- mais ne doit jamais être invocable directement depuis l'API Supabase.

revoke all on function public.zwit_v15_enforce_conversation_request() from public;
revoke all on function public.zwit_v15_enforce_conversation_request() from anon;
revoke all on function public.zwit_v15_enforce_conversation_request() from authenticated;
