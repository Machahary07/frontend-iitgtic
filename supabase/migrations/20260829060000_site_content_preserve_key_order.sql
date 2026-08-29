-- jsonb normalises objects: it sorts keys and drops duplicates, so a section
-- round-tripped through it comes back with its fields reordered — the FAQ editor
-- showed "Answer" above "Question". The site does not care, but the person
-- editing does.
--
-- json keeps the document exactly as written. Nothing here queries inside the
-- value (sections are read and written whole), so the jsonb operators are no loss.

alter table public.site_content
  alter column value type json using value::json;
