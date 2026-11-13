-- a person's schedule as rules, and who last reworked a plan.

-- what a person described about when they are free, as muse read it or as they edited it:
-- [{"id":"r1","kind":"free","days":["tue","thu"],"start":"18:00","end":"22:00","from":"2026-11-21","until":null,"note":null}]
-- null = never described. free_windows stays what the planners read; the api works it out
-- from these rules. only ever served to the person themself.
alter table users add column if not exists schedule_rules jsonb;

-- whose "what if" last changed the plan. the api only ever tells a viewer whether that was
-- them, so a plan is shown as updated to everyone except the person who asked for the change.
alter table plans add column if not exists revised_by text references users(id);
