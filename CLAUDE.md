# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Board Game Arena (BGA)** implementation of the card game **Linko!** (published by AMIGO). BGA is an online platform; there are no local build, lint, or test commands. Development is done locally and synced to BGA servers via SFTP (configured in `.vscode/sftp.json`).

## Architecture

### Backend (PHP)

The game follows BGA's state machine pattern with a central `Game.php` and state-specific classes:

- **`modules/php/Game.php`** — Main game class (`Bga\Games\LinkoAbluxxen` namespace, extends `\Bga\GameFramework\Table`). Owns the BGA Deck component (`$this->cards`), handles game setup, and provides `getAllDatas()` for client state.
- **`modules/php/States/PlayerTurn.php`** — State 10 (ACTIVE_PLAYER). Handles card play action `actPlayCard()`.
- **`modules/php/States/NextPlayer.php`** — State 90 (GAME). Rotates active player; game-end detection is currently hardcoded `false`.
- **`modules/php/States/EndScore.php`** — State 98 (GAME). Placeholder; transitions directly to state 99 (ST_END_GAME).

State flow: `PlayerTurn (10) → NextPlayer (90) → PlayerTurn (10) → ... → EndScore (98) → 99`

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

- ✅ Game setup, dealing, and card display
- ✅ Player turn with card selection and combination logic (N of a value + jokers)
- ✅ Multiple table rows per player
- ⚠️ Game-end detection not implemented (`$gameEnd = false` in `NextPlayer.php`)
- ❌ Snatching/Abluxxen mechanic: after playing, compare with each neighbor's top stack (clockwise); if count matches AND card number is higher → must snatch; active player decides to take or not; robbed player replenishes hand from card row/draw pile (see `misc/rules.md`)
- ❌ Drawing cards from deck after playing
- ❌ Final score calculation in `EndScore.php`
- ❌ Game options, preferences, and statistics (`gameoptions.json`, `gamepreferences.json`, `stats.json` are empty)
