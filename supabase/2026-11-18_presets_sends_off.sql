-- EUCL: todos los presets de la nube con envíos a 0, retornos al 100%,
-- salas con su tiempo por defecto (Room 1 s, Hall 3,5 s, Cathedral 8 s).
-- Respaldo previo: supabase/backup/eucl_presets-2026-11-18.json (repo EUCL)
update eucl_presets set data = data || jsonb_build_object(
  'chSends', (select jsonb_agg(coalesce(e,'{}'::jsonb) || '{"sA":0,"sB":0,"sC":0,"sD":0}'::jsonb) from jsonb_array_elements(coalesce(data->'chSends','[{},{},{},{}]'::jsonb)) e),
  'gfx', coalesce(data->'gfx','{}'::jsonb) || jsonb_build_object(
     'revA', coalesce(data->'gfx'->'revA','{"dest":"M"}'::jsonb) || '{"mix":1,"size":0.5943,"pre":0.02}'::jsonb,
     'revB', coalesce(data->'gfx'->'revB','{"dest":"M"}'::jsonb) || '{"mix":1,"size":0.7018,"pre":0.02}'::jsonb,
     'revC', coalesce(data->'gfx'->'revC','{"dest":"B"}'::jsonb) || '{"mix":1,"size":0.6941,"pre":0.03}'::jsonb,
     'delay', coalesce(data->'gfx'->'delay','{}'::jsonb) || '{"mix":1}'::jsonb));
select count(*) as presets from eucl_presets;
