<?php
/**
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * LinkoAbluxxen implementation : © Joni Ahola aholanjoni@gmail.com
 */
declare(strict_types=1);

namespace Bga\Games\LinkoAbluxxen;

use Bga\Games\LinkoAbluxxen\States\PlayerTurn;
use Bga\GameFramework\Components\Deck;

class Game extends \Bga\GameFramework\Table
{
    public static array $CARD_TYPES;
    public Deck $cards;

    public function __construct()
    {
        parent::__construct();
        $this->initGameStateLabels([]);
        $this->cards = $this->deckFactory->createDeck('card');

        self::$CARD_TYPES = [
            1  => ['card_name' => clienttranslate('1')],
            2  => ['card_name' => clienttranslate('2')],
            3  => ['card_name' => clienttranslate('3')],
            4  => ['card_name' => clienttranslate('4')],
            5  => ['card_name' => clienttranslate('5')],
            6  => ['card_name' => clienttranslate('6')],
            7  => ['card_name' => clienttranslate('7')],
            8  => ['card_name' => clienttranslate('8')],
            9  => ['card_name' => clienttranslate('9')],
            10 => ['card_name' => clienttranslate('10')],
            11 => ['card_name' => clienttranslate('11')],
            12 => ['card_name' => clienttranslate('12')],
            13 => ['card_name' => clienttranslate('13')],
            14 => ['card_name' => clienttranslate('X')],
        ];
    }

    public function getGameProgression()
    {
        $totalCards = 109;
        $playedCards = 0;
        foreach ($this->loadPlayersBasicInfos() as $playerId => $player) {
            for ($i = 0; $i < 109; $i++) {
                $playedCards += count($this->cards->getCardsInLocation('playertable' . $i, (int)$playerId));
            }
        }
        return min(99, intval($playedCards / $totalCards * 100));
    }

    public function upgradeTableDb($from_version) {}

    protected function getAllDatas(): array
    {
        $result = [];
        $currentPlayerId = (int) $this->getCurrentPlayerId();

        $result['players'] = $this->getCollectionFromDb(
            "SELECT `player_id` `id`, `player_score` `score`, `player_name` FROM `player`"
        );
        $result['card_types'] = self::$CARD_TYPES;

        $result['current_player'] = [
            'id'          => $currentPlayerId,
            'hand'        => $this->cards->getCardsInLocation('hand', $currentPlayerId),
            'playertables' => $this->getPlayerStackRows($currentPlayerId),
        ];

        $result['players_hands'] = [];
        foreach ($result['players'] as $playerId => $player) {
            $result['players_hands'][$playerId] = [
                'name'        => $player['player_name'],
                'hand'        => $this->cards->getCardsInLocation('hand', (int)$playerId),
                'playertables' => $this->getPlayerStackRows((int)$playerId),
            ];
        }

        $result['pool']       = $this->cards->getCardsInLocation('pool');
        $result['discardpile'] = $this->cards->getCardsInLocation('discardpile');
        $result['deck_count'] = count($this->cards->getCardsInLocation('deck'));

        $pending = $this->globals->get('pending_snatches', []);
        $idx     = intval($this->globals->get('snatch_idx', 0));
        $result['current_snatch'] = (!empty($pending) && isset($pending[$idx])) ? $pending[$idx] : null;

        return $result;
    }

    protected function setupNewGame($players, $options = [])
    {
        $gameinfos     = $this->getGameinfos();
        $defaultColors = $gameinfos['player_colors'];

        $queryValues = [];
        foreach ($players as $playerId => $player) {
            $queryValues[] = vsprintf("('%s', '%s', '%s', '%s', '%s')", [
                $playerId,
                array_shift($defaultColors),
                $player['player_canal'],
                addslashes($player['player_name']),
                addslashes($player['player_avatar']),
            ]);
        }

        static::DbQuery(sprintf(
            "INSERT INTO player (player_id, player_color, player_canal, player_name, player_avatar) VALUES %s",
            implode(',', $queryValues)
        ));

        $this->reattributeColorsBasedOnPreferences($players, $gameinfos['player_colors']);
        $this->reloadPlayersBasicInfos();

        // Create cards: 8 of each number 1-13, 5 jokers (type 14)
        $cards = [];
        foreach (array_keys(self::$CARD_TYPES) as $type) {
            $cards[] = ['type' => $type, 'type_arg' => $type, 'nbr' => ($type === 14 ? 5 : 8)];
        }
        $this->cards->createCards($cards, 'deck', 0);
        $this->cards->shuffle('deck');

        // Deal 13 cards per player
        foreach ($players as $playerId => $player) {
            $this->cards->pickCardsForLocation(13, 'deck', 'hand', (int)$playerId);
        }

        // Reveal 6 cards to pool (card row)
        $this->cards->pickCardsForLocation(6, 'deck', 'pool', 0);

        $this->activeNextPlayer();
        return PlayerTurn::class;
    }

    // -------------------------------------------------------------------------
    // Public helpers used by State classes
    // -------------------------------------------------------------------------

    public function getPlayerStackRows(int $playerId): array
    {
        $rows = [];
        for ($i = 0; $i < 109; $i++) {
            $rows[$i] = array_values($this->cards->getCardsInLocation('playertable' . $i, $playerId));
        }
        return $rows;
    }

    /** Returns highest row index that has cards, or -1 if stack is empty. */
    public function getTopStackRowIdx(int $playerId): int
    {
        $top = -1;
        for ($i = 0; $i < 109; $i++) {
            if (!empty($this->cards->getCardsInLocation('playertable' . $i, $playerId))) {
                $top = $i;
            }
        }
        return $top;
    }

    /** Returns the next empty row index to play into. */
    public function getNextPlayTableRowIdx(int $playerId): int
    {
        for ($i = 0; $i < 109; $i++) {
            if (empty($this->cards->getCardsInLocation('playertable' . $i, $playerId))) {
                return $i;
            }
        }
        return 108;
    }

    /**
     * Effective value of a set of cards: the number card type, or 15 if all jokers (beats 13).
     */
    public function getRowEffectiveValue(array $cards): int
    {
        foreach ($cards as $c) {
            if (intval($c['type']) !== 14) {
                return intval($c['type']);
            }
        }
        return 15; // all jokers
    }

    /**
     * Returns player IDs in clockwise order starting AFTER $startPlayerId.
     */
    public function getClockwisePlayersFrom(int $startPlayerId): array
    {
        $rows = $this->getObjectListFromDB(
            "SELECT player_id, player_no FROM player ORDER BY player_no"
        );
        $ids      = array_column($rows, 'player_id');
        $startIdx = array_search((string)$startPlayerId, $ids);
        if ($startIdx === false) {
            return [];
        }
        return array_map('intval', array_merge(
            array_slice($ids, $startIdx + 1),
            array_slice($ids, 0, $startIdx)
        ));
    }

    /**
     * Returns array of snatch targets (clockwise from active player).
     * Each entry: ['player_id', 'row_idx', 'card_ids', 'card_count'].
     */
    public function computeSnatches(int $activePlayerId, array $playedCards): array
    {
        $playedCount = count($playedCards);
        $playedValue = $this->getRowEffectiveValue($playedCards);

        $snatches = [];
        foreach ($this->getClockwisePlayersFrom($activePlayerId) as $otherId) {
            $rowIdx = $this->getTopStackRowIdx($otherId);
            if ($rowIdx < 0) {
                continue;
            }

            $topRow = array_values($this->cards->getCardsInLocation('playertable' . $rowIdx, $otherId));
            if (empty($topRow) || count($topRow) !== $playedCount) {
                continue;
            }

            $rowValue = $this->getRowEffectiveValue($topRow);
            if ($playedValue > $rowValue) {
                $snatches[] = [
                    'player_id'  => $otherId,
                    'row_idx'    => $rowIdx,
                    'card_ids'   => array_column($topRow, 'id'),
                    'card_count' => count($topRow),
                ];
            }
        }

        return $snatches;
    }

    /** Refill pool up to 6 cards from deck and notify. */
    public function replenishPool(): void
    {
        $poolCount = count($this->cards->getCardsInLocation('pool'));
        $deckCount = count($this->cards->getCardsInLocation('deck'));
        $toAdd     = min(6 - $poolCount, $deckCount);
        if ($toAdd <= 0) {
            return;
        }
        $newCards = $this->cards->pickCardsForLocation($toAdd, 'deck', 'pool', 0);
        $this->notify->all('poolReplenished', '', [
            'cards' => array_values($newCards),
        ]);
    }

    /**
     * Game end: any player has 0 hand cards, OR pool AND deck both empty.
     */
    public function isGameOver(): bool
    {
        foreach ($this->loadPlayersBasicInfos() as $playerId => $player) {
            if (count($this->cards->getCardsInLocation('hand', (int)$playerId)) === 0) {
                return true;
            }
        }
        $poolEmpty = count($this->cards->getCardsInLocation('pool')) === 0;
        $deckEmpty = count($this->cards->getCardsInLocation('deck')) === 0;
        return $poolEmpty && $deckEmpty;
    }

    // -------------------------------------------------------------------------
    // Debug helpers (studio only)
    // -------------------------------------------------------------------------

    public function debug_clearAllCards(): void
    {
        $this->cards->deleteCardsInLocation('deck');
        $this->cards->deleteCardsInLocation('hand');
        $this->cards->deleteCardsInLocation('pool');
        $this->cards->deleteCardsInLocation('discardpile');
        for ($i = 0; $i < 109; $i++) {
            $this->cards->deleteCardsInLocation('playertable' . $i);
        }
    }

    public function debug_goToState(int $state = 10): void
    {
        $this->gamestate->jumpToState($state);
    }

    public function debug_playAutomatically(int $moves = 50): void
    {
        $count = 0;
        while (intval($this->gamestate->getCurrentMainStateId()) < 99 && $count < $moves) {
            $count++;
            foreach ($this->gamestate->getActivePlayerList() as $playerId) {
                $this->gamestate->runStateClassZombie(
                    $this->gamestate->getCurrentState((int)$playerId),
                    (int)$playerId
                );
            }
        }
    }
}
