import { PlaywrightCrawler } from 'crawlee';
import { createClient } from '@supabase/supabase-js';
import cron from 'node-cron';

// 1. Setup Supabase securely
const SUPABASE_URL = "https://rbxtwzbzglwekeztguhu.supabase.co";
const SUPABASE_KEY = "sb_publishable_40RTXFQkCIoPMTcX9uPiGw_rvpJ_SbS";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Define the "Eagle Eye" Filters for Parañaque
const SECTORS = [
    { name: 'SAN ANTONIO', keywords: ['san antonio', 'sucat', 'valley 1', 'j.p. rizal'] },
    { name: 'BF HOMES', keywords: ['bf homes', 'aguirre', 'el grande', 'tirona'] }
];

// 3. Define Disaster & Incident Keywords (The "Emergency" Filter)
const DISASTER_KEYWORDS = [
    // Fire/Heat
    'fire', 'sunog', 'smoke', 'apoy', 'burning',
    // Weather/Floods
    'flood', 'baha', 'storm', 'bagyo', 'heavy rain', 'ulán',
    // Accidents/Medical
    'accident', 'crash', 'collision', 'medics', 'ambulance', 'sakuna', 'emergency',
    // Crime/Security
    'crime', 'robbery', 'holdup', 'shooting', 'theft', 'nakawan', 'pulis', 'police',
    // Infrastructure
    'blackout', 'power outage', 'wire spark', 'collapsed'
];

const crawler = new PlaywrightCrawler({
    async requestHandler({ page, request, log }) {
        try {
            await page.waitForSelector('div[role="article"]', { timeout: 15000 });
            const posts = await page.locator('div[role="article"]').all();

            for (const post of posts) {
                const postContent = await post.textContent();
                if (!postContent) continue;
                
                const lowerContent = postContent.toLowerCase();

                // Check for Location Match
                const sector = SECTORS.find(s => s.keywords.some(k => lowerContent.includes(k)));
                
                // Check for Incident/Disaster Match
                const isIncident = DISASTER_KEYWORDS.some(k => lowerContent.includes(k));

                // LOGIC: Only save if it's an incident in one of our sectors
                if (sector && isIncident) {
                    // Standardized coordinate, description, and source keys for unified data integration
                    const { error } = await supabase.from('incident_logs').upsert({ 
                        custom_id: `SR-${Math.floor(Math.random() * 99) + 1} ALPHA`, 
                        source_url: request.url + "#" + Math.random(), 
                        title: postContent.substring(0, 150).replace(/\n/g, ' '), 
                        description: postContent,
                        source: 'BF Homes Community Group',
                        location_tag: sector.name,
                        latitude: sector.name === 'BF HOMES' ? 14.4450 : 14.4850,
                        longitude: sector.name === 'BF HOMES' ? 121.0250 : 121.0130
                    }, { onConflict: 'source_url' });

                    if (!error) {
                        log.info(`[ALERT] ${sector.name} Incident Logged successfully.`);
                    } else {
                        log.error(`Database Error: ${error.message}`);
                    }
                }
            }
        } catch (e) {
            log.warning("No new relevant posts found or scrape session timed out.");
        }
    },
});

const runScraper = async () => {
    console.log(`[${new Date().toLocaleTimeString()}] Starting 5-minute disaster scan...`);
    await crawler.run(['https://www.facebook.com/groups/BFHomesCommunity']);
};

// Automation: Runs every 5 minutes
cron.schedule('*/5 * * * *', runScraper);
runScraper();