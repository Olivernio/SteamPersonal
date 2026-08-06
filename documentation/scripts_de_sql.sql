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
-- Al no crear políticas de INSERT/UPDATE/DELETE para 'anon', PostgreSQL bloquea cualquier intento de hackeo automáticamente.

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

-- Insertar su receta asociada (reemplaza {GAME_ID} por el UUID generado arriba)
INSERT INTO public.installation_recipes (game_id, steps)
VALUES (
    '8d420973-9fd8-4912-a1b2-c2aa9ee12b0e',
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

-- NOTA: La columna 'dlcs' es de tipo JSONB, por lo que soporta nativamente tanto arrays de cadenas simples:
-- ["DLC 1", "DLC 2"]
-- como objetos estructurados completos con imagen y descripción:
-- [{"name": "Phantom Liberty", "image": "https://...", "description": "Expansión de historia..."}]
-- No requiere ejecutar ningún comando ALTER adicional en Supabase.
