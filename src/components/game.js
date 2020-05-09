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

  const correct = () => {
    sendMessage({ type: 'CORRECT' });
  };

  const skip = () => {
    sendMessage({ type: 'SKIP' });
  };

  const endGame = () => {
    sendMessage({ type: 'END_GAME' });
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
      if (isCurrentPlayer) {
        return (
          <section className="button-container">
            <p></p>
            <article>
              <button className="skip" type="button" onClick={skip}>SKIP</button>
              <button className="correct" type="button" onClick={correct}>CORRECT</button>
            </article>
          </section>
        )
      }
    } else {
      // Buzz paused state
      if (isCurrentPlayer) {
        return (
          <section className="button-container">
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
      return (
        <section className="button-container">
          <p></p>
          <article>
            <button className="end" type="button" onClick={endGame}>End Game</button>
            <button className="start" type="button" onClick={startRound}>Start Round</button>
          </article>
        </section>
      );
    } else {
      return <p>Waiting for <span className="player">{curTeam.curPlayer}</span> to start the round</p>
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
