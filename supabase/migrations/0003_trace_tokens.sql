-- usage analytics: record token counts per muse call so cost and effort are measurable.
alter table muse_trace
  add column prompt_tokens int,
  add column completion_tokens int,     -- includes reasoning tokens
  add column reasoning_tokens int,
  add column attempt int;               -- 1 or 2. 0 = served from cache
