-- ============================================================
-- Sistema de producción Wanderwarm · esquema de Supabase
-- Correr una vez en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Perfiles: uno por persona que entra al sistema (se crea solo al registrarse)
create table if not exists public.perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null default '',
  email text not null default '',
  rol text not null default 'produccion' check (rol in ('direccion','produccion','taller','chofer')),
  taller_id text,
  activo boolean not null default true,
  color text default '#E2412A',
  creado timestamptz default now()
);

-- Datos del sistema. Cada fila guarda el objeto completo en `data` (jsonb).
create table if not exists public.materiales (id text primary key, data jsonb not null, actualizado timestamptz default now());
create table if not exists public.productos  (id text primary key, data jsonb not null, actualizado timestamptz default now());
create table if not exists public.talleres   (id text primary key, data jsonb not null, actualizado timestamptz default now());
create table if not exists public.ordenes    (id text primary key, data jsonb not null, actualizado timestamptz default now());
create table if not exists public.viajes     (id text primary key, data jsonb not null, actualizado timestamptz default now());

-- Rol de quien está haciendo la consulta
create or replace function public.mi_rol() returns text language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid() and activo
$$;
create or replace function public.mi_taller() returns text language sql stable security definer set search_path = public as $$
  select taller_id from perfiles where id = auth.uid() and activo
$$;

-- Al crear un usuario en Authentication, se crea su perfil. El PRIMERO es Dirección.
create or replace function public.nuevo_perfil() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, email, nombre, rol)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)),
          case when (select count(*) from perfiles) = 0 then 'direccion' else 'produccion' end);
  return new;
end $$;
drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users for each row execute function public.nuevo_perfil();

-- ---------- Permisos (Row Level Security) ----------
alter table public.perfiles   enable row level security;
alter table public.materiales enable row level security;
alter table public.productos  enable row level security;
alter table public.talleres   enable row level security;
alter table public.ordenes    enable row level security;
alter table public.viajes     enable row level security;

-- Perfiles: todos los activos se ven entre sí; solo Dirección cambia roles.
drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles for select using (mi_rol() is not null);
drop policy if exists perfiles_editar on public.perfiles;
create policy perfiles_editar on public.perfiles for update using (mi_rol() = 'direccion');

-- Catálogo (materiales, productos, talleres): leen todos; editan Dirección y Producción.
do $$ declare t text; begin
  foreach t in array array['materiales','productos','talleres'] loop
    execute format('drop policy if exists %1$s_leer on public.%1$s', t);
    execute format('create policy %1$s_leer on public.%1$s for select using (mi_rol() is not null)', t);
    execute format('drop policy if exists %1$s_escribir on public.%1$s', t);
    execute format($p$create policy %1$s_escribir on public.%1$s for all using (mi_rol() in ('direccion','produccion')) with check (mi_rol() in ('direccion','produccion'))$p$, t);
  end loop;
end $$;

-- Órdenes: leen todos; crean y editan Dirección y Producción; borra solo Dirección.
-- Los talleres registran entregas con la función registrar_entrega (abajo).
drop policy if exists ordenes_leer on public.ordenes;
create policy ordenes_leer on public.ordenes for select using (mi_rol() is not null);
drop policy if exists ordenes_crear on public.ordenes;
create policy ordenes_crear on public.ordenes for insert with check (mi_rol() in ('direccion','produccion'));
drop policy if exists ordenes_editar on public.ordenes;
create policy ordenes_editar on public.ordenes for update using (mi_rol() in ('direccion','produccion'));
drop policy if exists ordenes_borrar on public.ordenes;
create policy ordenes_borrar on public.ordenes for delete using (mi_rol() = 'direccion');

-- Viajes: leen Dirección, Producción y Chofer; cargan los tres; borra Dirección.
drop policy if exists viajes_leer on public.viajes;
create policy viajes_leer on public.viajes for select using (mi_rol() in ('direccion','produccion','chofer'));
drop policy if exists viajes_crear on public.viajes;
create policy viajes_crear on public.viajes for insert with check (mi_rol() in ('direccion','produccion','chofer'));
drop policy if exists viajes_editar on public.viajes;
create policy viajes_editar on public.viajes for update using (mi_rol() in ('direccion','produccion'));
drop policy if exists viajes_borrar on public.viajes;
create policy viajes_borrar on public.viajes for delete using (mi_rol() = 'direccion');

-- Un taller solo puede sumar entregas de SU taller a órdenes que estén en SU etapa.
create or replace function public.registrar_entrega(p_orden text, p_evento jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_taller text := mi_taller(); v_tipo text; v_etapa int; v_data jsonb;
begin
  if mi_rol() is distinct from 'taller' or v_taller is null then raise exception 'Solo talleres'; end if;
  select data->>'tipo' into v_tipo from talleres where id = v_taller;
  select data into v_data from ordenes where id = p_orden for update;
  if v_data is null then raise exception 'Orden inexistente'; end if;
  v_etapa := (v_data->>'etapa')::int;
  if v_etapa <> case v_tipo when 'corte' then 2 when 'confeccion' then 3 else 4 end then raise exception 'La orden no está en tu etapa'; end if;
  if (p_evento->>'unidades')::int <= 0 then raise exception 'Unidades inválidas'; end if;
  p_evento := p_evento || jsonb_build_object('tipo','entrega','tallerId',v_taller,'etapa',v_etapa,'por',auth.uid());
  update ordenes set data = jsonb_set(data, '{historial}', coalesce(data->'historial','[]'::jsonb) || p_evento), actualizado = now() where id = p_orden;
end $$;
grant execute on function public.registrar_entrega(text, jsonb) to authenticated;

-- Cambios en vivo
alter publication supabase_realtime add table public.ordenes, public.viajes, public.talleres, public.productos, public.materiales, public.perfiles;

-- ---------- Agregado v2: procesos (estándares) y ajustes ----------
create table if not exists public.procesos (id text primary key, data jsonb not null, actualizado timestamptz default now());
create table if not exists public.ajustes  (id text primary key, data jsonb not null, actualizado timestamptz default now());
alter table public.procesos enable row level security;
alter table public.ajustes  enable row level security;
drop policy if exists procesos_leer on public.procesos;
create policy procesos_leer on public.procesos for select using (mi_rol() is not null);
drop policy if exists procesos_escribir on public.procesos;
create policy procesos_escribir on public.procesos for all using (mi_rol() in ('direccion','produccion')) with check (mi_rol() in ('direccion','produccion'));
drop policy if exists ajustes_leer on public.ajustes;
create policy ajustes_leer on public.ajustes for select using (mi_rol() is not null);
drop policy if exists ajustes_escribir on public.ajustes;
create policy ajustes_escribir on public.ajustes for all using (mi_rol() = 'direccion') with check (mi_rol() = 'direccion');
alter publication supabase_realtime add table public.procesos, public.ajustes;
