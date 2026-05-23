const SUPABASE_URL = 'https://rbxtwzbzglwekeztguhu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_40RTXFQkCIoPMTcX9uPiGw_rvpJ_SbS';
const { createClient } = supabase;
window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("Eagle Eye: System Data Link Established.");