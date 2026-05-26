-- Update default Gemini model from deprecated preview alias to stable release.
-- Google removed `gemini-3.1-flash-lite-preview` (returns 404). The stable
-- replacement is `gemini-3.1-flash-lite`.

UPDATE system_settings
SET settings = jsonb_set(
    settings,
    '{ai,default_model}',
    '"gemini-3.1-flash-lite"'::jsonb,
    false
)
WHERE id = 1
  AND settings #>> '{ai,default_model}' = 'gemini-3.1-flash-lite-preview';
