<?php
declare(strict_types=1);

namespace Bga\Games\LinkoAbluxxen\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\Games\LinkoAbluxxen\Game;

/**
 * State 30 — Robbed player decides: pick up their snatched cards or discard and draw.
 */
class RobbedPlayerDecision extends GameState
{
    function __construct(protected Game $game)
    {
        parent::__construct($game,
            id: 30,
            type: StateType::ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must decide: pick up or discard snatched cards'),
            descriptionMyTurn: clienttranslate('${you} must decide: pick up or discard your snatched cards'),
        );
    }

    public function getArgs(): array
    {
        $snatches = $this->globals->get('pending_snatches', []);
        $idx      = intval($this->globals->get('snatch_idx', 0));
        $snatch   = $snatches[$idx] ?? [];
        return ['snatch' => $snatch];
    }

    /** Robbed player picks up the cards back into their hand. */
    #[PossibleAction]
    public function actPickUp(int $activePlayerId): string
    {
        $snatches  = $this->globals->get('pending_snatches', []);
        $idx       = intval($this->globals->get('snatch_idx', 0));
        $snatch    = $snatches[$idx];
        $rowIdx    = intval($snatch['row_idx']);
        $cardIds   = $snatch['card_ids'];

        $this->game->cards->moveCards($cardIds, 'hand', $activePlayerId);

        $this->notify->all('cardsReturnedToHand', clienttranslate('${player_name} picks up their cards'), [
            'player_id'   => $activePlayerId,
            'player_name' => $this->game->getPlayerNameById($activePlayerId),
            'card_ids'    => $cardIds,
            'row_idx'     => $rowIdx,
        ]);

        return AdvanceSnatch::class;
    }

    /** Robbed player discards their snatched cards and will draw replacements. */
    #[PossibleAction]
    public function actDiscard(int $activePlayerId): string
    {
        $snatches  = $this->globals->get('pending_snatches', []);
        $idx       = intval($this->globals->get('snatch_idx', 0));
        $snatch    = $snatches[$idx];
        $rowIdx    = intval($snatch['row_idx']);
        $cardIds   = $snatch['card_ids'];
        $cardCount = intval($snatch['card_count']);

        $this->game->cards->moveCards($cardIds, 'discardpile', 0);

        $this->notify->all('cardsDiscarded', clienttranslate('${player_name} discards their cards'), [
            'player_id'   => $activePlayerId,
            'player_name' => $this->game->getPlayerNameById($activePlayerId),
            'card_ids'    => $cardIds,
            'row_idx'     => $rowIdx,
        ]);

        $this->globals->set('draw_count', $cardCount);

        // Robbed player is already active, go directly to draw state
        return RobbedPlayerDraw::class;
    }

    function zombie(int $playerId): string
    {
        return $this->actPickUp($playerId);
    }
}
