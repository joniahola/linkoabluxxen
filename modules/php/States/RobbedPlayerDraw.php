<?php
declare(strict_types=1);

namespace Bga\Games\LinkoAbluxxen\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\LinkoAbluxxen\Game;

/**
 * State 40 — Robbed player draws replacement cards one at a time from the pool or deck.
 */
class RobbedPlayerDraw extends GameState
{
    function __construct(protected Game $game)
    {
        parent::__construct($game,
            id: 40,
            type: StateType::ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must draw replacement card(s)'),
            descriptionMyTurn: clienttranslate('${you} must draw ${draw_count} more card(s) — click pool or deck'),
        );
    }

    public function getArgs(): array
    {
        return [
            'draw_count' => intval($this->globals->get('draw_count', 0)),
            'pool'       => $this->game->cards->getCardsInLocation('pool'),
            'deck_count' => count($this->game->cards->getCardsInLocation('deck')),
        ];
    }

    /**
     * Draw one card. Pass $cardId from the pool, or 0 to draw from the deck.
     */
    #[PossibleAction]
    public function actDrawCard(int $cardId, int $activePlayerId): string
    {
        $drawCount = intval($this->globals->get('draw_count', 0));
        if ($drawCount <= 0) {
            throw new UserException('No cards to draw');
        }

        if ($cardId === 0) {
            // Draw blind from the deck
            $deckCards  = $this->game->cards->getCardsInLocation('deck');
            $poolCards  = $this->game->cards->getCardsInLocation('pool');
            if (empty($deckCards)) {
                if (empty($poolCards)) {
                    // Both deck and pool empty — skip all remaining draws and end draw phase
                    $this->globals->set('draw_count', 0);
                    return AdvanceSnatch::class;
                }
                // No deck but pool has cards — skip just this draw
                $drawCount--;
                $this->globals->set('draw_count', $drawCount);
                if ($drawCount > 0) {
                    return static::class;
                }
                return AdvanceSnatch::class;
            }
            $card = $this->game->cards->pickCardForLocation('deck', 'hand', $activePlayerId);

            // Private notification so only the drawing player sees what they got
            $this->notify->player($activePlayerId, 'cardDrawnPrivate', '', ['card' => $card]);
            // Public notification (face-down)
            $this->notify->all('cardDrawn', clienttranslate('${player_name} draws a card from the deck'), [
                'player_id'   => $activePlayerId,
                'player_name' => $this->game->getPlayerNameById($activePlayerId),
                'from_pool'   => false,
                'card'        => null,
            ]);
        } else {
            // Draw a specific card from the pool
            $pool = $this->game->cards->getCardsInLocation('pool');
            if (!isset($pool[$cardId])) {
                throw new UserException('That card is not in the pool');
            }
            $card = $pool[$cardId];
            $this->game->cards->moveCard($cardId, 'hand', $activePlayerId);

            $this->notify->all('cardDrawn', clienttranslate('${player_name} draws ${card_name} from the pool'), [
                'player_id'   => $activePlayerId,
                'player_name' => $this->game->getPlayerNameById($activePlayerId),
                'card_name'   => $card['type'] == 14 ? 'X' : $card['type'],
                'from_pool'   => true,
                'card'        => $card,
            ]);
            $this->game->playerStats->inc('cards_drawn_from_pool', 1, $activePlayerId);
        }

        $drawCount--;
        $this->globals->set('draw_count', $drawCount);

        if ($drawCount > 0) {
            return static::class;
        }
        return AdvanceSnatch::class;
    }

    function zombie(int $playerId): string
    {
        $deckCards = $this->game->cards->getCardsInLocation('deck');
        if (empty($deckCards)) {
            $poolCards = $this->game->cards->getCardsInLocation('pool');
            if (!empty($poolCards)) {
                return $this->actDrawCard((int) array_key_first($poolCards), $playerId);
            }
        }
        return $this->actDrawCard(0, $playerId);
    }
}
