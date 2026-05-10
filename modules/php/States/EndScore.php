<?php
declare(strict_types=1);

namespace Bga\Games\LinkoAbluxxen\States;

use Bga\GameFramework\StateType;
use Bga\Games\LinkoAbluxxen\Game;

const ST_END_GAME = 99;

class EndScore extends \Bga\GameFramework\States\GameState
{
    function __construct(protected Game $game)
    {
        parent::__construct($game,
            id: 98,
            type: StateType::GAME,
        );
    }

    public function onEnteringState(): int
    {
        $players = $this->game->loadPlayersBasicInfos();

        foreach ($players as $playerId => $player) {
            $playerId = (int)$playerId;

            // Count stacked cards (+1 each)
            $stackedCount = 0;
            for ($i = 0; $i < 109; $i++) {
                $stackedCount += count($this->game->cards->getCardsInLocation('playertable' . $i, $playerId));
            }

            // Count hand cards (-1 each)
            $handCount = count($this->game->cards->getCardsInLocation('hand', $playerId));

            $finalScore = $stackedCount - $handCount;
            $this->playerScore->set($playerId, $finalScore);

            $this->notify->all('finalScore', '', [
                'player_id'    => $playerId,
                'stacked'      => $stackedCount,
                'hand_penalty' => $handCount,
                'score'        => $finalScore,
            ]);
        }

        return ST_END_GAME;
    }
}
