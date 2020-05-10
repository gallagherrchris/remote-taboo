import React, { useState } from 'react';
import './lobby.scss';
import GameResults from './gameResults';

const NewTeam = ({ changeTeam }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [teamName, setTeamName] = useState('');

  const submitTeamName = (event) => {
    changeTeam(teamName, event);
    setIsEditing(false);
    setTeamName('');
  };

  return isEditing ? (
    <form onSubmit={submitTeamName}>
      <label htmlFor="team-name">
        Team Name
        <input id="team-name" type="text" value={teamName} onChange={({ target }) => setTeamName(target.value)} required />
      </label>
      <div className="button-container">
        <button type="button" onClick={() => setIsEditing(false)}>Cancel</button>
        <button type="submit">Create Team</button>
      </div>
    </form>
  ) : <button type="button" onClick={() => setIsEditing(true)}>Create new team</button>;
};

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
        <article className="create-team"><NewTeam changeTeam={changeTeam}/></article>
      </section>
      <button className="start" type="button" onClick={startGame}>Start Game</button>
      <GameResults results={gameResults} />
    </div>
  )
};

export default Lobby;
