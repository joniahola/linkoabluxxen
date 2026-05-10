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
      this.othersStocks = {};     // { playerId: { tables[] } }
      this._playerStats = {};     // { playerId: { hand: N, table: N } }
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
      // Sort by player_no so tables match the game-start turn order (player 1 first)
      const reordered = Object.values(gamedatas.players).sort(
        (a, b) => parseInt(a.player_no) - parseInt(b.player_no)
      );

      const playerSections = reordered
        .map((player) => {
          const pid    = parseInt(player.id);
          const isMe   = pid === currentId;
          const prefix = isMe ? "mytable" : pid + "_table";
          const badge  = `<span id="${pid}_hand_count_badge" class="hand-count-badge"></span>`;
          const label  = isMe ? `<u>${player.name}</u>` : player.name;
          return `
            <div id="cplayer_${pid}" class="combined-player${isMe ? " combined-player--me" : ""}">
              <div class="combined-player-label"><b>${label}</b>${badge}</div>
              <div id="${prefix}">${this._makeTableRows(prefix)}</div>
            </div>
          `;
        })
        .join("");

      document.getElementById("game_play_area").insertAdjacentHTML(
        "beforeend",
        `
        <div id="combined_table_area" class="whiteblock combined-table-area">
          <div id="combined_table_inner" class="combined-table-inner">
            ${playerSections}
          </div>
        </div>
        <div id="myhand_wrap" class="whiteblock hand-area">
          <b>${_("My hand")}</b>
          <div id="myhand"></div>
        </div>
        <div id="pool_area" class="whiteblock pool-area">
          <b>${_("Pool")}</b> <span id="deck_counter_el" class="deck-count-label">(${gamedatas.deck_count ?? 0} ${_("cards in deck")})</span>
          <div id="pool" class="pool-cards"></div>
        </div>
        <div id="discard_area" class="whiteblock discard-area">
          <b>${_("Discard")}</b>
          <div id="discard" class="card-stock"></div>
        </div>
        `
      );

      dojo.addClass("game_play_area", "linko-play-area");
    },

    _poolSetup: function (gamedatas) {
      this.poolStock = new BgaCards.LineStock(
        this.cardsManager,
        document.getElementById("pool"),
        { fanShaped: false, sort: (a, b) => a.type - b.type }
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
      this.handStock = new BgaCards.LineStock(
        this.cardsManager,
        document.getElementById("myhand"),
        { sort: (a, b) => a.type - b.type }
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

      this._compactTableRows(document.getElementById("mytable"));
    },

    _otherPlayersSetup: function (gamedatas) {
      const currentId = parseInt(gamedatas.current_player.id);
      this.othersStocks = {};

      Object.keys(gamedatas.players_hands).forEach((id) => {
        if (parseInt(id) === currentId) return;

        const player = gamedatas.players_hands[id];

        // Per-row table stocks only — no hand stock (hands are hidden)
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

        this.othersStocks[id] = { tables };

        // Populate table rows
        const playertables = player.playertables || [];
        playertables.forEach((rowCards, i) => {
          if (rowCards && rowCards.length > 0) {
            tables[i].addCards(rowCards);
          }
        });

        this._compactTableRows(document.getElementById(id + "_table"));
      });
    },

    _playerBoardsSetup: function (gamedatas) {
      const currentId = parseInt(gamedatas.current_player.id);

      Object.values(gamedatas.players).forEach((player) => {
        const pid = parseInt(player.id);
        const playerData = gamedatas.players_hands[pid] ?? {};

        // Count initial hand cards
        const handCount = Object.keys(playerData.hand ?? {}).length;

        // Count initial stacked cards across all rows
        let tableCount = 0;
        (playerData.playertables || []).forEach((row) => {
          tableCount += row?.length ?? 0;
        });

        this._playerStats[pid] = { hand: handCount, table: tableCount };

        // Add hand counter to player panel
        this.getPlayerPanelElement(player.id).insertAdjacentHTML(
          "beforeend",
          `<div><span id="hand-count-${pid}"></span> cards in hand</div>`
        );
        const ctr = new ebg.counter();
        ctr.create(`hand-count-${pid}`);
        ctr.setValue(handCount);
        this[`_handCtr_${pid}`] = ctr;

        // Set initial live score
        this._updateScore(pid);

        this._updateHandBadge(pid);
      });
    },

    _updateScore: function (playerId) {
      const stats = this._playerStats[playerId];
      if (!stats) return;

      const score = stats.table - stats.hand;
      if (this.scoreCtrl && this.scoreCtrl[playerId]) {
        this.scoreCtrl[playerId].setValue(score);
      }

      const ctr = this[`_handCtr_${playerId}`];
      if (ctr) ctr.setValue(stats.hand);

      this._updateHandBadge(playerId);
    },

    _updateHandBadge: function (playerId) {
      const stats = this._playerStats[playerId];
      const badge = document.getElementById(playerId + "_hand_count_badge");
      if (badge && stats) {
        badge.textContent = `(${stats.hand} cards in hand)`;
      }
    },

    // -------------------------------------------------------------------------
    // Stock lookup helpers
    // -------------------------------------------------------------------------

    _getTableEl: function (playerId) {
      const currentId = parseInt(this.gamedatas.current_player.id);
      return parseInt(playerId) === currentId
        ? document.getElementById("mytable")
        : document.getElementById(playerId + "_table");
    },

    _compactTableRows: function (tableEl) {
      if (!tableEl) return;
      const rows = Array.from(tableEl.children);

      // z-index: higher row index = more on top (most recent play stays visible)
      rows.forEach((row) => {
        row.style.zIndex = parseInt(row.id.split("_").pop());
      });
    },

    _cleanRowEl: function (pid, rowIdx) {
      const currentId = parseInt(this.gamedatas.current_player.id);
      const prefix    = pid === currentId ? "mytable" : pid + "_table";
      const rowEl     = document.getElementById(prefix + "_row_" + rowIdx);
      if (rowEl) rowEl.querySelectorAll(".bga-cards_card").forEach((el) => el.remove());
    },

    _refreshAll: function () {
      document.querySelectorAll(".snatch-highlight").forEach((el) =>
        el.classList.remove("snatch-highlight")
      );
      // Re-compact every player's table
      this._compactTableRows(document.getElementById("mytable"));
      Object.keys(this.othersStocks).forEach((id) => {
        this._compactTableRows(document.getElementById(id + "_table"));
      });
      // Refresh scores, hand counters, and badges for every player
      Object.keys(this._playerStats).forEach((pid) => {
        this._updateScore(parseInt(pid));
      });
    },

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
      return null; // other players' hands are not shown
    },

    // -------------------------------------------------------------------------
    // Game & client states
    // -------------------------------------------------------------------------

    onEnteringState: function (stateName, args) {
      switch (stateName) {
        case "PlayerTurn":
          if (this.isCurrentPlayerActive()) {
            this.handStock.setSelectionMode("multiple");
            this.handStock.onSelectionChange = (selection) =>
              this._onHandSelectionChange(selection);
          }
          break;
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
        case "PlayerTurn":
          this.handStock.unselectAll();
          this.handStock.onSelectionChange = null;
          break;
        case "RobbedPlayerDraw":
          this.poolStock.setSelectionMode("none");
          this.poolStock.onSelectionChange = null;
          this.poolStock.unselectAll();
          break;
      }
    },

    // -------------------------------------------------------------------------
    // Action buttons
    // -------------------------------------------------------------------------

    _cardLabel: function (type) {
      return type == "14" ? "X" : type;
    },

    _onHandSelectionChange: function (selection) {
      this.statusBar.removeActionButtons();
      if (selection.length === 0) return;

      const nonJokers = selection.filter((c) => parseInt(c.type) !== 14);
      const types     = [...new Set(nonJokers.map((c) => String(c.type)))];

      if (types.length > 1) {
        this.statusBar.addActionButton(
          _("All cards must be the same number — Clear selection"),
          () => this.handStock.unselectAll()
        );
        return;
      }

      // Build label: e.g. "3×5 + 2×X" or "2×X"
      const jokerCount = selection.length - nonJokers.length;
      const numType    = types[0];
      const numCount   = nonJokers.length;
      const rep        = (n, lbl) => (n > 1 ? `${n}×${lbl}` : lbl);

      let summary;
      if (numType) {
        summary = rep(numCount, this._cardLabel(numType));
        if (jokerCount > 0) summary += ` + ${rep(jokerCount, "X")}`;
      } else {
        summary = rep(jokerCount, "X");
      }

      this.statusBar.addActionButton(`${_("Play")} ${summary}`, () => {
        this.bgaPerformAction("actPlayCard", {
          selectedCards: JSON.stringify(selection),
        }).then(() => this.handStock.unselectAll());
      });
      this.statusBar.addActionButton(_("Clear"), () => this.handStock.unselectAll());
    },

    onUpdateActionButtons: function (stateName, args) {
      if (!this.isCurrentPlayerActive()) return;

      switch (stateName) {
        case "PlayerTurn":
          // Buttons are driven by hand card selection — see _onHandSelectionChange
          this.statusBar.removeActionButtons();
          break;

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
          const rowIdx  = args.snatch?.row_idx;
          const snatchIds = new Set((args.snatch?.card_ids ?? []).map(String));
          let cardSummary = "";
          if (rowIdx !== undefined && snatchIds.size > 0) {
            const cards = (this.tableStocks[rowIdx]?.getCards() ?? [])
              .filter((c) => snatchIds.has(String(c.id)));
            if (cards.length > 0) {
              cardSummary = " (" + cards.map((c) => this._cardLabel(c.type)).join(", ") + ")";
            }
          }
          this.statusBar.removeActionButtons();
          this.statusBar.addActionButton(_("Pick up") + cardSummary, () =>
            this.bgaPerformAction("actPickUp", {})
          );
          this.statusBar.addActionButton(_("Discard and draw") + cardSummary, () =>
            this.bgaPerformAction("actDiscard", {})
          );
          break;
        }

        case "RobbedPlayerDraw": {
          const drawCount = args.draw_count ?? 0;
          const deckCount = args.deck_count ?? 0;
          const poolCount = Object.keys(args.pool ?? {}).length;
          this.statusBar.removeActionButtons();

          if (drawCount > 0 && deckCount === 0 && poolCount === 0) {
            // Nothing left to draw — auto-advance
            this.bgaPerformAction("actDrawCard", { cardId: 0 });
            break;
          }

          if (deckCount > 0 && drawCount > 0) {
            this.statusBar.addActionButton(
              `${_("Draw from deck")} (${drawCount} remaining)`,
              () => this.bgaPerformAction("actDrawCard", { cardId: 0 })
            );
          }
          // Pool cards are always clickable via the selection handler in onEnteringState
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
      const tableStock = this._getTableStock(pid, row_idx);

      if (this._playerStats[pid]) {
        this._playerStats[pid].hand -= cards.length;
        this._playerStats[pid].table += cards.length;
      }

      if (tableStock) await tableStock.addCards(cards);
      this._refreshAll();
    },

    /** Active player takes snatched cards into their hand */
    notif_snatchTaken: async function (notif) {
      const { player_id, robbed_id, cards, row_idx } = this._args(notif);
      if (player_id == null) return;
      const takerId    = parseInt(player_id);
      const robbedId   = parseInt(robbed_id);
      const tableStock = this._getTableStock(robbedId, row_idx);
      const handStock  = this._getHandStock(takerId);

      if (this._playerStats[takerId]) this._playerStats[takerId].hand += cards.length;
      if (this._playerStats[robbedId]) this._playerStats[robbedId].table -= cards.length;

      if (tableStock) {
        if (handStock) {
          await handStock.addCards(cards);
        } else {
          tableStock.removeCards(cards);
        }
      }
      const rowEl = document.getElementById(
        (robbedId === parseInt(this.gamedatas.current_player.id) ? "mytable" : robbedId + "_table") + "_row_" + row_idx
      );
      if (rowEl) rowEl.classList.remove("snatch-highlight");
      this._cleanRowEl(robbedId, row_idx);
      this._refreshAll();
    },

    /** Active player declines — just clear the highlight */
    notif_snatchDeclined: async function (notif) {
      const { robbed_id, row_idx } = this._args(notif);
      if (robbed_id == null) return;
      const rowEl = document.getElementById(robbed_id + "_table_row_" + row_idx);
      if (rowEl) rowEl.classList.remove("snatch-highlight");
      this._refreshAll();
    },

    /** Robbed player picks up their own cards back to hand */
    notif_cardsReturnedToHand: async function (notif) {
      const { player_id, card_ids, row_idx } = this._args(notif);
      if (player_id == null) return;
      const pid        = parseInt(player_id);
      const tableStock = this._getTableStock(pid, row_idx);
      const handStock  = this._getHandStock(pid);

      if (tableStock) {
        const cards = tableStock.getCards().filter((c) => card_ids.includes(parseInt(c.id)));
        if (cards.length > 0) {
          if (this._playerStats[pid]) {
            this._playerStats[pid].table -= cards.length;
            this._playerStats[pid].hand += cards.length;
          }
          if (handStock) {
            await handStock.addCards(cards);
          } else {
            tableStock.removeCards(cards);
          }
        }
      }
      this._cleanRowEl(pid, row_idx);
      this._refreshAll();
    },

    /** Robbed player discards their snatched cards */
    notif_cardsDiscarded: async function (notif) {
      const { player_id, card_ids, row_idx } = this._args(notif);
      if (player_id == null) return;
      const pid        = parseInt(player_id);
      const tableStock = this._getTableStock(pid, row_idx);

      if (tableStock) {
        const cards = tableStock.getCards().filter((c) => card_ids.includes(parseInt(c.id)));
        if (cards.length > 0) {
          if (this._playerStats[pid]) this._playerStats[pid].table -= cards.length;
          await this.discardStock.addCards(cards);
        }
      }
      this._cleanRowEl(pid, row_idx);
      this._refreshAll();
    },

    /** Player draws a card (public — from pool, or face-down from deck for others) */
    notif_cardDrawn: async function (notif) {
      const { player_id, from_pool, card } = this._args(notif);
      if (player_id == null) return;
      const pid       = parseInt(player_id);
      const handStock = this._getHandStock(pid);
      const currentId = parseInt(this.gamedatas.current_player.id);

      if (from_pool && card) {
        if (this._playerStats[pid]) this._playerStats[pid].hand += 1;
        if (handStock) {
          await handStock.addCards([card]);
        } else {
          this.poolStock.removeCard(card);
        }
      } else if (!from_pool && pid !== currentId) {
        if (this._playerStats[pid]) this._playerStats[pid].hand += 1;
      }
      this._refreshAll();
    },

    /** Private notification for the player who drew from deck — reveals their card */
    notif_cardDrawnPrivate: async function (notif) {
      const { card } = this._args(notif);
      if (card) {
        const pid = parseInt(this.gamedatas.current_player.id);
        if (this._playerStats[pid]) this._playerStats[pid].hand += 1;
        await this.handStock.addCard(card);
      }
      this._refreshAll();
    },

    /** New cards added to pool from deck */
    notif_poolReplenished: async function (notif) {
      const { cards } = this._args(notif);
      if (cards && cards.length > 0) {
        await this.poolStock.addCards(cards);
      }
      this._refreshAll();
    },

    /** Final scores (BGA framework updates scoreboard automatically) */
    notif_finalScore: async function (notif) {},
  });
});
