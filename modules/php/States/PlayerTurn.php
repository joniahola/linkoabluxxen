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
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: 10,
            type: StateType::ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must play card(s):'),
            descriptionMyTurn: clienttranslate('${you} must play card(s):'),
        );
    }

    /**
     * Game state arguments, example content.
     *
     * This method returns some additional information that is very specific to the `PlayerTurn` game state.
     */
    public function getArgs(): array
    {
        $playerId = $this->game->getActivePlayerId();
        
        // Get player's hand - adjust this based on your actual implementation
        $playerHand = $this->game->cards->getCardsInLocation('hand', $playerId);
        $playerTable = $this->game->cards->getCardsInLocation('playertable', $playerId);

        return [
            "player" => $playerId,
            "hand" => $playerHand,
            "table" => $playerTable
        ];
    }

    /**
     * Player action, example content.
     *
     * In this scenario, each time a player plays a card, this method will be called. This method is called directly
     * by the action trigger on the front side with `bgaPerformAction`.
     *
     * @throws UserException
     */
    #[PossibleAction]
    public function actPlayCard(string $selectedCards, int $activePlayerId, array $args)
    {
        $selectedCards = json_decode($selectedCards, true);
        $gain_points = count($selectedCards);
        $hand = $args['hand'];
        $playedCard_string = "";

        $selectedCards_ids = array_column($selectedCards, 'id');
        $hand_ids = array_column($hand, 'id');
        $handSet = array_flip($hand_ids);
        $missing = array_filter($selectedCards_ids, fn($id) => !isset($handSet[$id]));
        if (!empty($missing)) {
            throw new UserException('Invalid card(s) choice');
        }

        foreach($selectedCards as $card) {
            $id = intval($card['type']);
            $card_name = Game::$CARD_TYPES[$id]['card_name'];
            $playedCard_string .= $card_name . " ";
        }
        
        $playedCard_string = trim($playedCard_string);

        // Notify all players about the card played.
        $this->notify->all("cardPlayed", clienttranslate('${player_name} plays ${cards}'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId), // remove this line if you uncomment notification decorator
            "cards" => $playedCard_string, // remove this line if you uncomment notification decorator
            "i18n" => ['cards'], // remove this line if you uncomment notification decorator
        ]);

        $this->playerScore->inc($activePlayerId, $gain_points);

        $this->game->cards->moveCards($selectedCards_ids, 'playertable', $activePlayerId);
        return NextPlayer::class;
        // check input values
        /*$playableCardsIds = $args['playableCardsIds'];
        if (!in_array($card_id, $playableCardsIds)) {
            throw new UserException('Invalid card choice');
        }*/

        // Add your game logic to play a card here.

        // in this example, the player gains 1 points each time he plays a card
        

        // at the end of the action, move to the next state
        return NextPlayer::class;
    }

    /**
     * This method is called each time it is the turn of a player who has quit the game (= "zombie" player).
     * You can do whatever you want in order to make sure the turn of this player ends appropriately
     * (ex: play a random card).
     * 
     * See more about Zombie Mode: https://en.doc.boardgamearena.com/Zombie_Mode
     *
     * Important: your zombie code will be called when the player leaves the game. This action is triggered
     * from the main site and propagated to the gameserver from a server, not from a browser.
     * As a consequence, there is no current player associated to this action. In your zombieTurn function,
     * you must _never_ use `getCurrentPlayerId()` or `getCurrentPlayerName()`, 
     * but use the $playerId passed in parameter and $this->game->getPlayerNameById($playerId) instead.
     */
    function zombie(int $playerId) {
        // Example of zombie level 0: return NextPlayer::class; or $this->actPass($playerId);

        // Example of zombie level 1:
        $args = $this->getArgs();
        $zombieChoice = $this->getRandomZombieChoice($args['playableCardsIds']); // random choice over possible moves
        return $this->actPlayCard([1,2,3], $playerId, [1,2,3,4,5]); // this function will return the transition to the next state
    }
}