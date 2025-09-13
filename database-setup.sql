-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Drop existing tables if they exist in the correct order
drop table if exists kid_gifts cascade;
drop table if exists gifts cascade;
drop table if exists kids cascade;

-- Create tables in the correct order with proper foreign keys
create table kids (
    id uuid default uuid_generate_v4() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    name text not null,
    created_by uuid references auth.users not null
);

create table gifts (
    id uuid default uuid_generate_v4() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    user_id uuid references auth.users not null,
    name text not null,
    price text,
    link text,
    notes text
);

create table kid_gifts (
    id uuid default uuid_generate_v4() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    kid_id uuid references kids on delete cascade,
    created_by uuid references auth.users not null,
    name text not null,
    price text,
    link text,
    notes text,
    -- Claiming support
    claimed_by uuid references auth.users,
    claimed_at timestamp with time zone
);

-- Prevent duplicate suggestions per kid by name (case-insensitive)
create unique index if not exists kid_gifts_kid_name_unique
on kid_gifts (kid_id, lower(name));

-- Enable Row Level Security
alter table kids enable row level security;
alter table gifts enable row level security;
alter table kid_gifts enable row level security;

-- Policies for kids table
create policy "Anyone can read kids"
    on kids for select
    using (true);

create policy "Authenticated users can manage kids"
    on kids for all
    using (auth.role() = 'authenticated');

-- Policies for gifts table
create policy "Authenticated users can read gifts"
    on gifts for select
    using (auth.role() = 'authenticated');

create policy "Users can insert their own gifts"
    on gifts for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own gifts"
    on gifts for update
    using (auth.uid() = user_id);

create policy "Users can delete their own gifts"
    on gifts for delete
    using (auth.uid() = user_id);

-- Allow reading other users' gifts so assigned buyers can view ideas
create policy "Authenticated users can read gifts"
    on gifts for select
    using (auth.role() = 'authenticated');

-- Policies for kid_gifts table
create policy "Anyone can read kid gifts"
    on kid_gifts for select
    using (true);

-- Original creator can update/delete their own suggestions
create policy "Creators can manage their kid gifts"
    on kid_gifts for update using (auth.uid() = created_by)
    with check (auth.uid() = created_by);

create policy "Creators can delete their kid gifts"
    on kid_gifts for delete using (auth.uid() = created_by);

-- Any authenticated user can claim or unclaim a suggestion.
-- This policy allows updating rows where the resulting claim is either set to the caller
-- or cleared (unclaimed). It intentionally does not permit insert/delete.
create policy "Authenticated users can claim or unclaim kid gifts"
    on kid_gifts for update
    using (auth.role() = 'authenticated')
    with check (
        -- allow claiming to self
        (claimed_by = auth.uid() and claimed_at is not null)
        OR
        -- or unclaiming
        (claimed_by is null and claimed_at is null)
        OR
        -- or creator performing a full update
        (auth.uid() = created_by)
    );

-- Helpful indexes
create index if not exists kid_gifts_claimed_by_idx on kid_gifts(claimed_by);
   
