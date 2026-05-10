<?php
declare(strict_types=1);

namespace Bga\Games\LinkoAbluxxen\States;

use Bga\GameFramework\StateType;
use Bga\Games\LinkoAbluxxen\Game;

class NextPlayer extends \Bga\GameFramework\States\GameState
{
    function __construct(protected Game $game)
    {
        parent::__construct($game,
            id: 90,
            type: StateType::GAME,
            updateGameProgression: true,
        );
    }

    function onEnteringState(int $activePlayerId): string
    {
        $this->game->giveExtraTime($activePlayerId);

        if ($this->game->isGameOver()) {
            return EndScore::class;
        }

        $this->game->activeNextPlayer();
        return PlayerTurn::class;
    }
}
