import React from 'react';
import './lobby.scss';
import GameResults from './gameResults';
import ChangeTeam from './changeTeam';

const Lobby = ({ sendMessage, gameState: { teams, user, gameResults } }) => {

  const changeTeam = (team, event) => {
    event.preventDefault();
    sendMessage({ type: 'CHANGE_TEAM', data: team });
  };

  const startGame = () => {
    sendMessage({ type: 'START_GAME' });
  };

  return (
    <div className="lobby-container">
      <h1>Game Lobby</h1>
      <section className="team-container">
        {teams.map(team => (
          <article className="team" key={team.name}>
            {user.team === team.name ? <span>Current Team</span> : <button type="button" onClick={changeTeam.bind(null, team.name)}>Join Team</button>}
            <p className="name">{team.name}</p>
            <p className="players">
              {team.players.map(player => (
                <span key={player}>{player}</span>
              ))}
            </p>
          </article>
        ))}
        <article className="create-team"><ChangeTeam submit={changeTeam} /></article>
      </section>
      <button className="start" type="button" onClick={startGame}>Start Game</button>
      <GameResults results={gameResults} />
    </div>
  )
};

export default Lobby;
