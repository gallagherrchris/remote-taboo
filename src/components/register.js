import React, { useState, useEffect } from 'react';

const Register = ({ sendMessage }) => {
  const [inputs, setInputs] = useState({
    team: localStorage.getItem('team'),
    name: localStorage.getItem('name')
  });

  const handleInput = (event) => {
    event.persist();
    setInputs(inputs => ({ ...inputs, [event.target.id]: event.target.value }));
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    console.log('Submitting', inputs.team, inputs.name);
    sendMessage({ type: 'REGISTER', data: inputs });

    localStorage.setItem('team', inputs.team);
    localStorage.setItem('name', inputs.name)
  };

  return (
    <div>
      <h1>Remote Taboo</h1>
      <form onSubmit={handleSubmit}>
        <section className="input">
          <label htmlFor="team">
            Team:
          <input id="team" type="text" value={inputs.team} onChange={handleInput} required />
          </label>
        </section>
        <section className="input">
          <label htmlFor="name">
            Name:
          <input id="name" type="text" value={inputs.name} onChange={handleInput} required />
          </label>
        </section>

        <input type="submit" value="Register" />
      </form>
    </div>
  )
};
export default Register;
