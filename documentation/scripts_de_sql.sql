-- TODOS EL CÓDIGO FUE EJECUTADO DE MANERA SECUENCIAL EN Supabase

CREATE TABLE public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_key TEXT UNIQUE NOT NULL, -- Ej: 'librarian', 'cyberpunk'
    title TEXT NOT NULL,
    steam_appid BIGINT,
    developer TEXT NOT NULL DEFAULT 'Indie Developer',
    publisher TEXT NOT NULL DEFAULT 'Indie Publisher',
    genre TEXT NOT NULL DEFAULT 'Acción',
    release_date TEXT,
    cover_image_url TEXT,
    header_banner_url TEXT,
    description TEXT,
    latest_official_version TEXT NOT NULL DEFAULT '1.0.0',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    download_url TEXT NOT NULL,
    executable_relative_path TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    request_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.installation_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE UNIQUE,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1. Habilitar RLS en las tablas
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_recipes ENABLE ROW LEVEL SECURITY;

-- 2. Permitir LECTURA PÚBLICA (SELECT) a la App Cliente sin autenticación
CREATE POLICY "Permitir lectura publica de juegos activos" 
ON public.games FOR SELECT 
TO anon, authenticated 
USING (is_active = true);

CREATE POLICY "Permitir lectura publica de recetas" 
ON public.installation_recipes FOR SELECT 
TO anon, authenticated 
USING (true);

-- 3. Bloquear ESCRITURA/MODIFICACIÓN a usuarios anon (Solo administradores autenticados)
-- Al no crear políticas de INSERT/UPDATE/DELETE para 'anon', PostgreSQL bloquea cualquier intento automáticamente.

-- Insertar juego de prueba
INSERT INTO public.games (game_key, title, steam_appid, developer, genre, download_url, executable_relative_path)
VALUES (
    'librarian',
    'Librarian: Tidy Up the Arcane Library!',
    1091500,
    'Arcane Games',
    'Aventura',
    'https://drive.google.com/file/d/1iK4zCpfqz-E8bsrCWo8knvHYZhzZRjX0/view?usp=drive_link',
    'Librarian.exe'
) RETURNING id;

select * from public.games;

-- Insertar su receta asociada usando la subconsulta dinámica
INSERT INTO public.installation_recipes (game_id, steps)
VALUES (
    (SELECT id FROM public.games WHERE game_key = 'librarian' LIMIT 1),
    '[
        { "action": "stream_extract", "provider": "GoogleDrive" },
        { "action": "add_defender_exclusion", "path": "{INSTALL_DIR}" },
        { "action": "create_shortcut", "shortcut_name": "Librarian" }
    ]'::jsonb
);

-- Permitir a Administradores (autenticados) INSERTAR, EDITAR y BORRAR en la tabla 'games'
CREATE POLICY "Permitir insercion a administradores" 
ON public.games FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir edicion a administradores" 
ON public.games FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Permitir eliminacion a administradores" 
ON public.games FOR DELETE 
TO authenticated 
USING (true);

-- Permitir a Administradores (autenticados) INSERTAR, EDITAR y BORRAR en 'installation_recipes'
CREATE POLICY "Permitir insercion de recetas a administradores" 
ON public.installation_recipes FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir edicion de recetas a administradores" 
ON public.installation_recipes FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Permitir eliminacion de recetas a administradores" 
ON public.installation_recipes FOR DELETE 
TO authenticated 
USING (true);

ALTER TABLE games ADD COLUMN logo_image_url TEXT;

-- Agregar columnas faltantes para metadatos completos del UX
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS developer_logo_url TEXT,
ADD COLUMN IF NOT EXISTS publisher_logo_url TEXT,
ADD COLUMN IF NOT EXISTS icon_url TEXT,
ADD COLUMN IF NOT EXISTS save_path_pattern TEXT,
ADD COLUMN IF NOT EXISTS dlcs JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS controller_support BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS requirements JSONB NOT NULL DEFAULT '{"min": "OS: Windows 10 64-bit | RAM: 8 GB", "rec": "OS: Windows 11 64-bit | RAM: 16 GB"}'::jsonb,
ADD COLUMN IF NOT EXISTS screenshots JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Agregar columnas para versiones múltiples e historial de parches (Changelog)
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS available_versions JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS changelog JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Permitir a usuarios anónimos (clientes de la app) incrementar el contador de peticiones de actualización
CREATE POLICY "Permitir a usuarios solicitar actualizacion de juego"
ON public.games FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Tabla para almacenar solicitudes de versiones específicas con mensajes de usuarios
CREATE TABLE IF NOT EXISTS public.version_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    version_requested TEXT NOT NULL,
    custom_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS en version_requests
ALTER TABLE public.version_requests ENABLE ROW LEVEL SECURITY;

-- Permitir a cualquiera insertar una solicitud de versión
CREATE POLICY "Permitir a usuarios solicitar version de juego"
ON public.version_requests FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Permitir a administradores ver todas las solicitudes
CREATE POLICY "Permitir a autenticados ver solicitudes de version"
ON public.version_requests FOR SELECT
TO authenticated
USING (true);

-- 1. Eliminar las columnas JSON obsoletas de la tabla 'games'
ALTER TABLE games
DROP COLUMN available_versions,
DROP COLUMN changelog,
DROP COLUMN dlcs;

-- 2. Crear la nueva tabla relacional 'game_versions'
CREATE TABLE game_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    version_name TEXT NOT NULL,
    build_id TEXT,
    release_date DATE,
    download_url TEXT,
    is_available BOOLEAN DEFAULT false,
    changelog_title TEXT,
    changelog_body TEXT,
    source TEXT DEFAULT 'steam_event',
    event_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Crear una restricción única (Unique Constraint)
ALTER TABLE game_versions
ADD CONSTRAINT uq_game_version UNIQUE (game_id, version_name);

-- 4. Crear políticas RLS para 'game_versions'
ALTER TABLE game_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read game versions" ON game_versions FOR SELECT USING (true);
CREATE POLICY "Permitir insercion de game_versions a administradores" ON game_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir edicion de game_versions a administradores" ON game_versions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir eliminacion de game_versions a administradores" ON game_versions FOR DELETE TO authenticated USING (true);

-- 5. Crear tabla del catálogo maestro de DLCs
CREATE TABLE dlcs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE dlcs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read dlcs" ON dlcs FOR SELECT USING (true);
CREATE POLICY "Permitir insercion de dlcs a administradores" ON dlcs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir edicion de dlcs a administradores" ON dlcs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir eliminacion de dlcs a administradores" ON dlcs FOR DELETE TO authenticated USING (true);

-- 6. Crear tabla intermedia para DLCs incluidos en una versión
CREATE TABLE game_version_dlcs (
    game_version_id UUID NOT NULL REFERENCES game_versions(id) ON DELETE CASCADE,
    dlc_id UUID NOT NULL REFERENCES dlcs(id) ON DELETE CASCADE,
    PRIMARY KEY (game_version_id, dlc_id)
);

ALTER TABLE game_version_dlcs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read game_version_dlcs" ON game_version_dlcs FOR SELECT USING (true);
CREATE POLICY "Permitir insercion de game_version_dlcs a admin" ON game_version_dlcs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir eliminacion de game_version_dlcs a admin" ON game_version_dlcs FOR DELETE TO authenticated USING (true);

-- =============================================================
-- SISTEMA DE RECETAS PER-MIRROR + FRAGMENTOS REUTILIZABLES
-- =============================================================

-- 7. Biblioteca de fragmentos de receta reutilizables
--    Un fragmento es un bloque pre-hecho de pasos (ej: "Limpieza DODI", "Crack Steamworks UE5")
--    que el admin define una vez y puede reutilizar en cualquier mirror.
CREATE TABLE IF NOT EXISTS public.recipe_fragments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,          -- Ej: "Limpieza DODI Standard"
    description TEXT,                   -- Descripción interna para el admin
    steps       JSONB NOT NULL DEFAULT '[]'::jsonb,
    tags        TEXT[] DEFAULT '{}',    -- Ej: {'dodi','cleanup','repack'}
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recipe_fragments ENABLE ROW LEVEL SECURITY;

-- Solo admins autenticados pueden leer, crear, editar y borrar fragmentos
CREATE POLICY "Admins pueden leer fragmentos"
    ON public.recipe_fragments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins pueden insertar fragmentos"
    ON public.recipe_fragments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins pueden editar fragmentos"
    ON public.recipe_fragments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins pueden eliminar fragmentos"
    ON public.recipe_fragments FOR DELETE TO authenticated USING (true);

-- 8. Mirrors por versión con receta propia (relación 1:N con game_versions)
--    Reemplaza el campo download_url serializado como JSON texto.
--    Cada mirror puede heredar la receta base del juego (inherit) o tener la suya (override).
CREATE TABLE IF NOT EXISTS public.version_mirrors (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_version_id  UUID NOT NULL REFERENCES public.game_versions(id) ON DELETE CASCADE,
    provider         TEXT NOT NULL DEFAULT 'GoogleDrive',  -- Ej: "DODI Repacks", "FitGirl", "GOG"
    url              TEXT NOT NULL,
    display_order    SMALLINT NOT NULL DEFAULT 0,          -- Orden de preferencia (0 = principal)
    recipe_mode      TEXT NOT NULL DEFAULT 'inherit'
                         CHECK (recipe_mode IN ('inherit', 'override')),
    recipe_steps     JSONB DEFAULT NULL,                   -- NULL cuando recipe_mode = 'inherit'
    notes            TEXT,                                 -- Notas internas del admin (VirusTotal, advertencias, etc.)
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para consultas rápidas por versión
CREATE INDEX IF NOT EXISTS idx_version_mirrors_game_version_id
    ON public.version_mirrors (game_version_id, display_order);

ALTER TABLE public.version_mirrors ENABLE ROW LEVEL SECURITY;

-- El cliente anónimo (app desktop) puede leer los mirrors para mostrar opciones de descarga
CREATE POLICY "Public puede leer mirrors de versiones"
    ON public.version_mirrors FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins pueden insertar mirrors"
    ON public.version_mirrors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins pueden editar mirrors"
    ON public.version_mirrors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins pueden eliminar mirrors"
    ON public.version_mirrors FOR DELETE TO authenticated USING (true);

-- 9. Migración de mirrors existentes en game_versions.download_url → version_mirrors
--    Solo migra filas donde download_url contiene un JSON array de mirrors [{provider,url}].
--    Filas con URL simple (texto plano) se migran como un único mirror "Principal".
--    Este bloque es idempotente: no re-migra si ya existen mirrors para esa versión.
DO $$
DECLARE
    v_row   RECORD;
    v_order SMALLINT;
    m_item  JSONB;
BEGIN
    FOR v_row IN
        SELECT id, download_url
        FROM public.game_versions
        WHERE download_url IS NOT NULL
          AND download_url != ''
          -- Solo migrar si aún no tiene mirrors en la nueva tabla
          AND NOT EXISTS (
              SELECT 1 FROM public.version_mirrors vm
              WHERE vm.game_version_id = game_versions.id
          )
    LOOP
        v_order := 0;

        IF LEFT(TRIM(v_row.download_url), 1) = '[' THEN
            -- Es un JSON array: iterar cada mirror
            BEGIN
                FOR m_item IN SELECT * FROM jsonb_array_elements(v_row.download_url::jsonb)
                LOOP
                    INSERT INTO public.version_mirrors
                        (game_version_id, provider, url, display_order, recipe_mode)
                    VALUES (
                        v_row.id,
                        COALESCE(m_item->>'provider', 'Servidor'),
                        COALESCE(m_item->>'url', ''),
                        v_order,
                        'inherit'
                    );
                    v_order := v_order + 1;
                END LOOP;
            EXCEPTION WHEN OTHERS THEN
                -- Si el JSON malformado falla, tratar como URL simple
                INSERT INTO public.version_mirrors
                    (game_version_id, provider, url, display_order, recipe_mode)
                VALUES (v_row.id, 'Principal', v_row.download_url, 0, 'inherit');
            END;
        ELSE
            -- Es una URL simple: insertar como mirror principal
            INSERT INTO public.version_mirrors
                (game_version_id, provider, url, display_order, recipe_mode)
            VALUES (v_row.id, 'Principal', v_row.download_url, 0, 'inherit');
        END IF;
    END LOOP;
END;
$$;

-- Fragmentos de receta de ejemplo para arrancar la biblioteca
INSERT INTO public.recipe_fragments (name, description, steps, tags)
VALUES
(
    'Post-install básico',
    'Exclusión en Windows Defender + Acceso Directo. Usar siempre al final.',
    '[
        {"action":"add_defender_exclusion","path":"{INSTALL_DIR}"},
        {"action":"create_shortcut"}
    ]'::jsonb,
    ARRAY['defender','shortcut','basico']
),
(
    'Limpieza DODI Standard',
    'Elimina carpetas de spam y ejecutables sospechosos típicos de repacks DODI. Verificar primero en VirusTotal.',
    '[
        {"action":"cleanup","path":"{INSTALL_DIR}/_Redist"},
        {"action":"cleanup","path":"{INSTALL_DIR}/*.url"},
        {"action":"cleanup","path":"{INSTALL_DIR}/*.nfo"}
    ]'::jsonb,
    ARRAY['dodi','cleanup','repack']
),
(
    'Crack Steamworks UE5',
    'Aplica la medicina desde la carpeta steam_settings típica de juegos Unreal Engine crackeados por CODEX/EMPRESS.',
    '[
        {"action":"apply_crack",
         "source_folder":"{INSTALL_DIR}/Engine/Binaries/ThirdParty/Steamworks/Steamv157/Win64/steam_settings",
         "target_folder":"{INSTALL_DIR}"}
    ]'::jsonb,
    ARRAY['crack','steamworks','ue5','codex']
),
(
    'Limpieza GOG/Offline',
    'Limpia instaladores redistributables innecesarios en repacks de GOG.',
    '[
        {"action":"cleanup","path":"{INSTALL_DIR}/__support"},
        {"action":"cleanup","path":"{INSTALL_DIR}/galaxy-installation-parameters.json"}
    ]'::jsonb,
    ARRAY['gog','cleanup','offline']
)
ON CONFLICT DO NOTHING;

-- =============================================================
-- 10. CONFIGURACIÓN GLOBAL DEL SISTEMA (system_settings)
--     Almacena tokens de proveedores (ej: Gofile API token),
--     parámetros del launcher y configuraciones dinámicas.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL DEFAULT '',
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Lectura pública para que todos los launchers conectados obtengan tokens y configs
CREATE POLICY "Permitir lectura publica de system_settings"
    ON public.system_settings FOR SELECT
    TO anon, authenticated
    USING (true);

-- Modificación solo para Administradores autenticados desde el Panel Admin
CREATE POLICY "Permitir insercion de system_settings a admins"
    ON public.system_settings FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Permitir edicion de system_settings a admins"
    ON public.system_settings FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Permitir eliminacion de system_settings a admins"
    ON public.system_settings FOR DELETE
    TO authenticated
    USING (true);

-- Sembrar clave de Gofile API Token por defecto
INSERT INTO public.system_settings (key, value, description)
VALUES (
    'gofile_api_token',
    '',
    'Token de cuenta de Gofile (gofile.io/myProfile) para autorizar descargas streaming sin errores 401'
)
ON CONFLICT (key) DO NOTHING;