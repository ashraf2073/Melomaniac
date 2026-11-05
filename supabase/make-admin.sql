-- =====================================================================
-- Make an account an admin.
--
-- 1. Run supabase/schema.sql first (it creates the admins table).
-- 2. Create the account in the app ("Create account") if you have not yet.
-- 3. Supabase Dashboard > SQL Editor > New query: paste this file, put your
--    email between the quotes below, press Run. The table it shows lists every
--    admin, and your email should be in it.
-- 4. Open the app > Library. An "Admin tools" row appears at the top. If it
--    does not, sign out and back in.
--
-- Only someone who can open your Supabase dashboard can run this, so nobody
-- can make themselves an admin from the app.
-- =====================================================================

insert into public.admins (user_id)
select id from auth.users where lower(email) = lower('PUT-YOUR-EMAIL-HERE')
on conflict do nothing;

select u.email, a.created_at as admin_since
from public.admins a
join auth.users u on u.id = a.user_id;

-- To remove an admin later, run this instead (change the email):
-- delete from public.admins
-- where user_id = (select id from auth.users where lower(email) = lower('someone@example.com'));
