import React, { useState } from 'react';

const ChangeTeam = ({ submit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [teamName, setTeamName] = useState('');

  const submitTeamName = (event) => {
    submit(teamName, event);
    setIsEditing(false);
    setTeamName('');
  };

  return isEditing ? (
    <form onSubmit={submitTeamName}>
      <label htmlFor="team-name">
        Team Name
        <input id="team-name"
          type="text"
          value={teamName}
          required
          maxLength="20"
          onChange={({ target }) => setTeamName(target.value)}
          ref={input => input && input.focus()}
        />
      </label>
      <div className="button-container">
        <button type="button" onClick={() => setIsEditing(false)}>Cancel</button>
        <button type="submit">Create Team</button>
      </div>
    </form>
  ) : <button type="button" onClick={() => setIsEditing(true)}>Create new team</button>;
};

export default ChangeTeam;