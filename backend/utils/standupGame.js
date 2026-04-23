var StandUpGame = {
  create: function(room, config) {
    if (!config || !config.enable_standup_game) return null;

    var penaltyAmount = Math.max(1, parseInt(config.standup_penalty_amount) || 5000);
    var participantIds = [];
    var playerStatusMap = {};

    room.players.forEach(function(player) {
      participantIds.push(player.playerId);
      playerStatusMap[player.playerId] = true;
    });

    var instance = {
      is_enabled: true,
      is_round_finished: false,
      penalty_amount: penaltyAmount,
      participant_ids: participantIds.slice(),
      player_status_map: Object.assign({}, playerStatusMap),
      pay_player_id: null,
      logs: []
    };

    this._log(instance, 'INIT', {
      enabled: true,
      penaltyAmount: penaltyAmount,
      participants: participantIds.map(function(pid) {
        var p = room.players.find(function(pl) { return pl.playerId === pid; });
        return p ? p.nickname : pid;
      })
    });

    return instance;
  },

  _log: function(su, type, data) {
    var entry = {
      type: type,
      timestamp: Date.now(),
      data: data || {}
    };
    su.logs.push(entry);
    console.log('[站立游戏]', type, JSON.stringify(data));
  },

  _getPlayerNickname: function(room, playerId) {
    if (!room) return playerId;
    var player = room.players.find(function(p) { return p.playerId === playerId; });
    return player ? player.nickname : playerId;
  },

  getActiveInstance: function(room) {
    return room.standupGame && !room.standupGame.is_round_finished ? room.standupGame : null;
  },

  onHandEnd: function(room, winnerSocketIds) {
    var su = this.getActiveInstance(room);
    if (!su) return null;

    var self = this;
    var winnerPlayerIds = [];
    if (Array.isArray(winnerSocketIds)) {
      winnerSocketIds.forEach(function(sid) {
        var player = room.players.find(function(p) { return p.id === sid; });
        if (player && su.participant_ids.includes(player.playerId)) {
          winnerPlayerIds.push(player.playerId);
        }
      });
    }

    if (winnerPlayerIds.length === 0) return null;

    var changedPlayers = [];

    winnerPlayerIds.forEach(function(winnerPid) {
      var oldStatus = su.player_status_map[winnerPid];
      if (oldStatus === true) {
        su.player_status_map[winnerPid] = false;
        changedPlayers.push({
          playerId: winnerPid,
          nickname: self._getPlayerNickname(room, winnerPid),
          oldState: 'standing',
          newState: 'sitting'
        });

        self._log(su, 'STATUS_CHANGE', {
          playerId: winnerPid,
          nickname: self._getPlayerNickname(room, winnerPid),
          from: 'standing',
          to: 'sitting'
        });
      }
    });

    var standingCount = this._countStanding(su);

    if (standingCount === 1) {
      var lastStandingPid = this._getLastStanding(su);
      return this._executeFinalSettlement(room, su, lastStandingPid, 'ONLY_ONE_STANDING');
    }

    if (standingCount === 0) {
      this._log(su, 'ROUND_END', { reason: 'ALL_SITTING', message: '所有玩家均已坐下，本轮站立游戏无支付方' });
      su.is_round_finished = true;
      return { type: 'ROUND_END_NO_SETTLEMENT', reason: 'ALL_SITTING' };
    }

    return { type: 'STATUS_UPDATED', changedPlayers: changedPlayers, remainingStanding: standingCount };
  },

  onPlayerLeave: function(room, leavingSocketId) {
    var su = this.getActiveInstance(room);
    if (!su) return null;

    var self = this;
    var leavingPlayer = room.players.find(function(p) { return p.id === leavingSocketId; });
    if (!leavingPlayer) return null;

    var leavingPid = leavingPlayer.playerId;

    if (!su.participant_ids.includes(leavingPid)) {
      return null;
    }

    var wasStanding = su.player_status_map[leavingPid] === true;

    if (wasStanding) {
      this._log(su, 'PLAYER_LEAVE_STANDING', {
        playerId: leavingPid,
        nickname: leavingPlayer.nickname,
        status: 'standing'
      });

      return this._executeFinalSettlement(room, su, leavingPid, 'STANDING_PLAYER_LEFT');
    } else {
      var idx = su.participant_ids.indexOf(leavingPid);
      if (idx !== -1) {
        su.participant_ids.splice(idx, 1);
      }

      this._log(su, 'PLAYER_LEAVE_SITTING', {
        playerId: leavingPid,
        nickname: leavingPlayer.nickname,
        status: 'sitting',
        remainingParticipants: su.participant_ids.length
      });

      var standingCount = this._countStanding(su);

      if (standingCount === 1) {
        var lastStandingPid = this._getLastStanding(su);
        return this._executeFinalSettlement(room, su, lastStandingPid, 'SITTING_PLAYER_LEFT_ONE_REMAINING');
      }

      if (standingCount === 0) {
        this._log(su, 'ROUND_END', { reason: 'NO_STANDING_PLAYERS_AFTER_LEAVE', message: '离开后无剩余站立玩家' });
        su.is_round_finished = true;
        return { type: 'ROUND_END_NO_SETTLEMENT', reason: 'NO_STANDING' };
      }

      return { type: 'PARTICIPANT_REMOVED', playerId: leavingPid };
    }
  },

  onTableClose: function(room) {
    var su = this.getActiveInstance(room);
    if (!su) return null;

    var standingCount = this._countStanding(su);

    if (standingCount === 1) {
      var lastStandingPid = this._getLastStanding(su);
      var result = this._executeFinalSettlement(room, su, lastStandingPid, 'TABLE_CLOSED_ONE_STANDING');
      this._destroy(room);
      return result;
    }

    this._log(su, 'ROUND_END', {
      reason: 'TABLE_CLOSED',
      standingCount: standingCount,
      message: '桌台关闭，剩余站立玩家数=' + standingCount + '，不执行惩罚结算'
    });

    this._destroy(room);
    return { type: 'TABLE_CLOSED_NO_SETTLEMENT', reason: standingCount !== 1 ? 'MULTIPLE_OR_ZERO_STANDING' : 'UNKNOWN' };
  },

  onAllInElimination: function(room, eliminatedSocketId) {
    return this.onPlayerLeave(room, eliminatedSocketId);
  },

  _executeFinalSettlement: function(room, su, payPlayerId, triggerReason) {
    if (su.is_round_finished) return null;

    var self = this;
    su.is_round_finished = true;
    su.pay_player_id = payPlayerId;

    var payPlayer = room.players.find(function(p) { return p.playerId === payPlayerId; });
    var payerChips = payPlayer ? payPlayer.chips : 0;

    var receivers = su.participant_ids.filter(function(pid) { return pid !== payPlayerId; });

    this._log(su, 'GAME_END', {
      triggerReason: triggerReason,
      payPlayerId: payPlayerId,
      payPlayerNickname: payPlayer ? payPlayer.nickname : payPlayerId,
      receiverCount: receivers.length
    });

    var totalPayable = su.penalty_amount * receivers.length;
    var actualPayerChips = Math.max(0, payerChips);
    var canFullyPay = actualPayerChips >= totalPayable;

    var settlements = [];

    if (canFullyPay) {
      receivers.forEach(function(receiverPid) {
        var receiverPlayer = room.players.find(function(p) { return p.playerId === receiverPid; });
        if (receiverPlayer) {
          payPlayer.chips -= su.penalty_amount;
          receiverPlayer.chips += su.penalty_amount;
          settlements.push({
            receiverId: receiverPid,
            receiverNickname: receiverPlayer.nickname,
            amount: su.penalty_amount,
            status: 'PAID_FULL'
          });
        }
      });
    } else {
      var perReceiverShare = receivers.length > 0 ? Math.floor(actualPayerChips / receivers.length) : 0;
      var remainder = receivers.length > 0 ? actualPayerChips % receivers.length : 0;

      payPlayer.chips = 0;

      receivers.forEach(function(receiverPid, idx) {
        var receiverPlayer = room.players.find(function(p) { return p.playerId === receiverPid; });
        if (receiverPlayer) {
          var amount = perReceiverShare + (idx < remainder ? 1 : 0);
          receiverPlayer.chips += amount;
          settlements.push({
            receiverId: receiverPid,
            receiverNickname: receiverPlayer.nickname,
            amount: amount,
            status: 'PARTIAL_PAY',
            originalAmount: su.penalty_amount
          });
        }
      });
    }

    var result = {
      type: 'FINAL_SETTLEMENT',
      triggerReason: triggerReason,
      payPlayerId: payPlayerId,
      payPlayerNickname: payPlayer ? payPlayer.nickname : payPlayerId,
      penaltyPerPerson: su.penalty_amount,
      totalPayable: totalPayable,
      payerOriginalChips: payerChips,
      payerRemainingChips: payPlayer ? payPlayer.chips : 0,
      fullyPaid: canFullyPay,
      settlements: settlements
    };

    this._log(su, 'SETTLEMENT_COMPLETE', result);

    return result;
  },

  _countStanding: function(su) {
    var count = 0;
    for (var i = 0; i < su.participant_ids.length; i++) {
      if (su.player_status_map[su.participant_ids[i]] === true) {
        count++;
      }
    }
    return count;
  },

  _getLastStanding: function(su) {
    for (var i = 0; i < su.participant_ids.length; i++) {
      if (su.player_status_map[su.participant_ids[i]] === true) {
        return su.participant_ids[i];
      }
    }
    return null;
  },

  getStatusForFrontend: function(room) {
    var su = room.standupGame;
    if (!su) return null;

    var playerStates = {};
    su.participant_ids.forEach(function(pid) {
      var player = room.players.find(function(p) { return p.playerId === pid; });
      playerStates[pid] = {
        isStanding: su.player_status_map[pid],
        nickname: player ? player.nickname : pid,
        chips: player ? player.chips : 0
      };
    });

    return {
      enabled: su.is_enabled,
      finished: su.is_round_finished,
      penaltyAmount: su.penalty_amount,
      participantCount: su.participant_ids.length,
      standingCount: this._countStanding(su),
      sittingCount: su.participant_ids.length - this._countStanding(su),
      payPlayerId: su.pay_player_id || null,
      players: playerStates
    };
  },

  _destroy: function(room) {
    if (room.standupGame) {
      this._log(room.standupGame, 'MODULE_DESTROYED', {});
      room.standupGame = null;
    }
  },

  resetForNewRound: function(room, config) {
    this._destroy(room);
    if (config && config.enable_standup_game) {
      room.standupGame = this.create(room, config);
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StandUpGame;
}
