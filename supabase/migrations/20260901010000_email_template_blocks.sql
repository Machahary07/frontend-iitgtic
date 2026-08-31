-- Templates edited as blocks rather than as HTML.
--
-- Editing a transactional email meant editing inline-styled table markup, which
-- is not a reasonable thing to ask of the people who actually write the copy.
-- The console now composes a message from blocks — heading, paragraph,
-- highlight, button — and `body` is compiled from them on save.
--
-- `blocks` is null for a template that was hand-edited in the HTML tab, which is
-- how the editor knows which mode a template is in. Resetting a template deletes
-- the row, so the bundled block version comes back either way.

alter table public.email_templates
  add column if not exists blocks jsonb;

comment on column public.email_templates.blocks is
  'Block list the body was compiled from; null when the body was written as raw HTML.';
