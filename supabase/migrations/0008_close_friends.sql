-- close friends: a smaller circle inside someone's friends. a signal can be shown to
-- just them. the flag is one-directional: (user_id, friend_id, close) says user_id counts
-- friend_id as close, so a "close friends" signal from user_id is shown to friend_id.
-- like the friendships themselves, this is seeded mock data. there is no screen to edit it yet.
alter table friendships add column if not exists close boolean not null default false;

-- the seeded close circle (maya's weekend crew and a few others), marked here as well as
-- in the seed so a database that is already seeded does not need a reset. on an empty
-- database this touches nothing and the seed sets the same flags.
update friendships set close = true where (user_id, friend_id) in (
  ('maya', 'alex'), ('alex', 'maya'), ('maya', 'jo'), ('jo', 'maya'), ('maya', 'sam'), ('sam', 'maya'),
  ('alex', 'jo'), ('jo', 'alex'), ('alex', 'sam'), ('sam', 'alex'), ('jo', 'sam'), ('sam', 'jo'),
  ('priya', 'jo'), ('jo', 'priya'), ('dev', 'kai'), ('kai', 'dev'), ('theo', 'ravi'), ('ravi', 'theo'),
  ('mina', 'lena'), ('lena', 'mina'), ('noor', 'lena'), ('lena', 'noor')
);
