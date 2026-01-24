-- Proxies Table for FlowDesk
-- Run this SQL in your Supabase SQL Editor to create the proxies table

CREATE TABLE IF NOT EXISTS proxies (
    id SERIAL PRIMARY KEY,
    proxy_url TEXT NOT NULL,           -- Full proxy URL: http://user:pass@host:port
    label TEXT,                        -- Optional label/name for the proxy
    is_active BOOLEAN DEFAULT TRUE,    -- Whether this proxy is active/usable
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_proxies_active ON proxies(is_active);

-- Add RLS policies (optional, for security)
ALTER TABLE proxies ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read proxies
CREATE POLICY "Allow read access to proxies" ON proxies
    FOR SELECT USING (true);

-- Allow only service role to insert/update/delete
CREATE POLICY "Allow admin to manage proxies" ON proxies
    FOR ALL USING (auth.role() = 'service_role');

-- Example insert (you can add your proxies after running this):
-- INSERT INTO proxies (proxy_url, label) VALUES 
--   ('http://user:pass@host:port', 'Decodo Proxy 1'),
--   ('http://user:pass@host:port', 'Decodo Proxy 2');
