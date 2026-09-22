# Worlds Mayhem Helper

***English** · [Türkçe](README.tr.md)*

A browser console script that tells you which team and which player to pick each round in [Loldle](https://loldle.net)'s **Worlds Mayhem** mode.

It uses the game's own dataset and its own power formula, runs a Monte Carlo simulation of the remaining rounds, and ranks every option by how likely it is to end in a Worlds title.

```
—— Worlds Mayhem öneri  (dolu rol: 0/5, reroll: 3) ——
┌──────────────────────┬─────────────┬───────────┬────────┬──────────────┬────────────┬──────────┐
│ Takım                │ Oyuncu      │ Rol       │ Rating │ Beklenen güç │ Şampiyon % │ Final+ % │
├──────────────────────┼─────────────┼───────────┼────────┼──────────────┼────────────┼──────────┤
│ SK Telecom T1 2013   │ bengi       │ JUNGLE    │ 90     │ 85.87        │ 20.3       │ 73.8     │
│ SK Telecom T1 2013   │ Faker       │ MID       │ 90     │ 85.95        │ 19.8       │ 78.3     │
│ Suning 2020          │ SwordArt    │ SUPPORT   │ 80     │ 84.05        │ 8.5        │ 50.5     │
└──────────────────────┴─────────────┴───────────┴────────┴──────────────┴────────────┴──────────┘
SEÇ:  SK Telecom T1 2013  ->  bengi  (JUNGLE, rating 90)
```

Console output is currently in Turkish.

## Setup

1. Open [loldle.net/worldsMayhem](https://loldle.net/worldsMayhem).
2. Press `F12` and go to the **Console** tab.
3. Paste the whole contents of `worldsmayhem-helper.js` and hit Enter.

If Chrome blocks the first paste into the console, type `allow pasting` as instructed and press Enter.

## Usage

| Command | What it does |
|---|---|
| `wm.go()` | Prints a ranked table of options for the three teams on screen |
| `wm.auto()` | Recomputes automatically every round |
| `wm.stop()` | Turns the automatic mode off |
| `wm.dream()` | Shows the theoretical ceiling roster and the round thresholds |
| `wm.manual(teams, roster)` | Manual input, if the game state can't be read automatically |
| `wm.power(roster)` | Computes the power value of a roster |

Hit spin first, then call `wm.go()`. For hands-off use, `wm.auto()` once is enough:

```js
wm.auto();             // an automatic suggestion each round
wm.go({ sims: 1500 }); // more precise (and slower) estimate
wm.manual(["SK Telecom T1 2013", "Suning 2020", "Flash Wolves 2016"], { MID: "Faker" });
```

## How the game works

None of this is guesswork — the rules were extracted from the game's own bundle.

**Team power:**

```
power = weighted average + carry bonus − weak-link penalty
```

- Role weights: MID `0.24`, ADC `0.23`, JUNGLE `0.20`, TOP `0.17`, SUPPORT `0.16`
- **Carry bonus:** 20% of how far the highest-rated player sits above the team average, 12% for the second, 4% for the third — capped at `+2.5`
- **Weak-link penalty:** 20% of how far the lowest-rated player sits below the average, 10% for the second-lowest — capped at `−2`

**Round thresholds** — every round is played against a fixed power threshold. The opponent shown on screen does not affect the result:

| Round | Threshold |
|---|---|
| Group stage | 77.8 |
| Quarterfinals | 81.9 |
| Semifinals | 84.1 |
| Finals | 88.2 |

The higher power always takes the series; only the scoreline is random (3-0 / 3-1 / 3-2). In-game moments are narrative flavour and do not change power.

**Player ratings** are derived from OraclesElixir data: win rate, KDA, kill participation, CS per minute, gold per minute, damage per minute, gold and CS difference at 15, and so on. Each stat is normalized against players in the same role at the same tournament, combined with role-specific weights, then given a bonus for how far the team placed. The dataset covers 205 teams and 1067 player entries from 2013 to 2025, with ratings between 65 and 99.

## What the script does

1. Reads the dataset from the page's Vue component; if that fails, it downloads the `index.js` bundle and extracts the embedded data block.
2. For every *(team, player, role)* option on screen, it assumes that pick and simulates the remaining rounds hundreds of times. Future rounds are played with a sensible greedy policy, spending rerolls when a round offers nothing good.
3. Reports the expected final power and the title / finalist probability for each option.
4. If you still have rerolls, it compares the value of rerolling against the best option on screen and tells you whether to spin again.

Comparisons use common random numbers (a seeded PRNG), so two options are tested in the same random world and the ranking isn't driven by noise.

Simply picking the highest rating isn't enough: the same rating is worth more in some roles than others, saving a heavily weighted role for a better player later can pay off, and the weak-link penalty means a lopsided roster loses to a balanced one with the same average.

## Known limitations

- In **daily challenge** mode the game forces a team from a specific region into the draw. The script doesn't model that constraint, so its probabilities run slightly optimistic there.
- Thresholds and role weights are hard-coded. If Loldle rebalances them, update `TH` and `W` in the script.
- Data is read from the Vue component first, so a renamed bundle won't break it; bundle extraction is only the fallback.

## Contributing

Issues and pull requests are welcome. Particularly useful:

- Modelling the daily challenge constraints
- A better lookahead than the greedy policy (beam search, etc.)
- Detecting threshold and weight changes automatically

## Disclaimer

This is a fan project. It is not affiliated with Loldle or Riot Games; League of Legends and Riot Games are trademarks of Riot Games, Inc. The script only reads data the browser has already downloaded — it sends no extra requests to the site and writes nothing to the game's servers. Use it in your own browser, for your own amusement.

## License

MIT
