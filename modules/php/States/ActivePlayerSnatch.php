<?php
declare(strict_types=1);

namespace Bga\Games\LinkoAbluxxen\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\LinkoAbluxxen\Game;

/**
 * State 20 — Active player decides whether to take each snatchable stack.
 */
class ActivePlayerSnatch extends GameState
{
    function __construct(protected Game $game)
    {
        parent::__construct($game,
            id: 20,
            type: StateType::ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must decide: take or skip snatched cards'),
            descriptionMyTurn: clienttranslate('${you} can take the snatched cards'),
        );
    }

    public function getArgs(): array
    {
        $snatches = $this->globals->get('pending_snatches', []);
        $idx      = intval($this->globals->get('snatch_idx', 0));
        $snatch   = $snatches[$idx] ?? [];

        $robbedName = '';
        if (!empty($snatch['player_id'])) {
            $robbedName = $this->game->getPlayerNameById(intval($snatch['player_id']));
        }

        return [
            'snatch'      => $snatch,
            'robbed_name' => $robbedName,
        ];
    }

    /** Active player takes the snatched cards into their own hand. */
    #[PossibleAction]
    public function actTakeSnatch(int $activePlayerId): string
    {
        $snatches  = $this->globals->get('pending_snatches', []);
        $idx       = intval($this->globals->get('snatch_idx', 0));
        $snatch    = $snatches[$idx];
        $robbedId  = intval($snatch['player_id']);
        $rowIdx    = intval($snatch['row_idx']);
        $cardIds   = $snatch['card_ids'];
        $cardCount = intval($snatch['card_count']);

        // Move cards from robbed player's stack to active player's hand
        $this->game->cards->moveCards($cardIds, 'hand', $activePlayerId);

        // Fetch full card data for notification
        $cards = array_values($this->game->cards->getCardsInLocation('hand', $activePlayerId));
        $takenCards = array_filter($cards, fn($c) => in_array($c['id'], $cardIds));

        $this->notify->all('snatchTaken', clienttranslate('${player_name} takes cards from ${robbed_name}'), [
            'player_id'   => $activePlayerId,
            'player_name' => $this->game->getPlayerNameById($activePlayerId),
            'robbed_id'   => $robbedId,
            'robbed_name' => $this->game->getPlayerNameById($robbedId),
            'cards'       => array_values($takenCards),
            'row_idx'     => $rowIdx,
        ]);

        // Robbed player must draw the same number of replacement cards
        $this->globals->set('robbed_player_id', $robbedId);
        $this->globals->set('draw_count', $cardCount);
        $this->globals->set('draw_for_robbed', 1);

        return PrepareRobbed::class;
    }

    /** Active player declines; robbed player decides what to do with their cards. */
    #[PossibleAction]
    public function actSkipSnatch(int $activePlayerId): string
    {
        $snatches = $this->globals->get('pending_snatches', []);
        $idx      = intval($this->globals->get('snatch_idx', 0));
        $snatch   = $snatches[$idx];
        $robbedId = intval($snatch['player_id']);

        $this->notify->all('snatchDeclined', clienttranslate('${player_name} declines the snatched cards'), [
            'player_id'   => $activePlayerId,
            'player_name' => $this->game->getPlayerNameById($activePlayerId),
            'robbed_id'   => $robbedId,
            'row_idx'     => intval($snatch['row_idx']),
        ]);

        $this->globals->set('robbed_player_id', $robbedId);
        $this->globals->set('draw_for_robbed', 0);

        return PrepareRobbed::class;
    }

    function zombie(int $playerId): string
    {
        return $this->actSkipSnatch($playerId);
    }
}
