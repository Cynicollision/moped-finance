// shared/ has no tooling of its own: the server lints it (npm run lint in server/), as its Jest runs its specs.
module.exports = require('./../server/eslint.config.js');
