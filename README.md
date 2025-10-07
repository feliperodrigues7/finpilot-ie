# FinPilot IE — Operação e Infra (Interno)

Este README documenta como operar o formulário público, políticas RLS do Supabase, deploy no GitHub Pages e troubleshooting.

## Visão Geral
- Front-end: site estático (GitHub Pages)
- Backend: Supabase (Postgres + PostgREST)
- Coleta: tabela public.intakes_pf_ie (campos JSONB)
- Público-alvo: brasileiros na Irlanda (PT/EN)
- Consentimento: via checkbox no formulário

## Variáveis de Ambiente (build)
Defina no build (Vite):
- VITE_SUPABASE_URL = https://<PROJECT_ID>.supabase.co
- VITE_SUPABASE_ANON_KEY = <anon_key>

Teste rápido no console:
- Headers enviados: Authorization: Bearer <anon>, apikey: <anon>
- Status esperado no insert: 201 Created

## Tabela principal
Schema atual (principais colunas):
- id (uuid, default gen_random_uuid())
- created_at (timestamptz, default now())
- profile (jsonb) — ex: {"name":"Fulano","email":"..."}
- work, housing, debts, variable, tax, goals, consent, followup (jsonb | null)
- notes (text | null)
- client_email (text | null)
- locale (text, default 'PT')
- source (text, default 'pilot')

## Políticas RLS
RLS habilitado e políticas finais:
```sql
ALTER TABLE public.intakes_pf_ie ENABLE ROW LEVEL SECURITY;

-- Anônimo pode inserir
DROP POLICY IF EXISTS "anon_insert" ON public.intakes_pf_ie;
CREATE POLICY "anon_insert"
ON public.intakes_pf_ie
AS PERMISSIVE
FOR INSERT
TO anon
WITH CHECK (true);

-- Usuários autenticados podem tudo (admin internos)
DROP POLICY IF EXISTS "auth_all" ON public.intakes_pf_ie;
CREATE POLICY "auth_all"
ON public.intakes_pf_ie
AS PERMISSIVE
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Opcional: garantir que não exista SELECT para anon se front não precisar
DROP POLICY IF EXISTS "anon_select" ON public.intakes_pf_ie;
