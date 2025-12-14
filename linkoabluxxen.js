/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * LinkoAbluxxen implementation : © <Your name here> <Your email address here>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * linkoabluxxen.js
 *
 * LinkoAbluxxen user interface script
 *
 * In this file, you are describing the logic of your user interface, in Javascript language.
 *
 */

define([
  "dojo",
  "dojo/_base/declare",
  "ebg/core/gamegui",
  "ebg/counter",
  getLibUrl("bga-animations", "1.x"), // the lib uses bga-animations so this is required!
  getLibUrl("bga-cards", "1.0.7"),
], function (dojo, declare, gamegui, counter, BgaAnimations, BgaCards) {
  return declare("bgagame.linkoabluxxen", ebg.core.gamegui, {
    constructor: function () {
      console.log("linkoabluxxen constructor");

      // Here, you can init the global variables of your user interface
      // Example:
      // this.myGlobalValue = 0;
    },

    /*
            setup:
            
            This method must set up the game user interface according to current game situation specified
            in parameters.
            
            The method is called each time the game interface is displayed to a player, ie:
            _ when the game starts
            _ when a player refreshes the game page (F5)
            
            "gamedatas" argument contains all datas retrieved by your "getAllDatas" PHP method.
        */

    setup: function (gamedatas) {
      console.log("Starting game setup", gamedatas);

      // Add deck display area to your HTML
      document.getElementById("game_play_area").insertAdjacentHTML(
        "beforeend",
        `
        <div id="deck_wrap" class="whiteblock">
            <b id="deck_label">${_("Deck")}</b>
            <div id="deck">
               
            </div>
        </div>
        `
      );

      document.getElementById("game_play_area").insertAdjacentHTML(
        "beforeend",
        `
                <div id="myhand_wrap" class="whiteblock">
                    <b id="myhand_label">${_("My hand")}</b>
                    <div id="myhand">
                       
                    </div>
                </div>

            `
      );

      // Example to add a div on the game area
      this.getGameAreaElement().insertAdjacentHTML(
        "beforeend",
        `
                <div id="player-tables"></div>
            `
      );

      // Hide hand zone from spectators
      if (this.isSpectator) {
        document.getElementById("myhand_wrap").style.display = "none";
      }

      // create the animation manager, and bind it to the `game.bgaAnimationsActive()` function
      this.animationManager = new BgaAnimations.Manager({
        animationsActive: () => this.bgaAnimationsActive(),
      });

      const cardWidth = 262 / 2;
      const cardHeight = 407 / 2;

      // create the card manager
      this.cardsManager = new BgaCards.Manager({
        animationManager: this.animationManager,
        type: "bg-card",
        getId: (card) => card.id,
        cardWidth: cardWidth,
        cardHeight: cardHeight,
        cardBorderRadius: "5%",
        setupFrontDiv: (card, div) => {
          console.log({ card, div });
          div.dataset.type = card.type; // suit 1..4
          div.dataset.typeArg = card.type_arg; // value 2..14
          this.addTooltipHtml(
            div.id,
            _(this.gamedatas.card_types[card.type_arg]["card_name"])
          );
        },
      });

      // create the stock, in the game setup
      this.handStock = new BgaCards.HandStock(
        this.cardsManager,
        document.getElementById("myhand"),
        {
          sort: (a, b) => a.type - b.type,
        }
      );

      this.handStock.onCardClick = (card) => {
        this.onCardClick(card);
      };

      // Cards in player's hand
      console.log(this.gamedatas.hand);
      console.log({
        gamedatas: this.gamedatas,
        handStock: this.handStock,
        cardsManager: this.cardsManager,
        animationManager: this.animationManager,
      });

      window.test = {
        gamedatas: this.gamedatas,
        handStock: this.handStock,
        cardsManager: this.cardsManager,
        animationManager: this.animationManager,
      };

      // Create a stock for the deck (face down cards)
      this.deckStock = new BgaCards.HandStock(
        this.cardsManager,
        document.getElementById("deck"),
        {
          sort: false, // Don't sort deck cards
          direction: "column", // Stack them vertically
          overlap: "15px", // Overlap cards slightly
          center: false,
        }
      );

      // Display deck cards
      if (gamedatas.deck && Object.keys(gamedatas.deck).length > 0) {
        //const deckCardsArray = Object.values(gamedatas.deck);
        const deckCardsArray = Object.values(gamedatas.deck).slice(0, 10);
        this.deckStock.addCards(deckCardsArray);
      }

      // Setting up player boards
      Object.values(gamedatas.players).forEach((player) => {
        // example of setting up players boards
        this.getPlayerPanelElement(player.id).insertAdjacentHTML(
          "beforeend",
          `
                <span id="cards-player-counter-${player.id}"></span> Cards
            `
        );
        const counter = new ebg.counter();
        counter.create(`cards-player-counter-${player.id}`, {
          value: 11,
          playerCounter: "cards",
          playerId: player.id,
        });

        // example of adding a div for each player
        document.getElementById("player-tables").insertAdjacentHTML(
          "beforeend",
          `
                <div id="player-table-${player.id}">
                    <strong>${player.name}</strong>
                    <div>Player zone content goes here</div>
                </div>
            `
        );
      });

      // Setting up player boards
      Object.values(gamedatas.players).forEach((player) => {
        // example of adding a div for each player
        console.log(player);
        document.getElementById("player-tables").insertAdjacentHTML(
          "beforeend",
          `
                    <div class="whiteblock" id="player-table-${player.id}">
                        <strong>${player.name}</strong>
                        <div id="tableau_${player.id}"></div>
                    </div>
          `
        );
      });

      // Cards in player's hand
      console.log(this.gamedatas.hand);

      // Display deck cards if they exist
      if (gamedatas.deck && Object.keys(gamedatas.deck).length > 0) {
        console.log("Deck cards:", gamedatas.deck);

        // Convert the deck object to array and add to handStock
        const deckCardsArray = Object.values(gamedatas.deck).slice(0, 11);
        this.handStock.addCards(deckCardsArray); // tää piirtyy nyt my cardsiin

        // Alternatively, if you want to display them differently:
        // this.displayDeckCards(deckCardsArray);
      }

      // TODO: Set up your game interface here, according to "gamedatas"

      // Setup game notifications to handle (see "setupNotifications" method below)
      this.setupNotifications();

      console.log("Ending game setup");
    },

    ///////////////////////////////////////////////////
    //// Game & client states

    // onEnteringState: this method is called each time we are entering into a new game state.
    //                  You can use this method to perform some user interface changes at this moment.
    //
    onEnteringState: function (stateName, args) {
      console.log("Entering state: " + stateName, args);

      switch (stateName) {
        /* Example:
            
            case 'myGameState':
            
                // Show some HTML block at this game state
                dojo.style( 'my_html_block_id', 'display', 'block' );
                
                break;
           */

        case "dummy":
          break;
      }
    },

    // onLeavingState: this method is called each time we are leaving a game state.
    //                 You can use this method to perform some user interface changes at this moment.
    //
    onLeavingState: function (stateName) {
      console.log("Leaving state: " + stateName);

      switch (stateName) {
        /* Example:
            
            case 'myGameState':
            
                // Hide the HTML block we are displaying only during this game state
                dojo.style( 'my_html_block_id', 'display', 'none' );
                
                break;
           */

        case "dummy":
          break;
      }
    },

    // onUpdateActionButtons: in this method you can manage "action buttons" that are displayed in the
    //                        action status bar (ie: the HTML links in the status bar).
    //
    onUpdateActionButtons: function (stateName, args) {
      console.log("onUpdateActionButtons: " + stateName, args);

      if (this.isCurrentPlayerActive()) {
        switch (stateName) {
          case "PlayerTurn":
            const playableCardsIds = args.playableCardsIds; // returned by the argPlayerTurn

            // Add test action buttons in the action status bar, simulating a card click:
            playableCardsIds.forEach((cardId) =>
              this.statusBar.addActionButton(
                _("Play card with id ${card_id}").replace("${card_id}", cardId),
                () => this.onCardClick(cardId)
              )
            );

            this.statusBar.addActionButton(
              _("Pass"),
              () => this.bgaPerformAction("actPass"),
              { color: "secondary" }
            );
            break;
        }
      }
    },

    ///////////////////////////////////////////////////
    //// Utility methods

    /*
        
            Here, you can defines some utility methods that you can use everywhere in your javascript
            script.
        
        */

    ///////////////////////////////////////////////////
    //// Player's action

    /*
        
            Here, you are defining methods to handle player's action (ex: results of mouse click on 
            game objects).
            
            Most of the time, these methods:
            _ check the action is possible at this game state.
            _ make a call to the game server
        
        */

    // Example:

    onCardClick: function (card_id) {
      console.log("onCardClick", card_id);

      this.bgaPerformAction("actPlayCard", {
        card_id,
      }).then(() => {
        // What to do after the server call if it succeeded
        // (most of the time, nothing, as the game will react to notifs / change of state instead)
      });
    },

    ///////////////////////////////////////////////////
    //// Reaction to cometD notifications

    /*
            setupNotifications:
            
            In this method, you associate each of your game notifications with your local method to handle it.
            
            Note: game notification names correspond to "notifyAllPlayers" and "notifyPlayer" calls in
                  your linkoabluxxen.game.php file.
        
        */
    setupNotifications: function () {
      console.log("notifications subscriptions setup");

      // automatically listen to the notifications, based on the `notif_xxx` function on this class.
      this.bgaSetupPromiseNotifications();
    },

    // TODO: from this point and below, you can write your game notifications handling methods

    /*
        Example:
        
        notif_cardPlayed: async function( args )
        {
            console.log( 'notif_cardPlayed' );
            console.log( args );
            
            // Note: args contains the arguments specified during you "notifyAllPlayers" / "notifyPlayer" PHP call
            
            // TODO: play the card in the user interface.
        },    
        
        */
  });
});
