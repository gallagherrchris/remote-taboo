import React, { useState } from 'react';
import './register.scss';

const Register = ({ sendMessage }) => {
  const [inputs, setInputs] = useState({
    game: localStorage.getItem('game') || '',
    name: localStorage.getItem('name') || ''
  });

  const handleInput = (event) => {
    event.persist();
    setInputs(inputs => ({ ...inputs, [event.target.id]: event.target.value }));
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage({ type: 'JOIN_GAME', data: inputs });

    localStorage.setItem('game', inputs.game);
    localStorage.setItem('name', inputs.name)
  };

  return (
    <div className="registration-container">
      <h1>Remote Taboo</h1>
      <form className="registration" onSubmit={handleSubmit}>
        <section className="input">
          <label htmlFor="game">Game Code:</label>
          <input id="game" type="text" value={inputs.game} onChange={handleInput} required />
        </section>
        <section className="input">
          <label htmlFor="name">Name:</label>
          <input id="name" type="text" value={inputs.name} onChange={handleInput} required />
        </section>

        <button type="submit">Join Game</button>
      </form>
    </div>
  )
};
export default Register;
