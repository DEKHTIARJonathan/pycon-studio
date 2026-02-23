from bangers.config import DEFAULT_GENERATION_DURATION


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_format TEXT NOT NULL DEFAULT 'flac',
    duration_seconds REAL,
    sample_rate INTEGER DEFAULT 48000,
    file_size_bytes INTEGER,
    caption TEXT DEFAULT '',
    lyrics TEXT DEFAULT '',
    bpm INTEGER,
    keyscale TEXT DEFAULT '',
    timesignature TEXT DEFAULT '',
    vocal_language TEXT DEFAULT 'unknown',
    instrumental INTEGER DEFAULT 0,
    is_favorite INTEGER DEFAULT 0,
    rating INTEGER DEFAULT 0,
    tags TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    parent_song_id TEXT,
    generation_history_id TEXT,
    variation_index INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (parent_song_id) REFERENCES songs(id) ON DELETE SET NULL,
    FOREIGN KEY (generation_history_id) REFERENCES generation_history(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS generation_history (
    id TEXT PRIMARY KEY,
    task_type TEXT NOT NULL DEFAULT 'text2music',
    status TEXT NOT NULL DEFAULT 'pending',
    title TEXT,
    params_json TEXT DEFAULT '{}',
    result_json TEXT DEFAULT '{}',
    audio_count INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS radio_stations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_preset INTEGER DEFAULT 0,
    caption_template TEXT DEFAULT '',
    genre TEXT DEFAULT '',
    mood TEXT DEFAULT '',
    instrumental INTEGER DEFAULT 1,
    vocal_language TEXT DEFAULT 'unknown',
    bpm_min INTEGER,
    bpm_max INTEGER,
    keyscale TEXT DEFAULT '',
    timesignature TEXT DEFAULT '',
    duration_min REAL DEFAULT __DEFAULT_GENERATION_DURATION__,
    duration_max REAL DEFAULT __DEFAULT_GENERATION_DURATION__,
    advanced_params_json TEXT DEFAULT '{}',
    total_plays INTEGER DEFAULT 0,
    last_played_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS radio_station_songs (
    id TEXT PRIMARY KEY,
    station_id TEXT NOT NULL REFERENCES radio_stations(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dj_conversations (
    id TEXT PRIMARY KEY,
    title TEXT DEFAULT 'New Conversation',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dj_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES dj_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    generation_params_json TEXT,
    generation_job_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_songs_created_at ON songs(created_at);
CREATE INDEX IF NOT EXISTS idx_songs_is_favorite ON songs(is_favorite);
CREATE INDEX IF NOT EXISTS idx_songs_rating ON songs(rating);
CREATE INDEX IF NOT EXISTS idx_songs_parent_song_id ON songs(parent_song_id);
CREATE INDEX IF NOT EXISTS idx_generation_history_created_at ON generation_history(created_at);
CREATE INDEX IF NOT EXISTS idx_generation_history_status ON generation_history(status);
CREATE INDEX IF NOT EXISTS idx_songs_generation_history_id ON songs(generation_history_id);
CREATE INDEX IF NOT EXISTS idx_songs_updated_at ON songs(updated_at);
CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
CREATE INDEX IF NOT EXISTS idx_songs_duration_seconds ON songs(duration_seconds);
CREATE INDEX IF NOT EXISTS idx_songs_bpm ON songs(bpm);
CREATE INDEX IF NOT EXISTS idx_generation_history_task_type ON generation_history(task_type);
CREATE INDEX IF NOT EXISTS idx_radio_stations_is_preset ON radio_stations(is_preset);
CREATE INDEX IF NOT EXISTS idx_radio_station_songs_station_id ON radio_station_songs(station_id);
CREATE INDEX IF NOT EXISTS idx_dj_conversations_updated_at ON dj_conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_dj_messages_conversation_id ON dj_messages(conversation_id);
""".replace("__DEFAULT_GENERATION_DURATION__", str(DEFAULT_GENERATION_DURATION))

from bangers.config import (
    DEFAULT_AUDIO_FORMAT,
    DEFAULT_BATCH_SIZE,
    DEFAULT_DEVICE,
    DEFAULT_DIT_SLEEP_MS,
    DEFAULT_FAST_CREATE_MODE,
    DEFAULT_GUIDANCE_SCALE,
    DEFAULT_INFERENCE_STEPS,
    DEFAULT_KEEP_ACTIVE_MODELS_RESIDENT,
    DEFAULT_LM_BACKEND,
    DEFAULT_PARALLEL_PIPELINE_ENABLED,
    DEFAULT_THINKING,
    DEFAULT_THROTTLE_RADIO_ONLY,
    DEFAULT_VAE_CHUNK_SIZE,
    DEFAULT_VAE_SLEEP_MS,
)

DEFAULT_SETTINGS = {
    "dit_model": "",
    "lm_model": "",
    "lm_backend": DEFAULT_LM_BACKEND,
    "device": DEFAULT_DEVICE,
    "audio_format": DEFAULT_AUDIO_FORMAT,
    "batch_size": str(DEFAULT_BATCH_SIZE),
    "default_duration": str(DEFAULT_GENERATION_DURATION),
    "inference_steps": str(DEFAULT_INFERENCE_STEPS),
    "guidance_scale": str(DEFAULT_GUIDANCE_SCALE),
    "thinking": "true" if DEFAULT_THINKING else "false",
    "dj_model": "",
    "vae_chunk_size": str(DEFAULT_VAE_CHUNK_SIZE),
    "vae_sleep_ms": str(DEFAULT_VAE_SLEEP_MS),
    "dit_sleep_ms": str(DEFAULT_DIT_SLEEP_MS),
    "throttle_radio_only": "true" if DEFAULT_THROTTLE_RADIO_ONLY else "false",
    "keep_active_models_resident": "true" if DEFAULT_KEEP_ACTIVE_MODELS_RESIDENT else "false",
    "parallel_pipeline_enabled": "true" if DEFAULT_PARALLEL_PIPELINE_ENABLED else "false",
    "fast_create_mode": "true" if DEFAULT_FAST_CREATE_MODE else "false",
}

RADIO_PRESETS = [
    {
        "name": "Lo-Fi Chill",
        "description": (
            "Dusty lo-fi hip-hop inspired by late-night study playlists and cassette-era textures. "
            "Features swung boom bap drum grooves, lightly compressed kick and snare, vinyl crackle, "
            "tape hiss, warm Rhodes electric piano chords, jazzy seventh and ninth harmonies, mellow sub bass, "
            "soft filtered samples, sleepy melodic loops, low-pass filtering, subtle wow-and-flutter tape instability, "
            "humanized timing, intimate stereo field, rainy-night ambience, nostalgic emotional tone, and understated dynamics. "
            "Avoid aggressive transients, bright mastering, EDM-style drops, or overly clean production."
        ),
        "genre": "lo-fi hip-hop, chillhop, study beats",
        "mood": (
            "nostalgic, sleepy, introspective, cozy, rainy-night, warm, emotionally soft, dreamy, relaxed"
        ),
        "instrumental": True,
        "bpm_min": 68,
        "bpm_max": 84,
        "caption_template": (
            "A nostalgic {genre} instrumental with swung boom bap drums, dusty vinyl crackle, "
            "warm Rhodes chords, jazzy seventh harmonies, sleepy melodic loops, mellow sub bass, "
            "cassette tape saturation, subtle rain ambience, and intimate late-night study vibes"
        ),
    },

    {
        "name": "Jazz Club",
        "description": (
            "Intimate late-night jazz club performance featuring brushed drum kits, upright acoustic bass, "
            "smoky tenor saxophone solos, expressive piano improvisation, extended jazz harmonies, walking basslines, "
            "dynamic live interplay between musicians, subtle room reverb, swing phrasing, bebop-inspired melodic movement, "
            "warm analog microphone coloration, candlelit cocktail-bar atmosphere, and natural human performance imperfections. "
            "Prioritize organic instrumentation and conversational improvisation over polished studio perfection."
        ),
        "genre": "cool jazz, lounge jazz, bebop, smoky jazz club",
        "mood": (
            "smoky, intimate, classy, sophisticated, romantic, warm, late-night, elegant, expressive"
        ),
        "instrumental": True,
        "bpm_min": 78,
        "bpm_max": 138,
        "caption_template": (
            "A smoky late-night {genre} performance with brushed drums, upright bass walking lines, "
            "expressive piano improvisation, sultry saxophone melodies, rich extended harmonies, "
            "subtle club ambience, and intimate candlelit jazz-bar atmosphere"
        ),
    },

    {
        "name": "EDM",
        "description": (
            "Festival-scale EDM designed for massive crowd impact. Includes sidechained supersaw synth stacks, "
            "four-on-the-floor punchy kicks, aggressive risers, snare build-ups, euphoric chord progressions, "
            "uplifting melodic hooks, massive stereo width, cinematic tension-and-release structure, bright high-end mastering, "
            "drop-focused arrangement, energetic vocal chops, reverb-heavy transitions, layered synth arpeggios, "
            "and high-energy dancefloor momentum. Avoid organic jazz instrumentation or minimal production."
        ),
        "genre": "festival EDM, progressive house, big room",
        "mood": (
            "euphoric, explosive, energetic, uplifting, massive, adrenaline-fueled, triumphant, festival-ready"
        ),
        "instrumental": True,
        "bpm_min": 126,
        "bpm_max": 132,
        "caption_template": (
            "A massive {genre} anthem with sidechained supersaw synths, pounding four-on-the-floor kicks, "
            "euphoric chord progressions, cinematic buildups, explosive drops, bright festival mastering, "
            "wide stereo energy, and crowd-hyping dancefloor momentum"
        ),
    },

    {
        "name": "Techno",
        "description": (
            "Dark underground warehouse techno driven by relentless kick drums, hypnotic repetition, industrial percussion, "
            "minimal harmonic movement, evolving analog synth modulation, acid bass sequences, mechanical groove precision, "
            "long-form tension building, filtered transitions, metallic textures, monochromatic sonic palette, "
            "and immersive late-night club atmosphere. Focus on trance-inducing rhythmic persistence rather than melodic hooks."
        ),
        "genre": "underground techno, industrial techno, warehouse techno",
        "mood": (
            "hypnotic, dark, relentless, mechanical, futuristic, underground, immersive, nocturnal"
        ),
        "instrumental": True,
        "bpm_min": 128,
        "bpm_max": 145,
        "caption_template": (
            "A hypnotic underground {genre} track with relentless kick drums, industrial percussion, "
            "dark analog synth modulation, evolving acid sequences, warehouse reverb, mechanical groove precision, "
            "and immersive late-night club intensity"
        ),
    },

    {
        "name": "Drum & Bass",
        "description": (
            "High-energy drum and bass with rapid breakbeat programming, intricate Amen-style drum chops, "
            "deep reese basses, sub-heavy low-end pressure, atmospheric pads, futuristic sound design, "
            "aggressive transient shaping, fast syncopated percussion, rave-inspired intensity, "
            "liquid melodic textures or neurofunk distortion layers, and nonstop forward momentum. "
            "Emphasize rhythmic complexity and bass impact."
        ),
        "genre": "drum and bass, liquid DnB, neurofunk",
        "mood": (
            "intense, futuristic, high-energy, adrenaline-fueled, fast-paced, electrifying, immersive"
        ),
        "instrumental": True,
        "bpm_min": 168,
        "bpm_max": 178,
        "caption_template": (
            "A high-intensity {genre} track with rapid chopped breakbeats, deep reese basslines, "
            "sub-heavy low-end pressure, futuristic atmospheres, syncopated percussion complexity, "
            "rave energy, and relentless forward momentum"
        ),
    },

    {
        "name": "Reggae",
        "description": (
            "Classic roots reggae with deep rolling basslines, offbeat guitar skanks, laid-back pocket drumming, "
            "warm Hammond organ stabs, dub-style delay effects, relaxed island groove, syncopated percussion, "
            "spacious low-end emphasis, sunny tropical atmosphere, conscious soulful energy, "
            "and organic analog warmth. Groove should feel relaxed yet rhythmically locked-in."
        ),
        "genre": "roots reggae, dub reggae",
        "mood": (
            "laid-back, sunny, peaceful, soulful, tropical, groovy, uplifting, easygoing"
        ),
        "instrumental": False,
        "bpm_min": 72,
        "bpm_max": 94,
        "caption_template": (
            "A laid-back {genre} groove with deep rolling basslines, offbeat guitar skanks, "
            "warm Hammond organ chords, dub delay effects, relaxed pocket drumming, tropical ambience, "
            "and soulful island energy"
        ),
    },

    {
        "name": "Blues",
        "description": (
            "Vintage blues performance centered around expressive guitar bends, pentatonic phrasing, smoky vocals, "
            "shuffle drum grooves, emotional call-and-response phrasing, tube amplifier warmth, Hammond organ support, "
            "slow-burning tension, gritty human imperfections, and intimate blues-bar atmosphere. "
            "Focus on emotional authenticity and soulful instrumental expression over polished production."
        ),
        "genre": "electric blues, Chicago blues, blues rock",
        "mood": (
            "soulful, smoky, emotional, gritty, heartfelt, melancholic, expressive, timeless"
        ),
        "instrumental": False,
        "bpm_min": 58,
        "bpm_max": 112,
        "caption_template": (
            "A soulful {genre} performance with expressive guitar bends, smoky vocals, "
            "shuffle grooves, Hammond organ warmth, tube amp saturation, emotional phrasing, "
            "and intimate late-night blues-bar atmosphere"
        ),
    },

    {
        "name": "Country",
        "description": (
            "Modern Americana-inspired country music featuring acoustic strumming, steel guitar slides, "
            "warm storytelling vocals, steady backbeat drumming, southern bar-room atmosphere, "
            "road-trip emotional themes, banjo or fiddle accents, heartfelt lyricism, "
            "clean Nashville-style production, and nostalgic open-highway energy."
        ),
        "genre": "modern country, Americana, Nashville country",
        "mood": (
            "heartfelt, nostalgic, warm, uplifting, open-road, southern, emotional, authentic"
        ),
        "instrumental": False,
        "bpm_min": 72,
        "bpm_max": 126,
        "caption_template": (
            "A heartfelt {genre} song with acoustic strumming, steel guitar melodies, "
            "warm storytelling vocals, southern Americana textures, steady backbeat grooves, "
            "and nostalgic open-highway atmosphere"
        ),
    },

    {
        "name": "Folk",
        "description": (
            "Organic acoustic folk centered around fingerpicked guitars, intimate storytelling vocals, "
            "natural room ambience, soft harmonies, subtle hand percussion, earthy instrumentation, "
            "wooden acoustic textures, emotional vulnerability, and campfire-style intimacy. "
            "Avoid overly compressed modern pop production."
        ),
        "genre": "acoustic folk, indie folk",
        "mood": (
            "earthy, intimate, organic, heartfelt, rustic, emotional, warm, human"
        ),
        "instrumental": False,
        "bpm_min": 68,
        "bpm_max": 118,
        "caption_template": (
            "An intimate {genre} song with fingerpicked acoustic guitars, soft harmonies, "
            "earthy percussion, natural room ambience, emotional storytelling vocals, "
            "and warm campfire-style organic textures"
        ),
    },

    {
        "name": "Metal",
        "description": (
            "Aggressive heavy metal with heavily distorted down-tuned guitars, palm-muted riffing, "
            "double-kick drumming, thunderous tom fills, dark harmonic tension, aggressive vocal delivery, "
            "high-gain amplifier saturation, cinematic heaviness, relentless energy, "
            "and crushing wall-of-sound production. Emphasize power, speed, and intensity."
        ),
        "genre": "heavy metal, modern metal, melodic metal",
        "mood": (
            "aggressive, dark, intense, heavy, relentless, explosive, powerful, chaotic"
        ),
        "instrumental": False,
        "bpm_min": 120,
        "bpm_max": 190,
        "caption_template": (
            "An aggressive {genre} track with down-tuned distorted guitars, double-kick drumming, "
            "crushing riff layers, cinematic heaviness, thunderous percussion, high-gain saturation, "
            "and relentless wall-of-sound intensity"
        ),
    },

    {
        "name": "Swing",
        "description": (
            "Vintage big-band swing with energetic brass arrangements, walking upright bass, lively ride cymbal swing grooves, "
            "tight horn stabs, jazz piano comping, ballroom dance momentum, old-school microphone coloration, "
            "call-and-response brass phrasing, upbeat rhythmic bounce, and glamorous 1940s dance-hall atmosphere."
        ),
        "genre": "big band swing, vintage swing jazz",
        "mood": (
            "playful, classy, lively, danceable, vintage, glamorous, energetic, upbeat"
        ),
        "instrumental": True,
        "bpm_min": 118,
        "bpm_max": 176,
        "caption_template": (
            "A lively {genre} performance with energetic brass sections, walking upright bass, "
            "swinging ride cymbals, jazz piano comping, ballroom dance momentum, "
            "and glamorous vintage dance-hall atmosphere"
        ),
    },

    {
        "name": "Rock 'n' Roll",
        "description": (
            "Classic 1950s-inspired rock and roll with energetic electric guitar riffs, walking basslines, "
            "retro drum grooves, vintage piano stabs, bright tube amp tones, danceable rhythms, "
            "rebellious youthful swagger, handclaps, catchy vocal hooks, and upbeat jukebox energy."
        ),
        "genre": "rock and roll, classic rockabilly",
        "mood": (
            "rebellious, upbeat, retro, danceable, youthful, energetic, fun, lively"
        ),
        "instrumental": False,
        "bpm_min": 96,
        "bpm_max": 164,
        "caption_template": (
            "An energetic retro {genre} track with walking basslines, vintage guitar riffs, "
            "bright tube amp tones, driving drum grooves, piano stabs, catchy hooks, "
            "and classic jukebox dancefloor energy"
        ),
    },

    {
        "name": "Ambient",
        "description": (
            "Immersive ambient soundscapes built from evolving synth pads, cinematic drones, expansive reverbs, "
            "minimal rhythmic motion, airy textures, slow harmonic evolution, spatial depth, "
            "ethereal tonal layering, meditative pacing, and emotionally immersive atmosphere. "
            "Avoid strong percussion or pop-style song structures."
        ),
        "genre": "ambient, atmospheric ambient, drone",
        "mood": (
            "ethereal, meditative, spacious, floating, cinematic, dreamy, immersive, tranquil"
        ),
        "instrumental": True,
        "bpm_min": 40,
        "bpm_max": 72,
        "caption_template": (
            "An immersive {genre} soundscape with evolving synth pads, cinematic drones, "
            "expansive reverbs, ethereal textures, slow harmonic movement, and deep spatial atmosphere"
        ),
    },

    {
        "name": "Pop",
        "description": (
            "Modern chart-focused pop production built around instantly memorable hooks, polished vocal performances, "
            "layered harmonies, punchy radio-ready drums, bright synth textures, clean low-end, "
            "catchy repetitive choruses, emotionally direct songwriting, glossy studio production, "
            "tight song structure, uplifting melodic progressions, subtle vocal tuning, "
            "dynamic pre-chorus tension, explosive chorus payoff, and commercial mainstream appeal. "
            "Blend organic and electronic instrumentation while prioritizing clarity, accessibility, "
            "strong vocal presence, and infectious melodic memorability. Avoid underground or experimental aesthetics."
        ),
        "genre": "modern pop, dance pop, commercial pop",
        "mood": (
            "catchy, uplifting, vibrant, youthful, emotional, polished, energetic, radio-friendly"
        ),
        "instrumental": False,
        "bpm_min": 96,
        "bpm_max": 128,
        "caption_template": (
            "A polished {genre} anthem with infectious vocal hooks, layered harmonies, "
            "bright synth textures, punchy radio-ready drums, emotional melodic buildup, "
            "explosive chorus energy, glossy commercial production, and instantly memorable songwriting"
        ),
    },

    {
        "name": "Rap",
        "description": (
            "Modern rap production centered around hard-hitting rhythmic flow, deep 808 sub bass, "
            "tight trap-inspired drum programming, crisp hi-hat rolls, punchy snares, dark melodic loops, "
            "minimal harmonic layering, aggressive transient impact, confident vocal delivery, "
            "street-inspired atmosphere, repetitive hypnotic motifs, cinematic bass-heavy mixing, "
            "ad-lib vocal textures, modern urban production polish, and emotionally dominant energy. "
            "Prioritize groove, cadence, vocal rhythm, and low-end impact over melodic complexity."
        ),
        "genre": "rap, trap, modern hip-hop",
        "mood": (
            "confident, aggressive, swagger-filled, gritty, intense, rhythmic, dark, powerful"
        ),
        "instrumental": False,
        "bpm_min": 70,
        "bpm_max": 160,
        "caption_template": (
            "A hard-hitting {genre} track with deep 808 bass, crisp hi-hat rolls, "
            "punchy trap drums, dark melodic loops, aggressive vocal cadence, cinematic low-end pressure, "
            "and confident street-inspired energy"
        ),
    },
    {
        "name": "R&B",
        "description": (
            "Contemporary R&B blending soulful vocal expression with lush atmospheric production. "
            "Features silky lead vocals, layered harmonies, warm Rhodes and electric piano chords, "
            "slow groove-focused drum patterns, deep melodic basslines, sensual chord progressions, "
            "smooth vocal runs, intimate late-night atmosphere, reverb-rich textures, "
            "minimal but emotionally rich arrangements, modern trap-influenced percussion, "
            "romantic emotional tone, polished studio vocal production, and moody ambient depth. "
            "Prioritize emotional intimacy, vocal smoothness, groove, and harmonic richness."
        ),
        "genre": "contemporary R&B, alternative R&B, neo soul",
        "mood": (
            "sensual, soulful, intimate, emotional, smooth, romantic, warm, late-night"
        ),
        "instrumental": False,
        "bpm_min": 60,
        "bpm_max": 98,
        "caption_template": (
            "A smooth {genre} track with silky vocals, lush harmonies, warm Rhodes chords, "
            "deep melodic basslines, slow groove-focused drums, atmospheric reverb textures, "
            "and intimate late-night emotional energy"
        ),
    },
]
