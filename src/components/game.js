import React from 'react';
import './game.scss';
import Timer from './timer';

const Game = ({ sendMessage, gameState }) => {
  const startRound = () => {
    sendMessage({ type: 'START_ROUND' });
  };

  const buzz = () => {
    sendMessage({ type: 'BUZZ' });
  };

  const invalidBuzz = () => {
    sendMessage({ type: 'BUZZ_INVALID' });
  };

  const validBuzz = () => {
    sendMessage({ type: 'BUZZ_VALID' });
  };

  const curTeam = gameState.teams[gameState.curTeam];
  const isOnCurrentTeam = gameState.user.team === curTeam.name;
  const isCurrentPlayer = gameState.user.name === curTeam.curPlayer;

  const displayCard = () => {
    if (!isOnCurrentTeam || isCurrentPlayer) {
      return <section className="game-card">
        <p className="word">{gameState.card.word}</p>
        <article className="taboo-list">
          {gameState.card.taboo.map(tabooWord => (
            <p className="taboo-word" key={tabooWord}>{tabooWord}</p>
          ))}
        </article>
      </section>
    }
    return <p>Your teammate <span className="player">{curTeam.curPlayer}</span> is giving clues</p>;
  }

  const displayBuzz = () => {
    if (!gameState.buzzer) {
      if (!isOnCurrentTeam) {
        return <button className="start buzz-button" type="button" onClick={buzz}>BUZZ!</button>
      }
    } else {
      // Buzz paused state
      if (isCurrentPlayer) {
        return (
          <section className="buzz-container">
            <p><span className="player">{gameState.buzzer}</span> has accussed you of using a taboo word</p>
            <article>
              <button className="invalid" type="button" onClick={invalidBuzz}>Invalid BUZZ</button>
              <button className="valid" type="button" onClick={validBuzz}>Valid BUZZ</button>
            </article>
          </section>
        )
      } else {
        return <p>Waiting for <span className="player">{curTeam.curPlayer}</span> to resume</p>
      }
    }
  }

  const displayStart = () => {
    if (isCurrentPlayer && !gameState.card) {
      return <button className="start" type="button" onClick={startRound}>Start Round</button>
    }
  }

  return (
    <div className="game-container">
      <h1>Remote Taboo</h1>
      <section className="score-cards">
        {gameState.teams.map((team, index) => (
          <article className="team" key={team.name}>
            <p className={gameState.curTeam === index ? 'active' : 'inactive'}>{team.name}</p>
            <p>{(team.correct || []).length}</p>
          </article>
        ))}
      </section>
      {!!gameState.card ? (
        <>
          <Timer gameState={gameState} />
          {displayCard()}
          {displayBuzz()}
        </>
      ) : displayStart()
      }
    </div>
  )
};

export default Game;
