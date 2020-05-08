import React, { useState } from 'react';

const Register = ({ sendMessage }) => {
  const [inputs, setInputs] = useState({ team: '', name: '' });

  const handleInput = (event) => {
    event.persist();
    setInputs(inputs => ({ ...inputs, [event.target.id]: event.target.value }));
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    console.log('Submitting', inputs.team, inputs.name);
    sendMessage({ type: 'REGISTER', data: inputs });
  };

  return (
    <div>
      <h1>Hello World</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="team">
          Team:
          <input id="team" type="text" value={inputs.team} onChange={handleInput} required />
        </label>
        <label htmlFor="name">
          Name:
          <input id="name" type="text" value={inputs.name} onChange={handleInput} required />
        </label>

        <input type="submit" value="Register" />
      </form>
    </div>
  )
};
export default Register;
