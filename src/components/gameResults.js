import React from 'react';
import './gameResults.scss';

const GameResults = ({ results }) => {
  return !results ? null : (
    <>
      <h3>Game Results</h3>
      <section className="team-container">
        {results.map(team => (
          <article className="team" key={team.name}>
            <p className="name">{team.name}: {team.correct.length}</p>
            <p className="kvp">
              <span className="label">Players</span>
              <span className="value">{team.players.join(', ')}</span>
            </p>
            <p className="kvp">
              <span className="label">Correct Words</span>
              <span className="value">{team.correct.join(', ')}</span>
            </p>
            <p className="kvp">
              <span className="label">Skipped Words</span>
              <span className="value">{team.skipped.join(', ')}</span>
            </p>
          </article>
        ))}
      </section>
    </>
  );
};

export default GameResults;
