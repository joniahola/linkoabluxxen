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
      this._generatePlayAreasSetup(gamedatas);
      this._managerSetup(gamedatas);

      this._poolSetup(gamedatas);
      this._discardSetup(gamedatas);
      //this._deckSetup(gamedatas);
      this._currentPlayerSetup(gamedatas);
      this._otherPlayersSetup(gamedatas);

      this._playerBoardsSetup(gamedatas);
      // Setup game notifications to handle (see "setupNotifications" method below)
      this.setupNotifications();

      if (this.isSpectator) {
        this._spectatorSetup(gamedatas);
      }
      this._debugSetup(gamedatas);
    },
    _managerSetup: function (gamedatas) {
      // create the animation manager, and bind it to the `game.bgaAnimationsActive()` function
      this.animationManager = new BgaAnimations.Manager({
        animationsActive: () => this.bgaAnimationsActive(),
      });

      // create the card manager
      this.cardsManager = new BgaCards.Manager({
        animationManager: this.animationManager,
        type: "card",
        getId: (card) => card.id,
        isCardVisible: () => true,
        cardWidth: 128,
        cardHeight: 199,
        setupFrontDiv: (card, div) => {
          div.dataset.type = card.type;
          this.addTooltipHtml(
            div.id,
            _(this.gamedatas.card_types[card.type_arg]["card_name"])
          );
        },
      });
    },
    _generatePlayAreasSetup: function (gamedatas) {
      var makeTableRows = (prefix) =>
        Array.from({ length: 109 }, (_, i) => 108 - i)
          .map((i) => `<div id="${prefix}_row_${i}"></div>`)
          .join("");

      // get another player playing areas
      var extra_areas = "";
      if (gamedatas.players_hands && gamedatas.current_player) {
        const currentId = parseInt(gamedatas.current_player.id);
        extra_areas = Object.keys(gamedatas.players_hands)
          .filter((key) => parseInt(key) !== currentId)
          .map((key) => {
            var player = gamedatas.players_hands[key];
            var name = player.name;
            var tableCount = player.playertable ? Object.keys(player.playertable).length : 0;
            var handCount = player.hand ? Object.keys(player.hand).length : 0;
            return `
              <div id="${key}_table_wrap" class="whiteblock table-area">
                <b id="${key}_table_label">${name} ${_("table")}</b>
                <div id="${key}_table">
                  ${makeTableRows(`${key}_table`)}
                </div>
                <div id="${key}_table_counter" class="counter">${tableCount}</div>
              </div>
              <div id="${key}_myhand_wrap" class="whiteblock hand-area">
                <b id="${key}_myhand_label">${name} ${_("hand")}</b>
                <div id="${key}_myhand"></div>
                <div id="${key}_hand_counter" class="counter">${handCount}</div>
              </div>
            `;
          })
          .join("");
      }

      var generate_rows = makeTableRows("mytable");

      document.getElementById("game_play_area").insertAdjacentHTML(
        "beforeend",
        `
          <div id="deck_area" class="whiteblock deck-area">
            <b id="stock-label">${_("Deck")}</b>
            <div id="deck" class="card-stock"></div>
            <div id="deck_counter" class="counter">${
              gamedatas.deck ? Object.keys(gamedatas.deck).length : 0
            }</div>
          </div>

          <div id="discard_area" class="whiteblock discard-area">
            <b id="stock-label">${_("Discard")}</b>
            <div id="discard" class="card-stock"></div>
            <div id="discard_counter" class="counter">${
              gamedatas.discardpile
                ? Object.keys(gamedatas.discardpile).length
                : 0
            }</div>
          </div>
          <div id="pool_area" class="whiteblock pool-area">
            <b id="pool_label">${_("Pool")}</b>
            <div id="pool" class="pool-cards"></div>
            <div id="pool_counter" class="counter">${
              gamedatas.pool ? Object.keys(gamedatas.pool).length : 0
            }</div>
          </div>
          <div id="mytable_wrap" class="whiteblock table-area">
              <b id="mytable_label">${_("My table")}</b>
              <div id="mytable">
                ${generate_rows}
              </div>
              <div id="table_counter" class="counter">${
                gamedatas.current_player.playertable
                  ? Object.keys(gamedatas.current_player.playertable).length
                  : 0
              }</div>
          </div>
          <div id="myhand_wrap" class="whiteblock hand-area">
              <b id="myhand_label">${_("My hand")}</b>
              <div id="myhand"></div>
              <div id="hand_counter" class="counter">${
                gamedatas.current_player.hand
                  ? Object.keys(gamedatas.current_player.hand).length
                  : 0
              }</div>
          </div>
          ` + extra_areas
      );

      // Add some CSS styles
      dojo.addClass("game_play_area", "linko-play-area");
    },
    _poolSetup: function (gamedatas) {
      // Create a stock for the pool (face down cards)
      this.poolStock = new BgaCards.LineStock(
        this.cardsManager,
        document.getElementById("pool"),
        {
          fanShaped: false,
          sort: false, // Don't sort deck cards
        }
      );
      this.poolStock.setSelectionMode("multiple");

      // Display deck cards
      if (gamedatas.pool && Object.keys(gamedatas.pool).length > 0) {
        const deckCardsArray = Object.values(gamedatas.pool);
        this.poolStock.addCards(deckCardsArray);
      }
    },
    _deckSetup: function (gamedatas) {
      // Create a stock for the pool (face down cards)
      this.deckStock = new BgaCards.LineStock(
        this.cardsManager,
        document.getElementById("deck"),
        {
          fanShaped: false,
          sort: false, // Don't sort deck cards
        }
      );

      // Display deck cards
      if (gamedatas.deck && Object.keys(gamedatas.deck).length > 0) {
        const deckCardsArray = Object.values(gamedatas.deck);
        this.deckStock.addCards(deckCardsArray);
      }
    },
    _discardSetup: function (gamedatas) {
      // Create a stock for the pool (face down cards)
      this.discardStock = new BgaCards.LineStock(
        this.cardsManager,
        document.getElementById("discard"),
        {
          fanShaped: false,
          sort: false, // Don't sort deck cards
        }
      );

      // Display deck cards
      if (gamedatas.discard && Object.keys(gamedatas.discard).length > 0) {
        const deckCardsArray = Object.values(gamedatas.discard);
        this.discardStock.addCards(deckCardsArray);
      }
    },
    _otherPlayersSetup: function (gamedatas) {
      this.others_stock = [];

      Object.keys(gamedatas.players_hands).forEach((key) => {
        if (parseInt(key) != parseInt(gamedatas.current_player.id)) {
          var player = gamedatas.players_hands[key];

          //create tables:
          //${key}_table_row_${i}
          const tables = [];
          for (let i = 0; i < 109; i++) {
            tables.push(
              new BgaCards.LineStock(
                this.cardsManager,
                document.getElementById(key + "_table_row_" + i),
                {
                  fanShaped: false,
                  sort: false,
                }
              )
            );
          }

          //player.playertable
          //player.hand
          //${key}_myhand
          var stock = {
            hand: new BgaCards.LineStock(
              this.cardsManager,
              document.getElementById(key + "_myhand"),
              {
                sort: (a, b) => a.type - b.type,
                fanShaped: false,
              }
            ),
            tables: tables,
          };
          console.log(stock);

          // Display deck cards if they exist
          if (player.hand && Object.keys(player.hand).length > 0) {
            // Convert the deck object to array and add to handStock
            const deckCardsArray = Object.values(player.hand);
            stock.hand.addCards(deckCardsArray);
          }

          if (
            player.playertable &&
            Object.keys(player.playertable).length > 0
          ) {
            // Convert the deck object to array and add to handStock
            const deckCardsArray = Object.values(player.playertable);
            stock.table.addCards(deckCardsArray);
          }
          this.others_stock[key] = stock;
        }
      });
    },
    _currentPlayerSetup: function (gamedatas) {
      // create the stock, in the game setup
      this.handStock = new BgaCards.HandStock(
        this.cardsManager,
        document.getElementById("myhand"),
        {
          sort: (a, b) => a.type - b.type,
          fanShaped: false,
        }
      );
      this.handStock.setSelectionMode("multiple");

      const tables = [];
      for (let i = 0; i < 109; i++) {
        tables.push(
          new BgaCards.LineStock(
            this.cardsManager,
            document.getElementById("mytable_row_" + i),
            {
              fanShaped: false,
              sort: false,
            }
          )
        );
      }

      this.tableStocks = tables;
      // Display deck cards if they exist
      if (
        gamedatas.current_player.hand &&
        Object.keys(gamedatas.current_player.hand).length > 0
      ) {
        // Convert the deck object to array and add to handStock
        const deckCardsArray = Object.values(gamedatas.current_player.hand);
        this.handStock.addCards(deckCardsArray);
      }

      if (
        gamedatas.current_player.playertable &&
        Object.keys(gamedatas.current_player.playertable).length > 0
      ) {
        // Convert the deck object to array and add to handStock
        const deckCardsArray = Object.values(
          gamedatas.current_player.playertable
        );
        this.tableStock.addCards(deckCardsArray);
      }
    },
    _playerBoardsSetup: function (gamedatas) {
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
          value: Object.keys(gamedatas.players_hands[player.id].hand).length,
          playerCounter: "cards",
          playerId: player.id,
        });
      });
    },
    _spectatorSetup: function (gamedatas) {
      document.getElementById("myhand_wrap").style.display = "none";
    },
    _debugSetup: function (gamedatas) {
      const debugData = {
        hand: this.gamedatas.hand,
        gamedatas: this.gamedatas,
        handStock: this.handStock,
        cardsManager: this.cardsManager,
        animationManager: this.animationManager,
      };
      window.linko = debugData;
    },

    ///////////////////////////////////////////////////
    //// Game & client states

    // onEnteringState: this method is called each time we are entering into a new game state.
    //                  You can use this method to perform some user interface changes at this moment.
    //
    onEnteringState: function (stateName, args) {
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
    _cardLabel: function (type) {
      return type == "14" ? "X" : type;
    },

    _playOptionDescription: function (numType, numCount, jokerCount) {
      const numLabel = this._cardLabel(numType);
      const prefix = (count) => (count == 1 ? "" : count + "x");
      if (jokerCount === 0) {
        return `Play ${prefix(numCount)}${numLabel}`;
      }
      return `Play ${prefix(numCount)}${numLabel} & ${prefix(jokerCount)}X`;
    },

    _buildPlayOptions: function (numCount, jokerCount) {
      const options = [];
      for (let i = 1; i <= numCount; i++) {
        options.push({ numCount: i, jokerCount: 0 });
        for (let k = 1; k <= jokerCount; k++) {
          options.push({ numCount: i, jokerCount: k });
        }
      }
      return options;
    },

    _showConfirmButtons: function (stateName, args, numberCards, jokerCards, option, numType) {
      this.statusBar.removeActionButtons();
      this.statusBar.addActionButton("← Back", () =>
        this._showCardQuantityButtons(stateName, args, numType)
      );
      this.statusBar.addActionButton("Confirm", () => {
        const selectedCards = [
          ...numberCards.slice(0, option.numCount),
          ...jokerCards.slice(0, option.jokerCount),
        ];
        this.bgaPerformAction("actPlayCard", {
          selectedCards: JSON.stringify(selectedCards),
        }).then(() => {
          const emptyStock = this.tableStocks.find((s) => s.isEmpty());
          if (emptyStock) {
            emptyStock.addCards(selectedCards);
            selectedCards.forEach((card) =>
              this.handStock.cardRemoved(card, {
                autoUpdateCardNumber: true,
                fadeOut: true,
              })
            );
          }
        });
      });
    },

    _showCardQuantityButtons: function (stateName, args, numType) {
      const allCards = Object.values(args.hand).sort((a, b) => a.type - b.type);
      const numberCards = allCards.filter((card) => card.type == numType);
      const jokerCards = numType == "14" ? [] : allCards.filter((card) => card.type == "14");

      this.statusBar.removeActionButtons();
      this.statusBar.addActionButton("← Back", () =>
        this.onUpdateActionButtons(stateName, args)
      );

      this._buildPlayOptions(numberCards.length, jokerCards.length).forEach((option) => {
        const description = this._playOptionDescription(numType, option.numCount, option.jokerCount);
        this.statusBar.addActionButton(description, () =>
          this._showConfirmButtons(stateName, args, numberCards, jokerCards, option, numType)
        );
      });
    },

    onUpdateActionButtons: function (stateName, args) {
      if (!this.isCurrentPlayerActive()) {
        return;
      }

      switch (stateName) {
        case "PlayerTurn":
          // Unique card types in hand, sorted
          const uniqueTypes = Object.values(args.hand)
            .sort((a, b) => a.type - b.type)
            .filter((card, i, arr) => i === 0 || card.type !== arr[i - 1].type);

          this.statusBar.removeActionButtons();
          uniqueTypes.forEach((card) => {
            const numType = card.type;
            this.statusBar.addActionButton(this._cardLabel(numType), () =>
              this._showCardQuantityButtons(stateName, args, numType)
            );
          });
          break;
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

    onCardClick: function (cards, stateName) {
      console.log("onCardClick", card_id);
    },

    setupNotifications: function () {
      console.log("notifications subscriptions setup");

      // automatically listen to the notifications, based on the `notif_xxx` function on this class.
      this.bgaSetupPromiseNotifications();
    },
  });
});
