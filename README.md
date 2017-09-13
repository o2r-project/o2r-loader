# o2r-loader

[![](https://images.microbadger.com/badges/image/o2rproject/o2r-loader.svg)](https://microbadger.com/images/o2rproject/o2r-loader "Get your own image badge on microbadger.com") [![](https://images.microbadger.com/badges/version/o2rproject/o2r-loader.svg)](https://microbadger.com/images/o2rproject/o2r-loader "Get your own version badge on microbadger.com")

Node.js implementation to load compendia from third party repositories and handle direct user uploads for the [o2r web api](http://o2r.info/o2r-web-api).

Currently, it implements the endpoint `/api/v1/compendium`.

## Supported repositories

- Sciebo (https://sciebo.de)
- Zenodo or Zenodo Sandbox (https://zenodo.org or https://sandbox.zenodo.org)

## Requirements

Requirements:

- Node.js `>= 6.2`
- npm
- Python `>= 3.x`
- bagit-python (`bagit.py`)
- o2r-meta (`o2rmeta.py`)
- unzip
- mongodb

## Configuration

The configuration can be done via environment variables.

- `LOADER_PORT`
  Define on which port loader should listen. Defaults to `8088`.
- `LOADER_MONGODB` __Required__
  Location for the mongo db. Defaults to `mongodb://localhost/`. You will very likely need to change this.
- `LOADER_MONGODB_DATABASE`
  Which database inside the mongo db should be used. Defaults to `muncher`.
- `LOADER_BASEPATH`
  The local path where compendia are stored. Defaults to `/tmp/o2r/`.
- `LOADER_META_TOOL_EXE` __Required__
  Executable for metadata tools, defaults to `python3 ../o2r-meta/o2rmeta.py`. You will very likely need to change this.
- `LOADER_META_EXTRACT_MAPPINGS_DIR` __Required__
  Path to extraction mappings, defaults to `../o2r-meta/broker/mappings`. You will very likely need to change this.
- `SESSION_SECRET`
  String used to sign the session ID cookie, must match other microservices.
- `SLACK_BOT_TOKEN`
  Authentication token for a bot app on Slack. See section [Slack bot](#slack-bot).
- `SLACK_VERIFICATION_TOKEN`
  Token provided by Slack for interative messages and events, to be used to verify that requests are actually coming from Slack.
- `SLACK_CHANNEL_STATUS`
  Channel to post status messages to, defaults to `#monitoring`.
- `SLACK_CHANNEL_LOAD`
  Channel to post messages related to (up)loading to, defaults to `#monitoring`.

## Slack bot

Documentation of Slack API: https://api.slack.com/bot-users, especially [interactive messages](https://api.slack.com/interactive-messages).

The bot needs the permissions to join channels and post to them.
Add the following scopes to the app in the section "OAuth & Permissions" in the bot's apps page.

- `channels:write`
- `chat:write:bot`
- `bot`

While adding the app to your Slack organisation, make sure to allow the bot to post the the desired channel.

### Local bot development

Start ngrok with `ngrok http 8088` and enter the public endpoint pointing to your local server at https://api.slack.com/apps/A6J6CDLQK/interactive-messages. ngrok also has a useful web interface at http://127.0.0.1:4040/inspect/http on all incoming requests.

## Supported encodings

The upload process may fail if certain files with unsupported encoding are detected: 

The encoding of text files analyzed by the o2r metadata extraction tool [o2r-meta](https://github.com/o2r-project/o2r-meta) must be Unicode (`UTF-8`, `UTF-16BE`, ...) or Unicode compatible (e.g. `ISO-8859-1`). The supported encodings and the list of files checked can be configured in `config.js`. 

## Development

### Steps for manual local development

```bash
mkdir /tmp/o2r-mongodb-data
mongod --dbpath /tmp/o2r-mongodb-data
# new terminal: start bouncer (default port 8081)
cd ../o2r-bouncer
DEBUG=* OAUTH_CLIENT_ID=<...> OAUTH_CLIENT_SECRET=<...> npm start
```

Then start the loader in your IDE or in a new terminal.

## Testing

Tests can be started using mocha:

```bash
npm install
npm install -g mocha
mocha

# alternative:
npm test

# set test endpoint manually
TEST_HOST=http://localhost:80 npm test
```
For this, the loader has to run locally or as part of a docker-compose configuration.

## Dockerfile

The file `Dockerfile` describes the Docker image published at [Docker Hub](https://hub.docker.com/r/o2rproject/o2r-loader/).

## License

o2r-loader is licensed under Apache License, Version 2.0, see file LICENSE.

Copyright (C) 2017 - o2r project.
