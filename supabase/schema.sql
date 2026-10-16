-- ============================================================
-- Sistema de producción Wanderwarm · esquema de Supabase (v3)
-- Roles: superadmin (Stoka) · direccion (admin) · produccion · taller · chofer
-- Cada tabla de negocio guarda el objeto completo en `data` (jsonb),
-- con validaciones en la base y permisos por fila (RLS).
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Perfiles ----------
create table if not exists public.perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null default '',
  email text not null default '',
  rol text check (rol in ('superadmin','direccion','produccion','taller','chofer')),
  taller_id text,
  activo boolean not null default false,
  color text not null default '#E2412A',
  creado timestamptz not null default now(),
  constraint taller_requiere_taller check (rol is distinct from 'taller' or taller_id is not null)
);

-- ---------- Datos de negocio ----------
create table if not exists public.materiales (id text primary key, data jsonb not null, actualizado timestamptz not null default now());
create table if not exists public.productos  (id text primary key, data jsonb not null, actualizado timestamptz not null default now());
create table if not exists public.talleres   (id text primary key, data jsonb not null, actualizado timestamptz not null default now());
create table if not exists public.ordenes    (id text primary key, data jsonb not null, actualizado timestamptz not null default now());
create table if not exists public.viajes     (id text primary key, data jsonb not null, actualizado timestamptz not null default now());
create table if not exists public.procesos   (id text primary key, data jsonb not null, actualizado timestamptz not null default now());
create table if not exists public.ajustes    (id text primary key, data jsonb not null, actualizado timestamptz not null default now());

create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  tabla text not null, registro text not null, accion text not null,
  usuario uuid default auth.uid(), cuando timestamptz not null default now(),
  antes jsonb
);
create index if not exists auditoria_cuando on public.auditoria (cuando desc);

-- ---------- Funciones de rol ----------
create or replace function public.mi_rol() returns text language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid() and activo
$$;
create or replace function public.mi_taller() returns text language sql stable security definer set search_path = public as $$
  select taller_id from perfiles where id = auth.uid() and activo
$$;
create or replace function public.es_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol() in ('superadmin','direccion'), false)
$$;
create or replace function public.es_gestion() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol() in ('superadmin','direccion','produccion'), false)
$$;

-- ---------- Validaciones ----------
create or replace function public.lineas_validas(l jsonb) returns boolean language sql immutable as $$
  select jsonb_typeof(l) = 'array' and jsonb_array_length(l) > 0
    and not exists (select 1 from jsonb_array_elements(l) x
      where coalesce(x->>'productoId','') = '' or coalesce(x->>'talle','') = ''
         or (x->>'cantidad') !~ '^[0-9]+$' or (x->>'cantidad')::int <= 0 or (x->>'cantidad')::int > 100000)
$$;
create or replace function public.paradas_validas(p jsonb) returns boolean language sql immutable as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) between 1 and 40
    and not exists (select 1 from jsonb_array_elements(p) x
      where coalesce(x->>'lugarId','') = ''
         or exists (select 1 from jsonb_array_elements(coalesce(x->'movs','[]'::jsonb)) m
            where m->>'tipo' not in ('deja','retira') or coalesce(m->>'ordenId','') = ''
               or (m->>'unidades') !~ '^[0-9]+$' or (m->>'unidades')::int > 100000))
$$;

do $$ begin
  alter table public.ordenes add column if not exists numero int generated always as ((data->>'numero')::int) stored;
  alter table public.ordenes add column if not exists etapa int generated always as ((data->>'etapa')::int) stored;
  alter table public.viajes add column if not exists fecha date generated always as ((data->>'fecha')::date) stored;
exception when others then null; end $$;
create unique index if not exists ordenes_numero_unico on public.ordenes (numero);
create index if not exists viajes_fecha on public.viajes (fecha desc);

alter table public.ordenes drop constraint if exists orden_valida;
alter table public.ordenes add constraint orden_valida check (
  jsonb_typeof(data) = 'object' and data->>'id' = id
  and coalesce(trim(data->>'cliente'),'') <> '' and data->>'tipo' in ('venta','stock')
  and (data->>'etapa')::int between 0 and 7 and (data->>'numero')::int > 0
  and (data->>'fechaEntrega') ~ '^\d{4}-\d{2}-\d{2}$' and lineas_validas(data->'lineas')
  and jsonb_typeof(coalesce(data->'historial','[]')) = 'array' and jsonb_typeof(coalesce(data->'calidad','[]')) = 'array');
alter table public.viajes drop constraint if exists viaje_valido;
alter table public.viajes add constraint viaje_valido check (
  jsonb_typeof(data) = 'object' and data->>'id' = id and (data->>'fecha') ~ '^\d{4}-\d{2}-\d{2}$'
  and data->>'estado' in ('en_curso','cerrado') and paradas_validas(data->'paradas')
  and (data->>'kmInicio' is null or data->>'kmFin' is null or (data->>'kmFin')::numeric >= (data->>'kmInicio')::numeric));
do $$ declare t text; begin
  foreach t in array array['materiales','productos','talleres','procesos'] loop
    execute format('alter table public.%1$s drop constraint if exists %1$s_valido', t);
    execute format($c$alter table public.%1$s add constraint %1$s_valido check (jsonb_typeof(data) = 'object' and data->>'id' = id and coalesce(trim(coalesce(data->>'nombre', data->>'titulo')),'') <> '')$c$, t);
  end loop;
end $$;

-- Número de orden: si el que manda la app ya existe (dos personas a la vez), se asigna el siguiente.
create or replace function public.numerar_orden() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.data->>'numero') is null or exists (select 1 from ordenes where numero = (new.data->>'numero')::int and id <> new.id) then
    new.data := jsonb_set(new.data, '{numero}', to_jsonb(coalesce((select max(numero) from ordenes), 0) + 1));
  end if;
  return new;
end $$;
drop trigger if exists numerar on public.ordenes;
create trigger numerar before insert on public.ordenes for each row execute function public.numerar_orden();

create or replace function public.tocar() returns trigger language plpgsql as $$ begin new.actualizado := now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['materiales','productos','talleres','ordenes','viajes','procesos','ajustes'] loop
    execute format('drop trigger if exists tocar on public.%I', t);
    execute format('create trigger tocar before update on public.%I for each row execute function public.tocar()', t);
  end loop;
end $$;

-- ---------- Perfiles: alta y protección ----------
-- Toda cuenta nueva nace SIN rol e inactiva. Solo un admin la habilita (función `usuarios`).
create or replace function public.nuevo_perfil() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, email, nombre) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users for each row execute function public.nuevo_perfil();

create or replace function public.proteger_perfil() returns trigger language plpgsql security definer set search_path = public as $$
declare r text := mi_rol();
begin
  if auth.uid() is null then return new; end if; -- service role / SQL
  if r is distinct from 'superadmin' and (old.rol = 'superadmin' or new.rol = 'superadmin') then raise exception 'Solo un super admin puede cambiar a un super admin'; end if;
  if old.id = auth.uid() and (new.rol is distinct from old.rol or new.activo is distinct from old.activo) then raise exception 'No podés cambiar tu propio rol ni desactivarte'; end if;
  if new.email is distinct from old.email then raise exception 'El mail se cambia desde la cuenta'; end if;
  return new;
end $$;
drop trigger if exists proteger on public.perfiles;
create trigger proteger before update on public.perfiles for each row execute function public.proteger_perfil();

-- ---------- Auditoría ----------
create or replace function public.auditar() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria (tabla, registro, accion, antes)
  values (tg_table_name, coalesce(new.id, old.id)::text, lower(tg_op), case when tg_op = 'DELETE' then to_jsonb(old) end);
  return coalesce(new, old);
end $$;
do $$ declare t text; begin
  foreach t in array array['materiales','productos','talleres','ordenes','viajes','procesos','ajustes','perfiles'] loop
    execute format('drop trigger if exists auditar on public.%I', t);
    execute format('create trigger auditar after insert or update or delete on public.%I for each row execute function public.auditar()', t);
  end loop;
end $$;

-- ---------- Permisos (RLS) ----------
alter table public.perfiles   enable row level security;
alter table public.materiales enable row level security;
alter table public.productos  enable row level security;
alter table public.talleres   enable row level security;
alter table public.ordenes    enable row level security;
alter table public.viajes     enable row level security;
alter table public.procesos   enable row level security;
alter table public.ajustes    enable row level security;
alter table public.auditoria  enable row level security;

-- Perfiles
drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles for select to authenticated using (id = auth.uid() or es_gestion());
drop policy if exists perfiles_editar on public.perfiles;
create policy perfiles_editar on public.perfiles for update to authenticated using (es_admin()) with check (es_admin());

-- Catálogo
drop policy if exists materiales_leer on public.materiales;
create policy materiales_leer on public.materiales for select to authenticated using (es_gestion());
drop policy if exists productos_leer on public.productos;
create policy productos_leer on public.productos for select to authenticated using (es_gestion());
drop policy if exists talleres_leer on public.talleres;
create policy talleres_leer on public.talleres for select to authenticated using (mi_rol() is not null);
drop policy if exists procesos_leer on public.procesos;
create policy procesos_leer on public.procesos for select to authenticated using (mi_rol() is not null);
do $$ declare t text; begin
  foreach t in array array['materiales','productos','talleres','procesos'] loop
    execute format('drop policy if exists %1$s_escribir on public.%1$s', t);
    execute format('drop policy if exists %1$s_editar on public.%1$s', t);
    execute format('drop policy if exists %1$s_borrar on public.%1$s', t);
    execute format('create policy %1$s_escribir on public.%1$s for insert to authenticated with check (es_gestion())', t);
    execute format('create policy %1$s_editar on public.%1$s for update to authenticated using (es_gestion()) with check (es_gestion())', t);
    execute format('create policy %1$s_borrar on public.%1$s for delete to authenticated using (es_admin())', t);
  end loop;
end $$;

-- Productos para talleres y chofer: solo nombre y talles, sin costos.
create or replace function public.catalogo_basico() returns jsonb language sql stable security definer set search_path = public as $$
  select case when mi_rol() is null then '[]'::jsonb else coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'nombre', data->>'nombre', 'codigo', data->>'codigo', 'categoria', data->>'categoria', 'tipoPrenda', data->>'tipoPrenda',
    'color', data->>'color', 'talles', data->'talles', 'personalizacion', data->>'personalizacion', 'foto', data->>'foto')), '[]'::jsonb) end
  from productos
$$;

-- Órdenes: el taller solo ve las que tiene asignadas.
create or replace function public.orden_de_mi_taller(d jsonb) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from jsonb_each_text(coalesce(d->'asignacion','{}'::jsonb)) e where e.value = mi_taller())
$$;
drop policy if exists ordenes_leer on public.ordenes;
create policy ordenes_leer on public.ordenes for select to authenticated using (es_gestion() or mi_rol() = 'chofer' or (mi_rol() = 'taller' and orden_de_mi_taller(data)));
drop policy if exists ordenes_crear on public.ordenes;
create policy ordenes_crear on public.ordenes for insert to authenticated with check (es_gestion());
drop policy if exists ordenes_editar on public.ordenes;
create policy ordenes_editar on public.ordenes for update to authenticated using (es_gestion()) with check (es_gestion());
drop policy if exists ordenes_borrar on public.ordenes;
create policy ordenes_borrar on public.ordenes for delete to authenticated using (es_admin());

-- Viajes: el chofer carga los suyos y puede sumar paradas mientras el viaje está en curso.
drop policy if exists viajes_leer on public.viajes;
create policy viajes_leer on public.viajes for select to authenticated using (es_gestion() or mi_rol() = 'chofer');
drop policy if exists viajes_crear on public.viajes;
create policy viajes_crear on public.viajes for insert to authenticated with check (es_gestion() or (mi_rol() = 'chofer' and data->>'choferId' = auth.uid()::text));
drop policy if exists viajes_editar on public.viajes;
create policy viajes_editar on public.viajes for update to authenticated
  using (es_gestion() or (mi_rol() = 'chofer' and data->>'choferId' = auth.uid()::text and actualizado > now() - interval '3 days'))
  with check (es_gestion() or (mi_rol() = 'chofer' and data->>'choferId' = auth.uid()::text));
drop policy if exists viajes_borrar on public.viajes;
create policy viajes_borrar on public.viajes for delete to authenticated using (es_admin());

-- Ajustes y auditoría
drop policy if exists ajustes_leer on public.ajustes;
create policy ajustes_leer on public.ajustes for select to authenticated using (mi_rol() is not null);
drop policy if exists ajustes_escribir on public.ajustes;
drop policy if exists ajustes_crear on public.ajustes;
drop policy if exists ajustes_editar on public.ajustes;
create policy ajustes_crear on public.ajustes for insert to authenticated with check (es_admin());
create policy ajustes_editar on public.ajustes for update to authenticated using (es_admin()) with check (es_admin());
drop policy if exists auditoria_leer on public.auditoria;
create policy auditoria_leer on public.auditoria for select to authenticated using (es_admin());

-- ---------- Viajes → asignación de talleres ----------
-- Cuando la camioneta DEJA mercadería de una orden en un taller, ese taller queda asignado
-- a la etapa que hace (corte, confección o personalización), si todavía no tenía uno.
create or replace function public.asignar_por_viaje() returns trigger language plpgsql security definer set search_path = public as $$
declare p jsonb; m jsonb; v_tipo text; v_etapa text;
begin
  for p in select * from jsonb_array_elements(new.data->'paradas') loop
    select data->>'tipo' into v_tipo from talleres where id = p->>'lugarId';
    continue when v_tipo is null;
    v_etapa := (case v_tipo when 'corte' then '2' when 'confeccion' then '3' else '4' end);
    for m in select * from jsonb_array_elements(coalesce(p->'movs','[]'::jsonb)) loop
      if m->>'tipo' = 'deja' then
        update ordenes set data = jsonb_set(data, '{asignacion}', coalesce(data->'asignacion','{}'::jsonb) || jsonb_build_object(v_etapa, p->>'lugarId'))
        where id = m->>'ordenId' and coalesce(data->'asignacion'->>v_etapa, '') = '';
      end if;
    end loop;
  end loop;
  return new;
end $$;
drop trigger if exists asignar on public.viajes;
create trigger asignar after insert or update on public.viajes for each row execute function public.asignar_por_viaje();

-- ---------- Entregas de talleres ----------
-- Un taller solo suma entregas de SU taller a órdenes asignadas a él en la etapa actual.
create or replace function public.registrar_entrega(p_orden text, p_evento jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_taller text := mi_taller(); v_tipo text; v_etapa int; v_data jsonb; v_asig text; v_total int; v_ya int; v_u int;
begin
  if mi_rol() is distinct from 'taller' or v_taller is null then raise exception 'Solo los talleres usan esta función'; end if;
  select data->>'tipo' into v_tipo from talleres where id = v_taller;
  select data into v_data from ordenes where id = p_orden for update;
  if v_data is null then raise exception 'La orden no existe'; end if;
  v_etapa := (v_data->>'etapa')::int;
  if v_etapa <> (case v_tipo when 'corte' then 2 when 'confeccion' then 3 else 4 end) then raise exception 'La orden no está en la etapa de tu taller'; end if;
  v_asig := v_data->'asignacion'->>(v_etapa::text);
  if v_asig is distinct from v_taller then raise exception 'Esta orden no está asignada a tu taller'; end if;
  v_u := nullif(p_evento->>'unidades','')::int;
  if v_u is null or v_u <= 0 then raise exception 'Las unidades tienen que ser mayores a cero'; end if;
  select coalesce(sum((x->>'cantidad')::int),0) into v_total from jsonb_array_elements(v_data->'lineas') x;
  select coalesce(sum((e->>'unidades')::int),0) into v_ya from jsonb_array_elements(coalesce(v_data->'historial','[]')) e
    where e->>'tipo' = 'entrega' and (e->>'etapa')::int = v_etapa and e->>'tallerId' = v_taller;
  if v_ya + v_u > v_total then raise exception 'Supera las % unidades de la orden (ya informaste %)', v_total, v_ya; end if;
  p_evento := p_evento || jsonb_build_object('tipo','entrega','tallerId',v_taller,'etapa',v_etapa,'por',auth.uid(),'ts',(extract(epoch from now())*1000)::bigint);
  update ordenes set data = jsonb_set(data, '{historial}', coalesce(data->'historial','[]'::jsonb) || p_evento) where id = p_orden;
end $$;
revoke all on function public.registrar_entrega(text, jsonb) from public, anon;
grant execute on function public.registrar_entrega(text, jsonb) to authenticated;

-- ---------- Secretos (clave de la API de Anthropic) ----------
-- Se guardan cifrados en Supabase Vault. Solo el super admin los escribe y nadie los lee desde la app:
-- la función `asistente` los lee del lado del servidor.
create or replace function public.guardar_secreto(p_nombre text, p_valor text) returns void
language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid;
begin
  if mi_rol() is distinct from 'superadmin' then raise exception 'Solo el super admin'; end if;
  if p_nombre not in ('anthropic_api_key') then raise exception 'Nombre no permitido'; end if;
  select id into v_id from vault.secrets where name = 'wander_' || p_nombre;
  if coalesce(p_valor,'') = '' then
    if v_id is not null then delete from vault.secrets where id = v_id; end if; return;
  end if;
  if length(p_valor) < 20 or length(p_valor) > 400 then raise exception 'La clave no parece válida'; end if;
  if v_id is null then perform vault.create_secret(p_valor, 'wander_' || p_nombre, 'Clave de ' || p_nombre);
  else perform vault.update_secret(v_id, p_valor); end if;
end $$;
create or replace function public.estado_secretos() returns table (nombre text, final text, actualizado timestamptz)
language plpgsql security definer set search_path = public, vault as $$
begin
  if mi_rol() is distinct from 'superadmin' then raise exception 'Solo el super admin'; end if;
  return query select replace(s.name,'wander_',''), right(d.decrypted_secret, 4), s.updated_at
    from vault.secrets s join vault.decrypted_secrets d on d.id = s.id where s.name like 'wander_%';
end $$;
create or replace function public.leer_secreto(p_nombre text) returns text
language plpgsql security definer set search_path = public, vault as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'No permitido'; end if;
  return (select decrypted_secret from vault.decrypted_secrets where name = 'wander_' || p_nombre limit 1);
end $$;
revoke all on function public.guardar_secreto(text,text), public.estado_secretos(), public.leer_secreto(text), public.catalogo_basico() from public, anon;
grant execute on function public.guardar_secreto(text,text), public.estado_secretos(), public.catalogo_basico() to authenticated;
grant execute on function public.leer_secreto(text) to service_role;
revoke execute on function public.leer_secreto(text) from authenticated;

-- Las funciones auxiliares no se llaman desde la app
revoke all on function public.nuevo_perfil(), public.proteger_perfil(), public.auditar(), public.asignar_por_viaje(), public.numerar_orden() from public, anon, authenticated;

-- ---------- Cambios en vivo ----------
do $$ begin
  alter publication supabase_realtime add table public.ordenes, public.viajes, public.talleres, public.productos, public.materiales, public.perfiles, public.procesos, public.ajustes;
exception when others then null; end $$;

-- ---------- Endurecimiento ----------
revoke execute on function public.mi_rol(), public.mi_taller(), public.es_admin(), public.es_gestion(), public.orden_de_mi_taller(jsonb), public.lineas_validas(jsonb), public.paradas_validas(jsonb) from public, anon;
grant execute on function public.mi_rol(), public.mi_taller(), public.es_admin(), public.es_gestion(), public.orden_de_mi_taller(jsonb) to authenticated;
alter policy perfiles_leer on public.perfiles using (id = (select auth.uid()) or es_gestion());
alter policy viajes_crear on public.viajes with check (es_gestion() or (mi_rol() = 'chofer' and data->>'choferId' = (select auth.uid())::text));
alter policy viajes_editar on public.viajes
  using (es_gestion() or (mi_rol() = 'chofer' and data->>'choferId' = (select auth.uid())::text and actualizado > now() - interval '3 days'))
  with check (es_gestion() or (mi_rol() = 'chofer' and data->>'choferId' = (select auth.uid())::text));
