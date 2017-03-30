# o2r-loader

Node.js implementation to load compendia from third party repositories and resources via the [o2r web api](http://o2r.info/o2r-web-api).

Currently, it implements the endpoint `/api/v2/compendium`.

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
- `SESSION_SECRET`
  String used to sign the session ID cookie, must match other microservices.

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

Tests found in the file `api.js` can be started using mocha:

```bash
npm install
npm install -g mocha
mocha
```
For this, the loader has to run locally or as part of a docker-compose configuration.

## Dockerfile

The file `Dockerfile` describes the Docker image published at [Docker Hub](https://hub.docker.com/r/o2rproject/o2r-loader/).

## License

o2r-loader is licensed under Apache License, Version 2.0, see file LICENSE.

Copyright (C) 2016 - o2r project.
