<?php
declare(strict_types=1);

namespace Bga\Games\LinkoAbluxxen\States;

use Bga\GameFramework\StateType;
use Bga\Games\LinkoAbluxxen\Game;

/**
 * State 25 — GAME state that switches the active player to the robbed player,
 * then routes to RobbedPlayerDecision or RobbedPlayerDraw.
 */
class PrepareRobbed extends \Bga\GameFramework\States\GameState
{
    function __construct(protected Game $game)
    {
        parent::__construct($game,
            id: 25,
            type: StateType::GAME,
        );
    }

    function onEnteringState(int $activePlayerId): string
    {
        $robbedId = intval($this->globals->get('robbed_player_id', 0));
        $this->game->gamestate->changeActivePlayer($robbedId);
        $this->game->giveExtraTime($robbedId);

        $drawForRobbed = intval($this->globals->get('draw_for_robbed', 0));
        if ($drawForRobbed === 1) {
            return RobbedPlayerDraw::class;
        }
        return RobbedPlayerDecision::class;
    }
}
