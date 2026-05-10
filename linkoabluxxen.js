/**
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * LinkoAbluxxen implementation : © Joni Ahola aholanjoni@gmail.com
 */

define([
  "dojo",
  "dojo/_base/declare",
  "ebg/core/gamegui",
  "ebg/counter",
  getLibUrl("bga-animations", "1.x"),
  getLibUrl("bga-cards", "1.0.7"),
], function (dojo, declare, gamegui, counter, BgaAnimations, BgaCards) {
  return declare("bgagame.linkoabluxxen", ebg.core.gamegui, {
    constructor: function () {
      this.tableStocks = [];      // current player's per-row stocks
      this.othersStocks = {};     // { playerId: { hand, tables[] } }
    },

    setup: function (gamedatas) {
      this._managerSetup(gamedatas);
      this._generatePlayAreasSetup(gamedatas);
      this._poolSetup(gamedatas);
      this._discardSetup(gamedatas);
      this._currentPlayerSetup(gamedatas);
      this._otherPlayersSetup(gamedatas);
      this._playerBoardsSetup(gamedatas);
      this.setupNotifications();

      if (this.isSpectator) {
        document.getElementById("myhand_wrap").style.display = "none";
      }

      window.linko = { game: this, gamedatas };
    },

    // -------------------------------------------------------------------------
    // Setup helpers
    // -------------------------------------------------------------------------

    _managerSetup: function (gamedatas) {
      this.animationManager = new BgaAnimations.Manager({
        animationsActive: () => this.bgaAnimationsActive(),
      });
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
            _(this.gamedatas.card_types[card.type_arg]?.card_name ?? card.type_arg)
          );
        },
      });
    },

    _makeTableRows: function (prefix) {
      // Rows rendered highest→lowest so newest (highest index) appears on top visually
      return Array.from({ length: 109 }, (_, i) => 108 - i)
        .map((i) => `<div id="${prefix}_row_${i}"></div>`)
        .join("");
    },

    _generatePlayAreasSetup: function (gamedatas) {
      const currentId = parseInt(gamedatas.current_player.id);

      const otherAreas = Object.keys(gamedatas.players_hands)
        .filter((id) => parseInt(id) !== currentId)
        .map((id) => {
          const player = gamedatas.players_hands[id];
          return `
            <div id="${id}_table_wrap" class="whiteblock table-area">
              <b>${player.name} ${_("table")}</b>
              <div id="${id}_table">${this._makeTableRows(id + "_table")}</div>
            </div>
            <div id="${id}_myhand_wrap" class="whiteblock hand-area">
              <b>${player.name} ${_("hand")}</b>
              <div id="${id}_myhand"></div>
              <span id="${id}_hand_counter_el"></span>
            </div>
          `;
        })
        .join("");

      document.getElementById("game_play_area").insertAdjacentHTML(
        "beforeend",
        `
        <div id="deck_area" class="whiteblock deck-area">
          <b>${_("Deck")}</b>
          <div id="deck" class="card-stock"></div>
          <span id="deck_counter_el">${gamedatas.deck_count ?? 0}</span>
        </div>
        <div id="discard_area" class="whiteblock discard-area">
          <b>${_("Discard")}</b>
          <div id="discard" class="card-stock"></div>
        </div>
        <div id="pool_area" class="whiteblock pool-area">
          <b>${_("Card row")}</b>
          <div id="pool" class="pool-cards"></div>
        </div>
        <div id="mytable_wrap" class="whiteblock table-area">
          <b>${_("My table")}</b>
          <div id="mytable">${this._makeTableRows("mytable")}</div>
        </div>
        <div id="myhand_wrap" class="whiteblock hand-area">
          <b>${_("My hand")}</b>
          <div id="myhand"></div>
        </div>
        ${otherAreas}
        `
      );

      dojo.addClass("game_play_area", "linko-play-area");
    },

    _poolSetup: function (gamedatas) {
      this.poolStock = new BgaCards.LineStock(
        this.cardsManager,
        document.getElementById("pool"),
        { fanShaped: false, sort: false }
      );
      this.poolStock.setSelectionMode("none");

      const poolCards = gamedatas.pool ? Object.values(gamedatas.pool) : [];
      if (poolCards.length > 0) this.poolStock.addCards(poolCards);
    },

    _discardSetup: function (gamedatas) {
      this.discardStock = new BgaCards.LineStock(
        this.cardsManager,
        document.getElementById("discard"),
        { fanShaped: false, sort: false }
      );
      const discardCards = gamedatas.discardpile ? Object.values(gamedatas.discardpile) : [];
      if (discardCards.length > 0) this.discardStock.addCards(discardCards);
    },

    _currentPlayerSetup: function (gamedatas) {
      this.handStock = new BgaCards.HandStock(
        this.cardsManager,
        document.getElementById("myhand"),
        { sort: (a, b) => a.type - b.type, fanShaped: false }
      );
      this.handStock.setSelectionMode("multiple");

      // Create per-row stocks for current player
      this.tableStocks = [];
      for (let i = 0; i < 109; i++) {
        this.tableStocks.push(
          new BgaCards.LineStock(
            this.cardsManager,
            document.getElementById("mytable_row_" + i),
            { fanShaped: false, sort: false }
          )
        );
      }

      // Populate hand
      const hand = gamedatas.current_player.hand
        ? Object.values(gamedatas.current_player.hand)
        : [];
      if (hand.length > 0) this.handStock.addCards(hand);

      // Populate table rows
      const playertables = gamedatas.current_player.playertables || [];
      playertables.forEach((rowCards, i) => {
        if (rowCards && rowCards.length > 0) {
          this.tableStocks[i].addCards(rowCards);
        }
      });
    },

    _otherPlayersSetup: function (gamedatas) {
      const currentId = parseInt(gamedatas.current_player.id);
      this.othersStocks = {};

      Object.keys(gamedatas.players_hands).forEach((id) => {
        if (parseInt(id) === currentId) return;

        const player = gamedatas.players_hands[id];

        // Per-row table stocks
        const tables = [];
        for (let i = 0; i < 109; i++) {
          tables.push(
            new BgaCards.LineStock(
              this.cardsManager,
              document.getElementById(id + "_table_row_" + i),
              { fanShaped: false, sort: false }
            )
          );
        }

        // Hand stock (shows card backs — isCardVisible can be overridden per-stock if needed)
        const handStock = new BgaCards.LineStock(
          this.cardsManager,
          document.getElementById(id + "_myhand"),
          { sort: (a, b) => a.type - b.type, fanShaped: false }
        );

        this.othersStocks[id] = { hand: handStock, tables };

        // Populate hand
        const hand = player.hand ? Object.values(player.hand) : [];
        if (hand.length > 0) handStock.addCards(hand);

        // Populate table rows
        const playertables = player.playertables || [];
        playertables.forEach((rowCards, i) => {
          if (rowCards && rowCards.length > 0) {
            tables[i].addCards(rowCards);
          }
        });
      });
    },

    _playerBoardsSetup: function (gamedatas) {
      Object.values(gamedatas.players).forEach((player) => {
        this.getPlayerPanelElement(player.id).insertAdjacentHTML(
          "beforeend",
          `<span id="hand-count-${player.id}"></span> cards`
        );
        const handCount = gamedatas.players_hands[player.id]
          ? Object.keys(gamedatas.players_hands[player.id].hand ?? {}).length
          : 0;
        const ctr = new ebg.counter();
        ctr.create(`hand-count-${player.id}`, {
          value: handCount,
          playerCounter: "cards",
          playerId: player.id,
        });
      });
    },

    // -------------------------------------------------------------------------
    // Stock lookup helpers
    // -------------------------------------------------------------------------

    _getTableStock: function (playerId, rowIdx) {
      const currentId = parseInt(this.gamedatas.current_player.id);
      if (playerId === currentId) {
        return this.tableStocks[rowIdx] ?? null;
      }
      return this.othersStocks[playerId]?.tables[rowIdx] ?? null;
    },

    _getHandStock: function (playerId) {
      const currentId = parseInt(this.gamedatas.current_player.id);
      if (playerId === currentId) return this.handStock;
      return this.othersStocks[playerId]?.hand ?? null;
    },

    // -------------------------------------------------------------------------
    // Game & client states
    // -------------------------------------------------------------------------

    onEnteringState: function (stateName, args) {
      switch (stateName) {
        case "RobbedPlayerDraw":
          if (this.isCurrentPlayerActive()) {
            this.poolStock.setSelectionMode("single");
            this.poolStock.onSelectionChange = (selection) => {
              if (selection.length === 1) {
                this._onPoolCardSelectedForDraw(selection[0]);
              }
            };
          }
          break;
      }
    },

    onLeavingState: function (stateName) {
      switch (stateName) {
        case "RobbedPlayerDraw":
          this.poolStock.setSelectionMode("none");
          this.poolStock.onSelectionChange = null;
          this.poolStock.unselectAll();
          break;
        case "PlayerTurn":
          this.handStock.unselectAll();
          break;
      }
    },

    // -------------------------------------------------------------------------
    // Action buttons
    // -------------------------------------------------------------------------

    _cardLabel: function (type) {
      return type == "14" ? "X" : type;
    },

    _playOptionDescription: function (numType, numCount, jokerCount) {
      const numLabel = this._cardLabel(String(numType));
      const prefix = (n) => (n === 1 ? "" : n + "×");
      if (jokerCount === 0) return `Play ${prefix(numCount)}${numLabel}`;
      return `Play ${prefix(numCount)}${numLabel} + ${prefix(jokerCount)}X`;
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
      this.statusBar.addActionButton(_("← Back"), () =>
        this._showCardQuantityButtons(stateName, args, numType)
      );
      this.statusBar.addActionButton(_("Confirm"), () => {
        const selectedCards = [
          ...numberCards.slice(0, option.numCount),
          ...jokerCards.slice(0, option.jokerCount),
        ];
        this.bgaPerformAction("actPlayCard", {
          selectedCards: JSON.stringify(selectedCards),
        }).then(() => {
          this.handStock.unselectAll();
        });
      });
    },

    _showCardQuantityButtons: function (stateName, args, numType) {
      const allCards    = Object.values(args.hand).sort((a, b) => a.type - b.type);
      const numberCards = allCards.filter((c) => c.type == numType);
      const jokerCards  = numType == "14" ? [] : allCards.filter((c) => c.type == "14");

      this.statusBar.removeActionButtons();
      this.statusBar.addActionButton(_("← Back"), () =>
        this.onUpdateActionButtons(stateName, args)
      );

      this._buildPlayOptions(numberCards.length, jokerCards.length).forEach((option) => {
        const label = this._playOptionDescription(numType, option.numCount, option.jokerCount);
        this.statusBar.addActionButton(label, () =>
          this._showConfirmButtons(stateName, args, numberCards, jokerCards, option, numType)
        );
      });
    },

    onUpdateActionButtons: function (stateName, args) {
      if (!this.isCurrentPlayerActive()) return;

      switch (stateName) {
        case "PlayerTurn": {
          const uniqueTypes = Object.values(args.hand)
            .sort((a, b) => a.type - b.type)
            .filter((c, i, arr) => i === 0 || c.type !== arr[i - 1].type);

          this.statusBar.removeActionButtons();
          uniqueTypes.forEach((card) => {
            this.statusBar.addActionButton(this._cardLabel(card.type), () =>
              this._showCardQuantityButtons(stateName, args, card.type)
            );
          });
          break;
        }

        case "ActivePlayerSnatch": {
          const snatch     = args.snatch;
          const robbedName = args.robbed_name ?? "?";
          this.statusBar.removeActionButtons();
          this.statusBar.addActionButton(
            `${_("Take")} (${snatch.card_count} card(s) from ${robbedName})`,
            () => this.bgaPerformAction("actTakeSnatch", {})
          );
          this.statusBar.addActionButton(_("Skip"), () =>
            this.bgaPerformAction("actSkipSnatch", {})
          );

          // Highlight the snatchable row
          if (snatch.player_id) {
            const rowEl = document.getElementById(
              snatch.player_id + "_table_row_" + snatch.row_idx
            );
            if (rowEl) rowEl.classList.add("snatch-highlight");
          }
          break;
        }

        case "RobbedPlayerDecision": {
          this.statusBar.removeActionButtons();
          this.statusBar.addActionButton(_("Pick up"), () =>
            this.bgaPerformAction("actPickUp", {})
          );
          this.statusBar.addActionButton(_("Discard and draw"), () =>
            this.bgaPerformAction("actDiscard", {})
          );
          break;
        }

        case "RobbedPlayerDraw": {
          const drawCount = args.draw_count ?? 0;
          this.statusBar.removeActionButtons();
          this.statusBar.addActionButton(
            `${_("Draw from deck")} (${drawCount} remaining)`,
            () => this.bgaPerformAction("actDrawCard", { cardId: 0 })
          );
          // Pool cards are clickable via the selection handler in onEnteringState
          break;
        }
      }
    },

    _onPoolCardSelectedForDraw: function (card) {
      this.bgaPerformAction("actDrawCard", { cardId: card.id }).then(() => {
        this.poolStock.unselectAll();
      });
    },

    // -------------------------------------------------------------------------
    // Notifications
    // -------------------------------------------------------------------------

    setupNotifications: function () {
      this.bgaSetupPromiseNotifications();
    },

    /** BGA can pass either the full notif object or just args directly. */
    _args: function (notif) {
      return notif?.args ?? notif ?? {};
    },

    /** Cards played from hand to player's table row */
    notif_cardPlayed: async function (notif) {
      const { player_id, cards, row_idx } = this._args(notif);
      if (player_id == null) return;
      const pid        = parseInt(player_id);
      const handStock  = this._getHandStock(pid);
      const tableStock = this._getTableStock(pid, row_idx);

      if (handStock && tableStock) {
        await tableStock.addCards(cards);
      }
    },

    /** Active player takes snatched cards into their hand */
    notif_snatchTaken: async function (notif) {
      const { player_id, robbed_id, cards, row_idx } = this._args(notif);
      if (player_id == null) return;
      const takerId    = parseInt(player_id);
      const robbedId   = parseInt(robbed_id);
      const tableStock = this._getTableStock(robbedId, row_idx);
      const handStock  = this._getHandStock(takerId);

      if (tableStock && handStock) {
        await handStock.addCards(cards);
      }
    },

    /** Active player declines — just clear the highlight */
    notif_snatchDeclined: async function (notif) {
      const { robbed_id, row_idx } = this._args(notif);
      if (robbed_id == null) return;
      const rowEl = document.getElementById(robbed_id + "_table_row_" + row_idx);
      if (rowEl) rowEl.classList.remove("snatch-highlight");
    },

    /** Robbed player picks up their own cards back to hand */
    notif_cardsReturnedToHand: async function (notif) {
      const { player_id, card_ids, row_idx } = this._args(notif);
      if (player_id == null) return;
      const pid        = parseInt(player_id);
      const tableStock = this._getTableStock(pid, row_idx);
      const handStock  = this._getHandStock(pid);

      if (tableStock && handStock) {
        const cards = tableStock.getCards().filter((c) => card_ids.includes(c.id));
        if (cards.length > 0) {
          tableStock.removeCards(cards);
          await handStock.addCards(cards);
        }
      }
    },

    /** Robbed player discards their snatched cards */
    notif_cardsDiscarded: async function (notif) {
      const { player_id, card_ids, row_idx } = this._args(notif);
      if (player_id == null) return;
      const pid        = parseInt(player_id);
      const tableStock = this._getTableStock(pid, row_idx);

      if (tableStock) {
        const cards = tableStock.getCards().filter((c) => card_ids.includes(c.id));
        if (cards.length > 0) {
          tableStock.removeCards(cards);
          await this.discardStock.addCards(cards);
        }
      }
    },

    /** Player draws a card (public — from pool, or face-down from deck) */
    notif_cardDrawn: async function (notif) {
      const { player_id, from_pool, card } = this._args(notif);
      if (player_id == null) return;
      const pid       = parseInt(player_id);
      const handStock = this._getHandStock(pid);

      if (!handStock) return;

      if (from_pool && card) {
        await handStock.addCards([card]);
      }
      // deck draw is shown via notif_cardDrawnPrivate for the drawing player only
    },

    /** Private notification for the player who drew from deck — reveals their card */
    notif_cardDrawnPrivate: async function (notif) {
      const { card } = this._args(notif);
      if (card) {
        this.handStock.addCard(card);
      }
    },

    /** New cards added to pool from deck */
    notif_poolReplenished: async function (notif) {
      const { cards } = this._args(notif);
      if (cards && cards.length > 0) {
        this.poolStock.addCards(cards);
      }
    },

    /** Final scores (no UI change needed — BGA handles scoreboard) */
    notif_finalScore: async function (notif) {
      // BGA framework updates player_score automatically via the playerScore counter
    },
  });
});
