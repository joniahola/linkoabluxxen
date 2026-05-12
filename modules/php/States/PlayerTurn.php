<?php
declare(strict_types=1);

namespace Bga\Games\LinkoAbluxxen\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\LinkoAbluxxen\Game;

class PlayerTurn extends GameState
{
    function __construct(protected Game $game)
    {
        parent::__construct($game,
            id: 10,
            type: StateType::ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must play card(s)'),
            descriptionMyTurn: clienttranslate('${you} must play card(s)'),
        );
    }

    public function getArgs(): array
    {
        $playerId = (int) $this->game->getActivePlayerId();
        return [
            'hand'   => $this->game->cards->getCardsInLocation('hand', $playerId),
            'player' => $playerId,
        ];
    }

    #[PossibleAction]
    public function actPlayCard(string $selectedCards, int $activePlayerId, array $args): string
    {
        $selectedCards = json_decode($selectedCards, true);
        if (empty($selectedCards)) {
            throw new UserException('You must play at least one card');
        }

        // Validate all selected cards are in player's hand
        $hand    = $args['hand'];
        $handIds = array_flip(array_column($hand, 'id'));
        foreach ($selectedCards as $card) {
            if (!isset($handIds[$card['id']])) {
                throw new UserException('Invalid card choice');
            }
        }

        // Validate: all cards must be the same type, jokers (type 14) are wild
        $nonJokers = array_filter($selectedCards, fn($c) => intval($c['type']) !== 14);
        $types     = array_unique(array_column($nonJokers, 'type'));
        if (count($types) > 1) {
            throw new UserException('All played cards must be the same number');
        }

        // Place cards in the next empty row
        $rowIdx  = $this->game->getNextPlayTableRowIdx($activePlayerId);
        $cardIds = array_column($selectedCards, 'id');
        $this->game->cards->moveCards($cardIds, 'playertable' . $rowIdx, $activePlayerId);
        $this->game->playerStats->inc('cards_stacked', count($selectedCards), $activePlayerId);

        // Notify all players
        $cardLabels = array_map(fn($c) => $c['type'] == 14 ? 'X' : (string)$c['type'], $selectedCards);
        $this->notify->all('cardPlayed', clienttranslate('${player_name} plays: ${card_list}'), [
            'player_id'   => $activePlayerId,
            'player_name' => $this->game->getPlayerNameById($activePlayerId),
            'count'       => count($selectedCards),
            'card_list'   => implode(', ', $cardLabels),
            'cards'       => $selectedCards,
            'row_idx'     => $rowIdx,
        ]);

        // Compute snatches
        $snatches = $this->game->computeSnatches($activePlayerId, $selectedCards);

        if (!empty($snatches)) {
            $this->globals->set('pending_snatches', $snatches);
            $this->globals->set('snatch_idx', 0);
            $this->globals->set('original_active_player', $activePlayerId);
            $this->globals->set('robbed_player_id', $snatches[0]['player_id']);
            return ActivePlayerSnatch::class;
        }

        return NextPlayer::class;
    }

    function zombie(int $playerId): string
    {
        $args  = $this->getArgs();
        $cards = array_values($args['hand']);
        if (empty($cards)) {
            return NextPlayer::class;
        }
        // Play the first card available
        $card = $cards[0];
        return $this->actPlayCard(json_encode([$card]), $playerId, $args);
    }
}
