<?php
declare(strict_types=1);

namespace Bga\Games\LinkoAbluxxen\States;

use Bga\GameFramework\StateType;
use Bga\Games\LinkoAbluxxen\Game;

/**
 * State 45 — GAME state: replenish pool, advance to the next snatch or end the snatch phase.
 */
class AdvanceSnatch extends \Bga\GameFramework\States\GameState
{
    function __construct(protected Game $game)
    {
        parent::__construct($game,
            id: 45,
            type: StateType::GAME,
        );
    }

    function onEnteringState(int $activePlayerId): string
    {
        // Replenish pool to 6 after draws
        $this->game->replenishPool();

        $snatches = $this->globals->get('pending_snatches', []);
        $idx      = intval($this->globals->get('snatch_idx', 0)) + 1;
        $this->globals->set('snatch_idx', $idx);

        // Restore the original active player
        $originalPlayer = intval($this->globals->get('original_active_player', 0));
        $this->game->gamestate->changeActivePlayer($originalPlayer);

        if (isset($snatches[$idx])) {
            // More snatches to resolve — update robbed player for the next one
            $this->globals->set('robbed_player_id', $snatches[$idx]['player_id']);
            return ActivePlayerSnatch::class;
        }

        // All snatches resolved
        return NextPlayer::class;
    }
}
