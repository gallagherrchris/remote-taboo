import React from 'react';
import './lobby.scss';

const Lobby = ({ sendMessage, gameState: { teams, user } }) => {

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
            {user.team === team.name ? <span>Current Team</span> : <button type="button" onClick={changeTeam.bind(null, team.name)}>Switch Team</button>}
            <p className="name">{team.name}</p>
            <p className="players">
              {team.players.map(player => (
                <span key={player}>{player}</span>
              ))}
            </p>
          </article>
        ))}
      </section>
      <button className="start" type="button" onClick={startGame}>Start Game</button>
    </div>
  )
};

export default Lobby;
