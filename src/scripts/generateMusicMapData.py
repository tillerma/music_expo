"""
generate_music_map.py
Lyra Music Map — feature-first PCA → UMAP pipeline.

HOW IT WORKS
============
Instead of assigning songs to users by genre label, we:

  1. Define each mock user as a TASTE PROFILE — a mean + variance in the
     actual 9-dimensional Spotify audio feature space.
     (e.g. "high energy, low acousticness, high danceability" is one profile)

  2. For each user's posts, sample feature vectors from a multivariate normal
     centered on their taste profile. This mimics what a real user's post
     history would look like — coherent but with natural variation.

  3. Find the closest REAL SONG from the library (by Euclidean distance in
     normalised feature space) to use as "today's song" metadata. The user's
     position is determined by their sampled features, not the song label.

  4. Average each user's post feature vectors → one 9D vector per user.

  5. Run StandardScaler → PCA(6) → UMAP(2) on those vectors.
     Users end up close together if their FEATURE VECTORS are similar.
     Genre labels are never consulted. Bon Iver and Future will be far
     apart because their audio features are far apart, full stop.

Requirements:
    pip install numpy pandas umap-learn scikit-learn

Usage:
    python generate_music_map.py
    → writes src/data/generatedMusicMap.json
"""

import numpy as np
import pandas as pd
import json
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

try:
    import umap
    UMAP_AVAILABLE = True
except ImportError:
    UMAP_AVAILABLE = False
    print("⚠️  umap-learn not installed, falling back to PCA-only.")
    print("    Run: pip install umap-learn")

# ─── Feature columns (order matters — must match song library tuples) ──────────
FEATURE_COLS = [
    "danceability",     # 0–1
    "energy",           # 0–1
    "valence",          # 0–1
    "acousticness",     # 0–1
    "instrumentalness", # 0–1
    "liveness",         # 0–1
    "speechiness",      # 0–1
    "tempo",            # BPM — will be normalised
    "loudness",         # dBFS (negative) — will be normalised
]

# ─── Real songs with actual Spotify audio features ────────────────────────────
# (title, artist, dance, energy, valence, acoustic, instrumental, live, speech, tempo, loudness)
SONG_LIBRARY = [
    # HYPE / HIP-HOP / TRAP
    ("HUMBLE.",              "Kendrick Lamar",      0.904, 0.621, 0.421, 0.000278, 0.000016, 0.130, 0.233, 150.02,  -6.842),
    ("SICKO MODE",           "Travis Scott",        0.836, 0.730, 0.446, 0.001970, 0.000024, 0.203, 0.215, 155.01,  -3.714),
    ("God's Plan",           "Drake",               0.754, 0.449, 0.357, 0.005220, 0.000002, 0.094, 0.109,  77.169,  -7.030),
    ("Montero",              "Lil Nas X",           0.765, 0.573, 0.640, 0.017800, 0.000004, 0.131, 0.092, 179.97,  -7.108),
    ("N95",                  "Kendrick Lamar",      0.687, 0.610, 0.516, 0.001840, 0.000007, 0.239, 0.279,  78.007,  -8.180),
    ("Rich Flex",            "Drake & 21 Savage",   0.820, 0.656, 0.568, 0.018600, 0.000013, 0.094, 0.200, 100.12,  -5.670),
    ("Numb Numb Juice",      "ScHoolboy Q",         0.792, 0.814, 0.550, 0.000468, 0.000031, 0.163, 0.289, 137.14,  -5.212),
    ("DNA.",                 "Kendrick Lamar",      0.644, 0.841, 0.493, 0.000268, 0.000000, 0.093, 0.287, 147.96,  -5.399),
    ("Mask Off",             "Future",              0.688, 0.740, 0.378, 0.016400, 0.000013, 0.104, 0.148, 150.00,  -5.896),
    ("Highest In The Room",  "Travis Scott",        0.843, 0.595, 0.342, 0.016800, 0.000008, 0.163, 0.074, 144.97,  -7.202),
    ("Money In The Grave",   "Drake",               0.908, 0.549, 0.459, 0.006670, 0.000002, 0.113, 0.146,  80.012,  -7.541),
    ("Praise God",           "Kanye West",          0.779, 0.545, 0.514, 0.032300, 0.000003, 0.120, 0.304, 137.99,  -7.003),
    # POP / MAINSTREAM
    ("Blinding Lights",      "The Weeknd",          0.514, 0.730, 0.334, 0.000146, 0.000001, 0.094, 0.060, 171.01,  -5.934),
    ("Levitating",           "Dua Lipa",            0.702, 0.762, 0.915, 0.002490, 0.000014, 0.118, 0.030, 103.00,  -3.787),
    ("Physical",             "Dua Lipa",            0.663, 0.958, 0.817, 0.001610, 0.000133, 0.150, 0.041, 125.19,  -4.060),
    ("Dynamite",             "BTS",                 0.747, 0.765, 0.737, 0.006550, 0.000001, 0.097, 0.056, 114.04,  -4.414),
    ("Save Your Tears",      "The Weeknd",          0.653, 0.672, 0.816, 0.010200, 0.000000, 0.094, 0.026, 118.06,  -5.717),
    ("Peaches",              "Justin Bieber",       0.676, 0.566, 0.640, 0.118000, 0.000006, 0.155, 0.116,  90.030,  -7.192),
    ("Anti-Hero",            "Taylor Swift",        0.640, 0.511, 0.562, 0.032900, 0.000000, 0.096, 0.048,  97.008,  -5.869),
    ("As It Was",            "Harry Styles",        0.520, 0.731, 0.527, 0.005020, 0.000005, 0.087, 0.053, 174.00,  -5.339),
    ("Stay",                 "Kid LAROI",           0.591, 0.801, 0.667, 0.001200, 0.000000, 0.128, 0.121, 169.93,  -4.760),
    ("Watermelon Sugar",     "Harry Styles",        0.548, 0.816, 0.671, 0.096600, 0.000000, 0.336, 0.045,  95.390,  -4.209),
    ("good 4 u",             "Olivia Rodrigo",      0.563, 0.901, 0.679, 0.003690, 0.000000, 0.305, 0.130, 166.93,  -3.959),
    ("drivers license",      "Olivia Rodrigo",      0.337, 0.436, 0.279, 0.301000, 0.000002, 0.096, 0.028, 143.88,  -8.025),
    ("Shivers",              "Ed Sheeran",          0.832, 0.900, 0.956, 0.001560, 0.000002, 0.087, 0.053, 140.06,  -3.505),
    ("Bad Habits",           "Ed Sheeran",          0.808, 0.897, 0.832, 0.005600, 0.000001, 0.165, 0.080, 126.03,  -3.712),
    ("Butter",               "BTS",                 0.759, 0.760, 0.850, 0.013600, 0.000001, 0.093, 0.066, 109.89,  -4.083),
    ("Shake It Off",         "Taylor Swift",        0.647, 0.800, 0.936, 0.047200, 0.000002, 0.144, 0.054, 160.08,  -5.718),
    ("Starboy",              "The Weeknd",          0.679, 0.757, 0.441, 0.003470, 0.000002, 0.100, 0.272, 186.06,  -6.902),
    # R&B / SOUL
    ("Leave The Door Open",  "Silk Sonic",          0.652, 0.490, 0.632, 0.197000, 0.000006, 0.085, 0.038,  97.001,  -8.469),
    ("Essence",              "Wizkid",              0.815, 0.664, 0.742, 0.132000, 0.003300, 0.138, 0.070, 109.87,  -8.063),
    ("Pick Up Your Feelings","Jazmine Sullivan",     0.754, 0.581, 0.759, 0.056800, 0.000001, 0.115, 0.050,  93.006,  -7.503),
    ("Golden Hour",          "JVKE",                0.636, 0.531, 0.935, 0.224000, 0.000000, 0.142, 0.032,  97.007,  -7.695),
    ("Kill Bill",            "SZA",                 0.627, 0.562, 0.373, 0.183000, 0.000001, 0.098, 0.035,  89.981,  -8.003),
    ("Good Days",            "SZA",                 0.538, 0.536, 0.384, 0.219000, 0.000002, 0.104, 0.047,  99.972,  -9.145),
    ("Snooze",               "SZA",                 0.513, 0.546, 0.341, 0.251000, 0.000000, 0.112, 0.033, 105.02,  -9.876),
    ("Easy On Me",           "Adele",               0.604, 0.262, 0.130, 0.896000, 0.000000, 0.108, 0.030, 141.95,  -9.313),
    ("Creepin'",             "Metro Boomin",        0.784, 0.618, 0.658, 0.030700, 0.000027, 0.112, 0.063, 149.97,  -6.734),
    # INDIE / ALT / PSYCH
    ("Motion Sickness",      "Phoebe Bridgers",     0.356, 0.639, 0.488, 0.001630, 0.000063, 0.094, 0.027, 120.04,  -6.248),
    ("Heat Waves",           "Glass Animals",       0.508, 0.554, 0.560, 0.097000, 0.004540, 0.070, 0.024,  80.019,  -7.445),
    ("Mr. Brightside",       "The Killers",         0.340, 0.950, 0.275, 0.000844, 0.000000, 0.131, 0.033, 148.03,  -4.240),
    ("Ribs",                 "Lorde",               0.444, 0.559, 0.330, 0.127000, 0.000000, 0.126, 0.031, 115.99,  -9.234),
    ("Electric Feel",        "MGMT",                0.734, 0.709, 0.672, 0.037400, 0.126000, 0.156, 0.037, 113.87,  -9.032),
    ("Do I Wanna Know?",     "Arctic Monkeys",      0.549, 0.784, 0.226, 0.003770, 0.002550, 0.118, 0.037,  85.285,  -6.257),
    ("R U Mine?",            "Arctic Monkeys",      0.606, 0.939, 0.490, 0.000706, 0.000158, 0.202, 0.034, 101.97,  -4.020),
    ("505",                  "Arctic Monkeys",      0.379, 0.779, 0.212, 0.001310, 0.000010, 0.129, 0.027, 113.99,  -6.543),
    ("Somebody That I Used To Know", "Gotye",       0.559, 0.611, 0.408, 0.061600, 0.000000, 0.162, 0.028, 129.07,  -9.131),
    ("The Less I Know The Better", "Tame Impala",   0.664, 0.714, 0.756, 0.045600, 0.000649, 0.094, 0.027, 116.00,  -8.266),
    ("Let It Happen",        "Tame Impala",         0.545, 0.841, 0.601, 0.004100, 0.001110, 0.084, 0.026, 133.99,  -6.951),
    ("Borderline",           "Tame Impala",         0.674, 0.575, 0.760, 0.100000, 0.000197, 0.097, 0.027,  93.981,  -9.872),
    # ELECTRONIC / DANCE
    ("Midnight City",        "M83",                 0.438, 0.834, 0.423, 0.004190, 0.030500, 0.122, 0.032, 104.49,  -6.027),
    ("One More Time",        "Daft Punk",           0.834, 0.797, 0.956, 0.002260, 0.000302, 0.206, 0.047, 122.68,  -6.009),
    ("Titanium",             "David Guetta",        0.553, 0.849, 0.404, 0.001080, 0.000021, 0.267, 0.035, 126.00,  -4.978),
    ("Lean On",              "Major Lazer",         0.722, 0.663, 0.598, 0.036800, 0.000000, 0.100, 0.090,  98.032,  -4.660),
    ("Roses",                "SAINt JHN",           0.746, 0.617, 0.452, 0.069600, 0.000001, 0.282, 0.056,  99.993,  -7.224),
    ("Blauer",               "Bicep",               0.522, 0.761, 0.412, 0.012100, 0.721000, 0.247, 0.047, 129.00,  -7.342),
    ("Glue",                 "Bicep",               0.498, 0.823, 0.444, 0.007610, 0.851000, 0.084, 0.039, 138.00,  -8.014),
    ("Teardrop",             "Massive Attack",      0.510, 0.444, 0.424, 0.024100, 0.552000, 0.108, 0.043,  97.013, -12.55),
    ("Dissolved Girl",       "Massive Attack",      0.440, 0.549, 0.151, 0.010200, 0.611000, 0.111, 0.028, 107.99, -12.09),
    ("Strobe",               "deadmau5",            0.439, 0.614, 0.338, 0.014000, 0.929000, 0.102, 0.041, 128.01, -10.14),
    ("Scary Monsters",       "Skrillex",            0.527, 0.944, 0.367, 0.001210, 0.003350, 0.167, 0.044, 140.00,  -3.724),
    ("Pursuit Of Happiness", "Kid Cudi",            0.491, 0.672, 0.457, 0.011900, 0.026800, 0.183, 0.039, 130.07,  -7.421),
    ("Levels",               "Avicii",              0.712, 0.867, 0.789, 0.007510, 0.000003, 0.145, 0.033, 126.00,  -6.111),
    # ACOUSTIC / FOLK / MELLOW
    ("Skinny Love",          "Bon Iver",            0.448, 0.477, 0.291, 0.778000, 0.034900, 0.117, 0.028, 133.18,  -9.881),
    ("Holocene",             "Bon Iver",            0.305, 0.390, 0.189, 0.806000, 0.046200, 0.117, 0.027, 100.01, -12.29),
    ("Flightless Bird",      "Iron & Wine",         0.375, 0.227, 0.344, 0.977000, 0.108000, 0.084, 0.027,  87.007, -14.06),
    ("Fast Car",             "Tracy Chapman",       0.570, 0.558, 0.659, 0.797000, 0.000017, 0.118, 0.032, 100.01,  -7.955),
    ("The Night Will Always Win", "MCR",            0.336, 0.346, 0.168, 0.750000, 0.000000, 0.091, 0.030, 138.85, -11.36),
    ("Moon River",           "Frank Ocean",         0.493, 0.311, 0.641, 0.891000, 0.000000, 0.116, 0.034,  72.025, -13.12),
    ("Landslide",            "Fleetwood Mac",       0.327, 0.256, 0.440, 0.889000, 0.000000, 0.103, 0.030,  76.014, -14.34),
    ("The Night We Met",     "Lord Huron",          0.336, 0.340, 0.134, 0.706000, 0.000000, 0.118, 0.027, 122.05, -10.87),
    # DARK POP / BILLIE EILISH
    ("Bad Guy",              "Billie Eilish",       0.701, 0.425, 0.561, 0.001290, 0.000000, 0.073, 0.300, 135.00, -14.07),
    ("Therefore I Am",       "Billie Eilish",       0.756, 0.575, 0.658, 0.007760, 0.000001, 0.082, 0.291, 115.00,  -9.000),
    ("Lovely",               "Billie Eilish",       0.350, 0.304, 0.102, 0.925000, 0.000000, 0.122, 0.034, 115.01, -13.47),
    ("Ocean Eyes",           "Billie Eilish",       0.377, 0.353, 0.271, 0.767000, 0.000007, 0.099, 0.026, 150.02, -10.71),
    ("Happier Than Ever",    "Billie Eilish",       0.390, 0.427, 0.266, 0.353000, 0.000000, 0.087, 0.034, 104.97, -11.21),
    # LATIN / GLOBAL
    ("Despacito",            "Luis Fonsi",          0.694, 0.815, 0.810, 0.225000, 0.000000, 0.115, 0.105,  88.931,  -5.804),
    ("Con Calma",            "Daddy Yankee",        0.827, 0.803, 0.741, 0.048200, 0.000000, 0.110, 0.065,  96.003,  -3.985),
    ("Tití Me Preguntó",     "Bad Bunny",           0.896, 0.803, 0.838, 0.009960, 0.000001, 0.154, 0.221, 176.02,  -3.621),
    ("Ojitos Lindos",        "Bad Bunny",           0.737, 0.605, 0.745, 0.157000, 0.000002, 0.124, 0.049,  87.008,  -7.202),
    # CLASSIC / TIMELESS
    ("Bohemian Rhapsody",    "Queen",               0.399, 0.399, 0.216, 0.279000, 0.000949, 0.340, 0.031, 142.04, -12.09),
    ("Africa",               "Toto",                0.628, 0.507, 0.633, 0.037400, 0.000063, 0.221, 0.031,  92.869,  -9.684),
    ("Dreams",               "Fleetwood Mac",       0.541, 0.567, 0.676, 0.010700, 0.000037, 0.143, 0.033, 119.97, -11.06),
    ("Running Up That Hill", "Kate Bush",           0.480, 0.725, 0.376, 0.060200, 0.000006, 0.133, 0.031, 113.97,  -9.403),
]

N_SONGS = len(SONG_LIBRARY)

# Pre-extract feature matrix from song library for nearest-neighbour lookup
SONG_FEATURES_RAW = np.array([s[2:] for s in SONG_LIBRARY], dtype=float)

# ─── User taste profiles ───────────────────────────────────────────────────────
# Each profile defines a MEAN feature vector in the same 9D space as Spotify.
# Sampled posts will be gaussian-noised around this mean, so each user's
# actual post history reflects realistic variation around their taste centre.
#
# Format: (label, [dance, energy, valence, acoustic, instrumental, live, speech, tempo, loudness])
#
# These means are derived from averaging real songs of that style —
# no genre labels are passed to the algorithm, only the numbers.

TASTE_PROFILES = [
    # ── High-energy hip-hop / trap ──────────────────────────────────────────
    ("trap_core",       [0.82, 0.72, 0.45, 0.005, 0.00002, 0.13, 0.24, 148.0, -6.0]),
    ("cloud_rap",       [0.78, 0.60, 0.40, 0.012, 0.00001, 0.14, 0.18, 140.0, -7.0]),
    ("conscious_hiphop",[0.70, 0.65, 0.50, 0.004, 0.00001, 0.12, 0.28, 135.0, -6.5]),

    # ── Pop / mainstream ────────────────────────────────────────────────────
    ("euphoric_pop",    [0.72, 0.85, 0.88, 0.010, 0.00001, 0.14, 0.05, 125.0, -4.0]),
    ("midtempo_pop",    [0.62, 0.70, 0.65, 0.030, 0.00000, 0.11, 0.06, 115.0, -5.5]),
    ("sad_pop",         [0.45, 0.45, 0.28, 0.200, 0.00000, 0.10, 0.04, 130.0, -8.5]),

    # ── R&B / neo-soul ──────────────────────────────────────────────────────
    ("smooth_rnb",      [0.72, 0.55, 0.70, 0.160, 0.00001, 0.10, 0.05, 98.0, -8.0]),
    ("contemporary_rnb",[0.65, 0.58, 0.60, 0.120, 0.00000, 0.11, 0.06, 104.0, -7.5]),

    # ── Indie / alternative ─────────────────────────────────────────────────
    ("indie_rock",      [0.48, 0.80, 0.38, 0.006, 0.00100, 0.14, 0.03, 130.0, -5.5]),
    ("dream_pop",       [0.52, 0.62, 0.55, 0.080, 0.00400, 0.09, 0.03, 108.0, -8.0]),
    ("psych_rock",      [0.62, 0.72, 0.68, 0.055, 0.00060, 0.10, 0.03, 115.0, -8.5]),

    # ── Electronic / dance ──────────────────────────────────────────────────
    ("big_room_edm",    [0.68, 0.88, 0.72, 0.008, 0.00010, 0.19, 0.04, 128.0, -4.5]),
    ("ambient_electronic",[0.50, 0.65, 0.40, 0.015, 0.70000, 0.15, 0.04, 128.0, -9.0]),
    ("trip_hop",        [0.50, 0.50, 0.32, 0.022, 0.58000, 0.11, 0.04, 100.0, -12.0]),

    # ── Acoustic / folk ─────────────────────────────────────────────────────
    ("folk_acoustic",   [0.40, 0.32, 0.38, 0.860, 0.05000, 0.10, 0.03, 100.0, -12.5]),
    ("singer_songwriter",[0.52, 0.45, 0.55, 0.750, 0.00001, 0.11, 0.03, 108.0, -10.0]),

    # ── Dark pop / art pop ──────────────────────────────────────────────────
    ("dark_pop",        [0.55, 0.40, 0.35, 0.450, 0.00000, 0.09, 0.15, 118.0, -12.0]),
    ("whisper_pop",     [0.38, 0.35, 0.22, 0.800, 0.00000, 0.10, 0.03, 112.0, -13.5]),

    # ── Latin / global ──────────────────────────────────────────────────────
    ("reggaeton",       [0.84, 0.81, 0.78, 0.060, 0.00000, 0.12, 0.12, 100.0, -4.5]),
    ("latin_pop",       [0.74, 0.72, 0.80, 0.120, 0.00000, 0.12, 0.08, 95.0,  -6.0]),
]

# Per-feature standard deviations for sampling.
# Smaller = users in that profile post very consistently; larger = more eclectic.
# These are tuned to feel realistic: tempo varies more than acousticness.
SAMPLE_STD = np.array([
    0.08,   # danceability
    0.10,   # energy
    0.12,   # valence
    0.08,   # acousticness
    0.05,   # instrumentalness
    0.04,   # liveness
    0.04,   # speechiness
    12.0,   # tempo (BPM)
    1.5,    # loudness (dB)
])

USER_IDS       = [f"user-{i}" for i in range(1, 51)]   # 50 users
POSTS_PER_USER = 12   # more posts → more stable averaged position


# ─── Helpers ──────────────────────────────────────────────────────────────────

def normalise_features(features: np.ndarray) -> np.ndarray:
    """
    Bring tempo and loudness onto a comparable scale to the 0–1 features.
    Uses the same ranges as the Spotify API docs so the normalisation is
    semantically meaningful, not just data-driven.
    """
    f = features.copy()
    # Tempo: typical range 60–200 BPM
    f[..., 7] = (f[..., 7] - 60.0) / 140.0
    # Loudness: typical range -60 to 0 dBFS  
    f[..., 8] = (f[..., 8] + 60.0) / 60.0
    return np.clip(f, 0.0, 1.0)


def nearest_song(feature_vector: np.ndarray, normalised_library: np.ndarray) -> int:
    """Return index of the song in the library closest to feature_vector."""
    diffs = normalised_library - feature_vector
    dists = np.sqrt((diffs ** 2).sum(axis=1))
    return int(np.argmin(dists))


def sample_user_posts(
    profile_mean: np.ndarray,
    n_posts: int,
    rng: np.random.Generator,
) -> np.ndarray:
    """
    Sample n_posts feature vectors from a multivariate normal centered on
    profile_mean with diagonal covariance (SAMPLE_STD^2).
    Clip to valid Spotify feature ranges.
    """
    noise  = rng.normal(0, SAMPLE_STD, size=(n_posts, len(FEATURE_COLS)))
    posts  = profile_mean + noise
    # Hard clip: 0–1 for all features except tempo (60–200) and loudness (-30 to 0)
    posts[:, :7] = np.clip(posts[:, :7], 0.0, 1.0)
    posts[:,  7] = np.clip(posts[:,  7], 60.0, 200.0)
    posts[:,  8] = np.clip(posts[:,  8], -30.0, 0.0)
    return posts


# ─── Pipeline ─────────────────────────────────────────────────────────────────

def run_pipeline(vectors: np.ndarray, user_ids: list[str], pca_components: int = 6):
    """
    StandardScaler → PCA(k) → UMAP(2)
    Returns scaled 2D coordinates and diagnostics.
    """
    scaler     = StandardScaler()
    scaled     = scaler.fit_transform(vectors)

    k          = min(pca_components, len(vectors) - 1, vectors.shape[1])
    pca        = PCA(n_components=k, random_state=42)
    pca_coords = pca.fit_transform(scaled)

    explained  = pca.explained_variance_ratio_
    diag = {
        "algorithm":           "PCA only (install umap-learn for best results)",
        "pca_components_used": k,
        "variance_explained":  float(round(explained.cumsum()[-1], 4)),
        "per_component":       [round(float(v), 4) for v in explained],
    }

    if UMAP_AVAILABLE:
        reducer = umap.UMAP(
            n_neighbors  = min(10, len(vectors) - 1),
            min_dist     = 0.12,
            spread       = 1.4,
            n_components = 2,
            metric       = "euclidean",
            random_state = 42,
            n_epochs     = 750,
            init         = "spectral",
        )
        embedding = reducer.fit_transform(pca_coords)
        diag["algorithm"] = "PCA + UMAP"
    else:
        embedding = pca_coords[:, :2]

    # Scale to [-280, 280] coordinate space
    mins   = embedding.min(axis=0)
    maxs   = embedding.max(axis=0)
    ranges = np.where(maxs - mins == 0, 1, maxs - mins)
    coords = ((embedding - mins) / ranges - 0.5) * 560   # 560 = 2 * 280

    return coords, diag


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("🎵  Generating Lyra music map data (feature-first, no genre hardcoding)")
    print(f"    Song library : {N_SONGS} songs")
    print(f"    Taste profiles: {len(TASTE_PROFILES)}")
    print(f"    Users        : {len(USER_IDS)}")
    print(f"    Posts/user   : {POSTS_PER_USER}")

    # Normalise song library once for nearest-neighbour lookup
    norm_library = normalise_features(SONG_FEATURES_RAW)

    # Build one averaged feature vector per user
    user_vectors  = []
    user_metadata = []  # store per-user "today's song" info

    for i, user_id in enumerate(USER_IDS):
        rng = np.random.default_rng(seed=i * 137 + 42)

        # Assign taste profile (cycles through 20 profiles across 50 users)
        profile_label, profile_mean_list = TASTE_PROFILES[i % len(TASTE_PROFILES)]
        profile_mean = np.array(profile_mean_list, dtype=float)

        # Sample post feature vectors from this user's taste distribution
        posts = sample_user_posts(profile_mean, POSTS_PER_USER, rng)  # (N, 9)

        # Average posts → single vector representing this user's taste
        mean_vec = posts.mean(axis=0)
        user_vectors.append(mean_vec)

        # "Today's post" = last sampled post, matched to nearest real song
        todays_features = posts[-1]
        norm_todays     = normalise_features(todays_features.reshape(1, -1))[0]
        song_idx        = nearest_song(norm_todays, norm_library)
        song            = SONG_LIBRARY[song_idx]

        user_metadata.append({
            "userId":    user_id,
            "songToday": {
                "user_id":   user_id,
                "songTitle": song[0],
                "artist":    song[1],
                "features": {
                    col: round(float(todays_features[j]), 6)
                    for j, col in enumerate(FEATURE_COLS)
                },
            },
            "profile": profile_label,   # debug only — not used by the UI
        })

    vectors_np = np.array(user_vectors)   # (50, 9)
    print(f"\n    Feature matrix: {vectors_np.shape}")

    coords, diag = run_pipeline(vectors_np, USER_IDS, pca_components=6)

    print(f"\n    Algorithm : {diag['algorithm']}")
    print(f"    PCA dims  : {diag['pca_components_used']}  "
          f"({diag['variance_explained']*100:.1f}% variance explained)")
    print(f"    Per-component: "
          + "  ".join(f"PC{j+1}={v*100:.1f}%" for j, v in enumerate(diag["per_component"])))
    print(f"\n    X range: [{coords[:,0].min():.1f}, {coords[:,0].max():.1f}]")
    print(f"    Y range: [{coords[:,1].min():.1f}, {coords[:,1].max():.1f}]")

    # Spot-check: which users are nearest neighbours in embedding space?
    print("\n    Nearest-neighbour sanity check:")
    for check_idx in [0, 8, 13, 19]:  # trap, acoustic, pop, dark-pop
        dists = np.sqrt(((coords - coords[check_idx]) ** 2).sum(axis=1))
        dists[check_idx] = np.inf
        nearest = int(np.argmin(dists))
        print(f"      {USER_IDS[check_idx]} ({user_metadata[check_idx]['profile']}) "
              f"→ nearest: {USER_IDS[nearest]} ({user_metadata[nearest]['profile']})")

    # Build output JSON
    output = []
    for i, meta in enumerate(user_metadata):
        output.append({
            "userId":    meta["userId"],
            "x":         round(float(coords[i][0]), 4),
            "y":         round(float(coords[i][1]), 4),
            "songToday": meta["songToday"],
        })

    out_path = "src/data/generatedMusicMap.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n✅  Written → {out_path}  ({len(output)} users)")
    return output


if __name__ == "__main__":
    main()