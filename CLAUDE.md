# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Board Game Arena (BGA)** implementation of the card game **Linko!** (published by AMIGO). BGA is an online platform; there are no local build, lint, or test commands. Development is done locally and synced to BGA servers via SFTP (configured in `.vscode/sftp.json`).

## Architecture

### Backend (PHP)

The game follows BGA's state machine pattern with a central `Game.php` and state-specific classes:

- **`modules/php/Game.php`** — Main game class (`Bga\Games\LinkoAbluxxen` namespace, extends `\Bga\GameFramework\Table`). Owns the BGA Deck component (`$this->cards`), handles game setup, and provides `getAllDatas()` for client state.
- **`modules/php/States/PlayerTurn.php`** — State 10 (ACTIVE_PLAYER). Validates and plays cards to the correct `playertable{i}` row, then calls `computeSnatches()` to decide the next state.
- **`modules/php/States/ActivePlayerSnatch.php`** — State 20 (ACTIVE_PLAYER). Active player takes (`actTakeSnatch`) or skips (`actSkipSnatch`) the current snatch target.
- **`modules/php/States/PrepareRobbed.php`** — State 25 (GAME). Switches the active player to the robbed player, then routes to state 30 or 40.
- **`modules/php/States/RobbedPlayerDecision.php`** — State 30 (ACTIVE_PLAYER). Robbed player picks up their cards or discards and draws.
- **`modules/php/States/RobbedPlayerDraw.php`** — State 40 (ACTIVE_PLAYER). Robbed player draws one card per action from pool (by card ID) or deck (ID=0); loops until `draw_count` reaches 0.
- **`modules/php/States/AdvanceSnatch.php`** — State 45 (GAME). Replenishes pool, increments snatch index, restores original active player, loops back to state 20 or exits to state 90.
- **`modules/php/States/NextPlayer.php`** — State 90 (GAME). Checks `isGameOver()`; if true → EndScore, else `activeNextPlayer()` → PlayerTurn.
- **`modules/php/States/EndScore.php`** — State 98 (GAME). Counts stacked cards (+1) and hand cards (−1) per player, sets final scores, → state 99.

State flow:
```
PlayerTurn (10) → [snatches?] → ActivePlayerSnatch (20) → PrepareRobbed (25, GAME)
                                      ↓                          ↓
                              RobbedPlayerDecision (30)   RobbedPlayerDraw (40)
                                      ↓                          ↓
                                AdvanceSnatch (45, GAME) ←───────┘
                                      ↓
                              NextPlayer (90) → PlayerTurn (10) or EndScore (98) → 99
```

### Frontend (JavaScript)

**`linkoabluxxen.js`** uses BGA's Dojo.js framework with modern BGA libraries:
- `BgaCards` (v1.0.7) — card stock management (HandStock, LineStock, etc.)
- `BgaAnimations` — card movement animations
- `ebg.core.gamegui` — base class

The UI builds dynamically on `setup()`: play areas for all players, pool, deck, discard. On `PlayerTurn` state, action buttons are generated to let the active player select which card value to play, then which combination (number cards + optional jokers), then confirm.

### Database

Single `card` table managed by BGA's Deck component. Key fields:
- `card_type`: `1`–`13` (number cards) or `14` (joker/X)
- `card_location`: `deck`, `pool`, `hand`, `discardpile`, `playertable0`–`playertable108`
- `card_location_arg`: `player_id` for cards in hand or on a player's table

### Game Setup

- 2–5 players; official rules deal **13 cards** per player (current code deals 11 — known discrepancy)
- 6 cards revealed face-up in the **card row** (public draw source); current code calls this "pool"
- 2-player variant: 2 jokers dealt per player directly + 13 cards in card row (house rule, not in official PDF)
- 104 number cards (8 copies each of 1–13) + 5 joker cards + 1 Linko card

## Key Patterns

- **Card type 14** is the joker (displayed as "X" in UI). Type IDs 1–13 match the face value.
- **`get_table_index($playertables)`** in `Game.php` finds the next empty row (`playertable0`–`playertable108`) for a player to play into.
- **`actPlayCard()`** receives a JSON-encoded array of card IDs selected by the active player, validates ownership, moves them to the player's table row, and awards score equal to the card count.
- Debug helpers in `Game.php`: `debug_clearAllCards()`, `debug_goToState()`, `debug_playAutomatically()` — only available in BGA's debug/studio mode.

## Current Implementation Status

- ✅ Game setup, dealing (13 cards), and card display
- ✅ Player turn with card selection and combination logic (N of a value + jokers)
- ✅ Multiple table rows per player (correct `playertable{i}` locations)
- ✅ Snatching mechanic: `computeSnatches()` in Game.php; states 20→25→30/40→45
- ✅ Active player takes or skips snatched cards (state 20)
- ✅ Robbed player picks up or discards + draws from pool/deck (states 30, 40)
- ✅ Pool replenishment after draws (`replenishPool()` called in AdvanceSnatch)
- ✅ Game-end detection (`isGameOver()` in Game.php; checked in NextPlayer)
- ✅ Final score calculation in `EndScore.php` (stacked +1, hand -1)
- ❌ Game options, preferences, and statistics (empty JSON files)
