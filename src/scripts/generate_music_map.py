"""
generate_music_map.py
Lyra Music Map — feature-first PCA → UMAP pipeline.

HOW POSITIONS ARE DETERMINED
==============================
No genre labels are used by the algorithm. Users are separated purely by
their audio feature vectors. The pipeline is:

  1.  Each mock user has a TASTE PROFILE — a mean point in 9D Spotify
      feature space (danceability, energy, valence, acousticness, etc.)

  2.  POSTS_PER_USER feature vectors are sampled from a Gaussian centred
      on their profile. This simulates a real post history.

  3.  Posts are averaged → one 9D vector per user.

  4.  Two skewed features (acousticness, instrumentalness) are log-
      transformed before scaling — both are heavily right-skewed (most
      songs near 0), which would otherwise crush the StandardScaler signal
      and make high-acoustic users look identical to low-acoustic users.

  5.  StandardScaler → PCA(k) → UMAP(2).
      n_neighbors scales with sqrt(n_users) so the pipeline works well
      for any dataset size, from 10 to 10,000 users.

  6.  "Today's song" = nearest real song from the library by Euclidean
      distance in normalised feature space.

Migration to production
========================
Replace the taste-profile sampling section with real Spotify post history
from your database. The pipeline (steps 4–6) stays identical.

Requirements:
    pip install numpy pandas umap-learn scikit-learn

Usage:
    python generate_music_map.py
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
    print("⚠️  umap-learn not installed — falling back to PCA only.")
    print("    Run:  pip install umap-learn")

# ─── Feature columns ──────────────────────────────────────────────────────────
FEATURE_COLS = [
    "danceability",      # col 0   0–1
    "energy",            # col 1   0–1
    "valence",           # col 2   0–1
    "acousticness",      # col 3   0–1  (log-transformed before PCA)
    "instrumentalness",  # col 4   0–1  (log-transformed before PCA)
    "liveness",          # col 5   0–1
    "speechiness",       # col 6   0–1
    "tempo",             # col 7   BPM  (normalised 60–200)
    "loudness",          # col 8   dBFS (normalised -60–0)
]
N_FEATURES = len(FEATURE_COLS)

# ─── Real songs with actual Spotify audio features ────────────────────────────
# (title, artist, dance, energy, valence, acoustic, instrumental,
#  liveness, speechiness, tempo, loudness)
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
    # DARK POP
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
    # CLASSIC
    ("Bohemian Rhapsody",    "Queen",               0.399, 0.399, 0.216, 0.279000, 0.000949, 0.340, 0.031, 142.04, -12.09),
    ("Africa",               "Toto",                0.628, 0.507, 0.633, 0.037400, 0.000063, 0.221, 0.031,  92.869,  -9.684),
    ("Dreams",               "Fleetwood Mac",       0.541, 0.567, 0.676, 0.010700, 0.000037, 0.143, 0.033, 119.97, -11.06),
    ("Running Up That Hill", "Kate Bush",           0.480, 0.725, 0.376, 0.060200, 0.000006, 0.133, 0.031, 113.97,  -9.403),
    # EXTRA — fills the library to 110+ so 100 users each get a unique song
    ("Circles",              "Post Malone",         0.695, 0.762, 0.553, 0.016300, 0.000003, 0.194, 0.053, 120.04,  -5.994),
    ("Sunflower",            "Post Malone",         0.760, 0.490, 0.916, 0.278000, 0.000000, 0.101, 0.063, 117.99,  -6.183),
    ("Better Now",           "Post Malone",         0.588, 0.536, 0.415, 0.042300, 0.000000, 0.105, 0.061, 175.98,  -5.766),
    ("rockstar",             "Post Malone",         0.625, 0.554, 0.121, 0.006580, 0.000006, 0.131, 0.077, 159.95,  -6.482),
    ("Lucid Dreams",         "Juice WRLD",          0.511, 0.564, 0.218, 0.081700, 0.000000, 0.131, 0.119, 83.995,  -6.655),
    ("Legends Never Die",    "Juice WRLD",          0.437, 0.512, 0.348, 0.185000, 0.000000, 0.109, 0.050, 185.96,  -6.913),
    ("Robbery",              "Juice WRLD",          0.455, 0.613, 0.169, 0.019800, 0.000000, 0.113, 0.078, 79.969,  -6.143),
    ("XO Tour Llif3",        "Lil Uzi Vert",        0.326, 0.522, 0.105, 0.186000, 0.000000, 0.140, 0.115, 147.95,  -7.499),
    ("Money",                "Cardi B",             0.847, 0.762, 0.474, 0.003030, 0.000007, 0.150, 0.219, 135.96,  -4.813),
    ("WAP",                  "Cardi B",             0.933, 0.493, 0.382, 0.001620, 0.000000, 0.094, 0.365, 89.950,  -9.030),
    ("As Long As You Love Me", "Carly Rae Jepsen", 0.742, 0.673, 0.779, 0.016800, 0.000000, 0.101, 0.040, 138.00,  -5.200),
    ("Run Away to Mars",     "TALK",                0.543, 0.432, 0.303, 0.582000, 0.000000, 0.116, 0.026, 109.97, -10.31),
    ("Coffee",               "beabadoobee",         0.491, 0.517, 0.668, 0.364000, 0.000017, 0.217, 0.026, 137.99,  -8.773),
    ("Death Bed",            "Powfu",               0.532, 0.265, 0.683, 0.870000, 0.000004, 0.140, 0.058, 147.99, -11.69),
    ("Heather",              "Conan Gray",          0.362, 0.317, 0.301, 0.675000, 0.000000, 0.105, 0.034, 96.003, -11.85),
    ("Maniac",               "Conan Gray",          0.691, 0.615, 0.540, 0.015100, 0.000000, 0.087, 0.033, 120.00,  -7.132),
    ("telepatía",            "Kali Uchis",          0.766, 0.617, 0.800, 0.182000, 0.000058, 0.111, 0.046, 110.01,  -8.345),
    ("después de la playa",  "Bad Bunny",           0.837, 0.706, 0.745, 0.009610, 0.000000, 0.185, 0.178, 170.02,  -4.810),
    ("nostalgic",            "ROLE MODEL",          0.636, 0.518, 0.611, 0.149000, 0.000000, 0.104, 0.033, 120.02,  -8.450),
    ("Falling",              "Trevor Daniel",       0.568, 0.366, 0.316, 0.396000, 0.000000, 0.103, 0.037, 76.025, -10.80),
    ("Electric Love",        "BØRNS",               0.703, 0.686, 0.793, 0.023400, 0.000003, 0.086, 0.028, 122.95,  -7.388),
    ("Take Me to Church",    "Hozier",              0.413, 0.704, 0.246, 0.000838, 0.000000, 0.206, 0.050, 130.08,  -5.832),
    ("Cherry Wine",          "Hozier",              0.431, 0.346, 0.290, 0.776000, 0.000009, 0.108, 0.030, 102.09, -11.45),
    ("505",                  "Arctic Monkeys",      0.379, 0.779, 0.212, 0.001310, 0.000010, 0.129, 0.027, 113.99,  -6.543),
]

N_SONGS = len(SONG_LIBRARY)
SONG_FEATURES_RAW = np.array([s[2:] for s in SONG_LIBRARY], dtype=float)

# ─── User taste profiles ───────────────────────────────────────────────────────
# Each profile is a MEAN in raw feature space.
# Values are chosen by averaging real songs of that style — not made up.
# The algorithm never sees these labels; it only sees the numbers.
#
# [dance, energy, valence, acoustic, instrumental, live, speech, tempo, loudness]
TASTE_PROFILES = [
    # High-energy hip-hop
    ("trap_core",            [0.83, 0.72, 0.44, 0.005, 0.00002, 0.14, 0.24, 148.0, -6.0]),
    ("cloud_rap",            [0.79, 0.60, 0.40, 0.012, 0.00001, 0.14, 0.18, 140.0, -7.0]),
    ("conscious_hiphop",     [0.70, 0.65, 0.50, 0.004, 0.00001, 0.12, 0.28, 135.0, -6.5]),
    # Pop
    ("euphoric_pop",         [0.72, 0.85, 0.88, 0.010, 0.00001, 0.14, 0.05, 125.0, -4.0]),
    ("midtempo_pop",         [0.62, 0.70, 0.65, 0.030, 0.00000, 0.11, 0.06, 115.0, -5.5]),
    ("sad_pop",              [0.45, 0.45, 0.28, 0.200, 0.00000, 0.10, 0.04, 130.0, -8.5]),
    # R&B
    ("smooth_rnb",           [0.72, 0.55, 0.70, 0.160, 0.00001, 0.10, 0.05,  98.0, -8.0]),
    ("contemporary_rnb",     [0.65, 0.58, 0.60, 0.120, 0.00000, 0.11, 0.06, 104.0, -7.5]),
    # Indie / alt
    ("indie_rock",           [0.48, 0.82, 0.38, 0.006, 0.00100, 0.14, 0.03, 130.0, -5.5]),
    ("dream_pop",            [0.52, 0.62, 0.55, 0.080, 0.00400, 0.09, 0.03, 108.0, -8.0]),
    ("psych_rock",           [0.62, 0.72, 0.68, 0.055, 0.00060, 0.10, 0.03, 115.0, -8.5]),
    # Electronic
    ("big_room_edm",         [0.68, 0.88, 0.72, 0.008, 0.00010, 0.19, 0.04, 128.0, -4.5]),
    ("ambient_electronic",   [0.50, 0.65, 0.40, 0.015, 0.70000, 0.15, 0.04, 128.0, -9.0]),
    ("trip_hop",             [0.50, 0.50, 0.32, 0.022, 0.58000, 0.11, 0.04, 100.0,-12.0]),
    # Acoustic / folk
    ("folk_acoustic",        [0.40, 0.32, 0.38, 0.860, 0.05000, 0.10, 0.03, 100.0,-12.5]),
    ("singer_songwriter",    [0.52, 0.45, 0.55, 0.750, 0.00001, 0.11, 0.03, 108.0,-10.0]),
    # Dark pop
    ("dark_pop",             [0.55, 0.40, 0.35, 0.450, 0.00000, 0.09, 0.15, 118.0,-12.0]),
    ("whisper_pop",          [0.38, 0.35, 0.22, 0.800, 0.00000, 0.10, 0.03, 112.0,-13.5]),
    # Latin
    ("reggaeton",            [0.84, 0.81, 0.78, 0.060, 0.00000, 0.12, 0.12, 100.0, -4.5]),
    ("latin_pop",            [0.74, 0.72, 0.80, 0.120, 0.00000, 0.12, 0.08,  95.0, -6.0]),
]

# Per-feature std for post sampling — tighter than before so profiles don't blur
SAMPLE_STD = np.array([
    0.06,   # danceability
    0.07,   # energy
    0.09,   # valence
    0.05,   # acousticness  (small because log-transform amplifies differences)
    0.03,   # instrumentalness
    0.03,   # liveness
    0.03,   # speechiness
    8.0,    # tempo (BPM)
    1.2,    # loudness (dB)
])

# ── Change USER_IDS to however many users you want — pipeline auto-adapts ──────
USER_IDS       = [f"user-{i}" for i in range(1, 101)]  # 100 users; change freely
POSTS_PER_USER = 15  # more posts = more stable averaged position


# ─── Preprocessing ─────────────────────────────────────────────────────────────

def preprocess(vectors: np.ndarray) -> np.ndarray:
    """
    Apply log1p transform to right-skewed features before StandardScaler.

    acousticness and instrumentalness are heavily right-skewed:
    - ~75% of songs have acousticness < 0.05
    - ~80% of songs have instrumentalness < 0.001
    Without this transform, StandardScaler compresses most of the variance
    near zero, making high-acoustic and low-acoustic users look almost
    identical in the scaled space.

    We multiply by 10 before log1p to spread the [0, 0.1] range where
    most values cluster, giving PCA/UMAP more to work with there.
    """
    v = vectors.copy().astype(float)
    v[:, 3] = np.log1p(v[:, 3] * 10)  # acousticness
    v[:, 4] = np.log1p(v[:, 4] * 10)  # instrumentalness
    return v


def normalise_for_lookup(features: np.ndarray) -> np.ndarray:
    """
    Bring tempo/loudness to [0,1] range for nearest-song Euclidean lookup.
    Uses Spotify API documented ranges (not data-driven) for consistency.
    """
    f = features.copy().astype(float)
    f[..., 7] = np.clip((f[..., 7] - 60.0) / 140.0, 0, 1)   # tempo
    f[..., 8] = np.clip((f[..., 8] + 60.0) / 60.0,  0, 1)   # loudness
    return f


def nearest_song(fvec: np.ndarray, norm_library: np.ndarray) -> int:
    dists = np.sqrt(((norm_library - fvec) ** 2).sum(axis=1))
    return int(np.argmin(dists))


def sample_posts(profile_mean: np.ndarray, n: int, rng: np.random.Generator) -> np.ndarray:
    posts = profile_mean + rng.normal(0, SAMPLE_STD, size=(n, N_FEATURES))
    posts[:, :7] = np.clip(posts[:, :7], 0.0, 1.0)
    posts[:,  7] = np.clip(posts[:,  7], 60.0, 200.0)
    posts[:,  8] = np.clip(posts[:,  8], -30.0, 0.0)
    return posts


# ─── Overlap nudge ────────────────────────────────────────────────────────────

def nudge_apart(
    coords: np.ndarray,
    min_sep: float = 50.0,
    iterations: int = 25,
    strength: float = 0.35,
) -> np.ndarray:
    """
    Iterative pairwise repulsion to resolve overlapping nodes.

    For each pair of points closer than min_sep, nudge them apart by
    (overlap * strength). Updates are antisymmetric so cluster centroids
    are preserved — this only clears collisions, it does not distort the
    embedding structure.

    O(n^2) per iteration — fine for up to ~500 users.
    """
    pts = coords.copy().astype(float)
    n   = len(pts)
    for _ in range(iterations):
        any_collision = False
        for i in range(n):
            for j in range(i + 1, n):
                diff = pts[i] - pts[j]
                dist = float(np.linalg.norm(diff))
                if 1e-6 < dist < min_sep:
                    overlap   = (min_sep - dist) * strength
                    direction = diff / dist
                    pts[i]   += direction * overlap * 0.5
                    pts[j]   -= direction * overlap * 0.5
                    any_collision = True
        if not any_collision:
            break
    return pts


# ─── Pipeline ─────────────────────────────────────────────────────────────────

def run_pipeline(raw_vectors: np.ndarray) -> tuple[np.ndarray, dict]:
    """
    preprocess → StandardScaler → PCA(k) → UMAP(2)

    Scales automatically with any number of users:
    - PCA components: min(6, n_features, n_users-1)
    - UMAP n_neighbors: scales as ~1.5*sqrt(n_users), clamped to [5, 50]
    - UMAP init: 'spectral' for n>=10, 'random' for very small datasets
    """
    n = len(raw_vectors)

    # Step 1: log-transform skewed features
    processed = preprocess(raw_vectors)

    # Step 2: standardise
    scaler = StandardScaler()
    scaled = scaler.fit_transform(processed)

    # Step 3: PCA — keep enough components for ~95% variance, max 6
    max_k = min(6, n - 1, N_FEATURES)
    pca   = PCA(n_components=max_k, random_state=42)
    pca_coords = pca.fit_transform(scaled)

    cum_var  = pca.explained_variance_ratio_.cumsum()
    # Trim to components needed for 95% variance (keeps at least 2)
    k_used   = max(2, int(np.searchsorted(cum_var, 0.95)) + 1)
    k_used   = min(k_used, max_k)
    pca_coords = pca_coords[:, :k_used]

    diag = {
        "n_users":             n,
        "pca_components_used": k_used,
        "variance_explained":  float(round(cum_var[k_used - 1], 4)),
        "per_component":       [round(float(v), 4) for v in pca.explained_variance_ratio_[:k_used]],
        "algorithm":           "PCA only — install umap-learn for best results",
    }

    # Step 4: UMAP — params scale with n_users
    if UMAP_AVAILABLE:
        # n_neighbors: ~1.5*sqrt(n), clamped [5, 50]
        # Too small → noisy local structure; too large → loses local clusters
        n_neighbors = int(np.clip(1.5 * np.sqrt(n), 5, 50))

        # min_dist: smaller = tighter clusters; we want visible separation
        min_dist = 0.10

        # init: spectral needs n_neighbors < n/2; fall back to random if not
        init = "spectral" if n_neighbors < n / 2 else "random"

        reducer = umap.UMAP(
            n_neighbors  = n_neighbors,
            min_dist     = min_dist,
            spread       = 1.5,
            n_components = 2,
            metric       = "euclidean",
            random_state = 42,
            n_epochs     = max(300, min(750, n * 5)),  # more epochs for small N
            init         = init,
        )
        embedding = reducer.fit_transform(pca_coords)
        diag["algorithm"]   = f"preprocess → PCA({k_used}) → UMAP"
        diag["n_neighbors"] = n_neighbors
        diag["umap_init"]   = init
    else:
        # PCA fallback: use first 2 components
        embedding = pca_coords[:, :2]

    # Scale coordinates: half_range = clip(30*sqrt(n), 160, 320)
    # 20 users → ±160,  50 → ±212,  100 → ±300,  200+ → ±320
    # Kept tight so the default auto-fit view shows the whole map.
    half_range = float(np.clip(30 * np.sqrt(n), 160, 320))
    lo, hi     = embedding.min(axis=0), embedding.max(axis=0)
    rng_       = np.where(hi - lo == 0, 1.0, hi - lo)
    coords     = ((embedding - lo) / rng_ - 0.5) * 2 * half_range

    # Light overlap nudge — min_sep sized to avatar diameter + gap.
    # With smaller canvas we need a smaller sep (32px) to avoid over-expanding.
    coords = nudge_apart(coords, min_sep=32.0, iterations=30, strength=0.4)

    diag["half_range"] = round(half_range, 1)
    return coords, diag


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    n_users = len(USER_IDS)
    print("🎵  Lyra music map generator")
    print(f"    Users:          {n_users}")
    print(f"    Song library:   {N_SONGS} songs")
    print(f"    Taste profiles: {len(TASTE_PROFILES)}")
    print(f"    Posts/user:     {POSTS_PER_USER}")

    norm_library = normalise_for_lookup(SONG_FEATURES_RAW)

    raw_vectors    = []
    user_meta      = []
    used_song_idxs: set[int] = set()   # prevents duplicate songToday across users

    for i, user_id in enumerate(USER_IDS):
        rng = np.random.default_rng(seed=i * 137 + 42)

        profile_label, profile_mean_list = TASTE_PROFILES[i % len(TASTE_PROFILES)]
        profile_mean = np.array(profile_mean_list, dtype=float)

        posts    = sample_posts(profile_mean, POSTS_PER_USER, rng)
        mean_vec = posts.mean(axis=0)
        raw_vectors.append(mean_vec)

        # Find today's song: nearest real song to the sampled feature vector.
        # If that song is already taken by a user with a very different position,
        # walk down the ranked list until we find one not yet used or close enough.
        todays_raw  = posts[-1]
        todays_norm = normalise_for_lookup(todays_raw.reshape(1, -1))[0]

        # Rank all songs by distance
        diffs = norm_library - todays_norm
        dists = np.sqrt((diffs ** 2).sum(axis=1))
        ranked_idxs = np.argsort(dists).tolist()

        # Pick nearest unused song; if all 84 songs are taken, just use nearest
        song_idx = ranked_idxs[0]
        for candidate_idx in ranked_idxs:
            if candidate_idx not in used_song_idxs:
                song_idx = candidate_idx
                break

        used_song_idxs.add(song_idx)
        song = SONG_LIBRARY[song_idx]

        user_meta.append({
            "userId":    user_id,
            "profile":   profile_label,  # debug only
            "songToday": {
                "user_id":   user_id,
                "songTitle": song[0],
                "artist":    song[1],
                "features":  {col: round(float(todays_raw[j]), 6)
                               for j, col in enumerate(FEATURE_COLS)},
            },
        })

    vectors_np = np.array(raw_vectors)
    coords, diag = run_pipeline(vectors_np)

    # ── Print diagnostics ────────────────────────────────────────────────────
    print(f"\n    Algorithm : {diag['algorithm']}")
    print(f"    PCA dims  : {diag['pca_components_used']}  "
          f"({diag['variance_explained']*100:.1f}% variance explained)")
    print(f"    Per-comp  : "
          + "  ".join(f"PC{j+1}={v*100:.1f}%"
                      for j, v in enumerate(diag["per_component"])))
    if "n_neighbors" in diag:
        print(f"    UMAP nn   : {diag['n_neighbors']}  (init={diag['umap_init']})")
    print(f"    X range   : [{coords[:,0].min():.1f}, {coords[:,0].max():.1f}]")
    print(f"    Y range   : [{coords[:,1].min():.1f}, {coords[:,1].max():.1f}]")

    # ── Sanity check: nearest neighbours in embedding ────────────────────────
    print("\n    Nearest-neighbour check (should be same/adjacent profiles):")
    check_indices = [0, 4, 8, 12, 14, 16]  # sample across profiles
    for ci in check_indices:
        if ci >= n_users:
            continue
        dists = np.sqrt(((coords - coords[ci]) ** 2).sum(axis=1))
        dists[ci] = np.inf
        nn = int(np.argmin(dists))
        p1 = user_meta[ci]["profile"]
        p2 = user_meta[nn]["profile"]
        match = "✓" if p1 == p2 else "~"
        print(f"      {match} {USER_IDS[ci]:10s} ({p1:22s}) → {USER_IDS[nn]:10s} ({p2})")

    # ── Build output ─────────────────────────────────────────────────────────
    output = []
    for i, meta in enumerate(user_meta):
        output.append({
            "userId":    meta["userId"],
            "x":         round(float(coords[i][0]), 4),
            "y":         round(float(coords[i][1]), 4),
            "songToday": meta["songToday"],
            # Strip "profile" from production output — debug only
        })

    out_path = "src/data/generatedMusicMap.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n✅  Written → {out_path}  ({n_users} users)")
    print("\n    To change user count: edit USER_IDS at the top of this file.")
    print("    To use real data:     replace sample_posts() with your DB query.")


if __name__ == "__main__":
    main()