import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DOMParser } from "https://esm.sh/linkedom@0.16.8";

/**
 * EAGLE EYE SCANNER - ADVANCED DEDUPLICATION & QUALITY EVALUATION
 * Monitors localized and national channels for San Antonio & BF Homes incidents.
 */

const TARGET_KEYWORDS = [
  "san antonio", "bf homes", "paranaque", "pque", "district 1", "district 2", 
  "sucat", "aguirre", "elorde", "lopez", "tirona", "president's ave"
];

const FACEBOOK_PAGES_TO_SCRAPE = [
  { name: "BFP Paranaque City", url: "https://mbasic.facebook.com/BFPParanaqueCity" },
  { name: "Paranaque PNP Legacy", url: "https://mbasic.facebook.com/pquepnp" },
  { name: "PIO Paranaque", url: "https://mbasic.facebook.com/PIOParanaque" },
  { name: "BFP Paranaque HQ", url: "https://mbasic.facebook.com/bfpparanaque" },
  { name: "Bagong Paranaque PNP", url: "https://mbasic.facebook.com/bagongparanaquepnp" },
  { name: "Philippines Watch", url: "https://mbasic.facebook.com/philippineswatchh/" },
  { name: "Brgy BF Homes Official", url: "https://mbasic.facebook.com/brgybfhomesofficial" },
  { name: "Parañaque Community Update Group", url: "https://mbasic.facebook.com/profile.php?id=61553676940769" },
  { name: "GO Paranaque PH", url: "https://mbasic.facebook.com/GOParanaquePH" },
  { name: "Paranaque DRRMO", url: "https://mbasic.facebook.com/pquecdrrmo" },
  { name: "ACFV Paranaque", url: "https://mbasic.facebook.com/ACFV.Paranaque" },
  { name: "Paranaque Ngayon", url: "https://mbasic.facebook.com/paranaquengayon" },
  { name: "NDRRMC National", url: "https://mbasic.facebook.com/ndrrmc.gov.ph" },
  { name: "PAGASA Weather", url: "https://mbasic.facebook.com/PAGASA.DOST.GOV.PH" },
  { name: "Philippine Red Cross", url: "https://mbasic.facebook.com/philippineredcross" },
  { name: "Inquirer.net", url: "https://mbasic.facebook.com/inquirerdotnet" },
  { name: "Rappler", url: "https://mbasic.facebook.com/rapplerdotcom" }
];

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || "https://rbxtwzbzglwekeztguhu.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Defensive check: Initialize the client conditionally so Deno's warm-up step never fails.
let supabase: any = null;
if (SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} else {
  console.warn("⚠️ SYSTEM ALERT: SUPABASE_SERVICE_ROLE_KEY environment variable is not set.");
}

async function processAndUpsertIncident(newIncident: any) {
  if (!supabase) {
    console.error("❌ DB ERROR: Supabase client is uninitialized. Ensure variables are loaded in settings.");
    return;
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: existingIncidents, error: fetchError } = await supabase
    .from('incident_logs')
    .select('*')
    .gt('created_at', oneDayAgo);

  if (fetchError) {
    console.error("Database check failed:", fetchError.message);
    return;
  }

  const duplicateMatch = existingIncidents?.find(existing => {
    const clearMatch = (existing.source_url === newIncident.source_url);
    const semanticMatch = existing.location_tag === newIncident.location_tag && 
                         (existing.description && newIncident.description && 
                          existing.description.toLowerCase().slice(0, 30) === newIncident.description.toLowerCase().slice(0, 30));
    return clearMatch || semanticMatch;
  });

  if (duplicateMatch) {
    const existingWeight = duplicateMatch.description ? duplicateMatch.description.trim().length : 0;
    const newWeight = newIncident.description ? newIncident.description.trim().length : 0;

    if (newWeight > existingWeight) {
      console.log(`[UPDATE] Better detailed report found from "${newIncident.source}". Updating Incident ID: ${duplicateMatch.custom_id || duplicateMatch.id}`);
      
      const { error: updateError } = await supabase
        .from('incident_logs')
        .update({
          title: newIncident.title,
          description: newIncident.description,
          source: newIncident.source,
          source_url: newIncident.source_url,
          image_url: newIncident.image_url || duplicateMatch.image_url,
          video_url: newIncident.video_url || duplicateMatch.video_url
        })
        .eq('id', duplicateMatch.id);

      if (updateError) console.error("Failed updating log entry metrics:", updateError.message);
    } else {
      console.log(`[SKIPPED] Incident already logged with equal or better detail.`);
    }
  } else {
    console.log(`[INSERT] New verified incident tracked from "${newIncident.source}"!`);
    const { error: insertError } = await supabase
      .from('incident_logs')
      .insert([newIncident]);

    if (insertError) console.error("Insertion error:", insertError.message);
  }
}

async function runDynamicScanner() {
  console.log(`Starting Eagle Eye Execution Loop across ${FACEBOOK_PAGES_TO_SCRAPE.length} channels...`);

  for (const page of FACEBOOK_PAGES_TO_SCRAPE) {
    try {
      const res = await fetch(page.url, {
        headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36" }
      });
      
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      if (!doc) continue;

      const posts = doc.querySelectorAll('div[role="article"], .story_stream > div');

      for (const post of posts) {
        const textContent = post.querySelector('p, .msg, div > span')?.textContent || "";
        const lowerText = textContent.toLowerCase();

        const matchesKeyword = TARGET_KEYWORDS.some(keyword => lowerText.includes(keyword));
        if (!matchesKeyword || textContent.trim().length === 0) continue;

        const linkEl = post.querySelector('a[href*="story_fbid"], a[href*="/photos/"], a[href*="/permalink/"]');
        let cleanUrl = "https://facebook.com" + (linkEl?.getAttribute("href") || `#${Math.random()}`);
        cleanUrl = cleanUrl.replace("mbasic.facebook.com", "facebook.com").split("?")[0];

        const imageUrl = post.querySelector('img')?.getAttribute('src') || null;
        const locationTag = post.querySelector('a[href*="/places/"]')?.textContent || "Paranaque Area";

        let latitude = null;
        let longitude = null;
        if (lowerText.includes("aguirre") || lowerText.includes("bf homes")) {
          latitude = 14.4418;
          longitude = 121.0135;
        } else if (lowerText.includes("san antonio") || lowerText.includes("sucat")) {
          latitude = 14.4634;
          longitude = 121.0197;
        }

        const normalizedIncident = {
          title: textContent.substring(0, 80).replace(/\n/g, " ") + "...",
          description: textContent,
          source: page.name,
          source_url: cleanUrl,
          location_tag: locationTag,
          latitude,
          longitude,
          image_url: imageUrl,
          video_url: null,
          custom_id: `SR-${Math.floor(Math.random() * 99) + 1} ALPHA`
        };

        await processAndUpsertIncident(normalizedIncident);
      }
    } catch (err) {
      console.error(`Error querying stream profiles for ${page.name}:`, err);
    }
  }
  console.log("Scanner loop sequence finalized.");
}

// Automatically schedules the scanner to run every 10 minutes on Deno Deploy
Deno.cron("Eagle Eye Scheduled Incident Scan", "*/10 * * * *", async () => {
  if (!supabase) {
    console.error("Skipping scheduled scan: Supabase is not configured.");
    return;
  }
  await runDynamicScanner();
});
