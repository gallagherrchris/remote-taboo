const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

const getNextElement = (arr, curIndex) => {
  if (curIndex + 1 >= arr.length) {
    return arr[0];
  }
  return arr[curIndex + 1];
}

module.exports = {
  getRandomElement,
  getNextElement
};
