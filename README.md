# o2r-loader

Node.js implementation to load compendia from third party repositories and resources via the [o2r web api](http://o2r.info/o2r-web-api).

## Requirements

- Node.js (`>= 6.x`)

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

## Run locally

```bash
npm install
npm start
```

TBD

## Test

TBD

## Dockerfile

The file `Dockerfile` describes the Docker image published at [Docker Hub](https://hub.docker.com/r/o2rproject/o2r-loader/).

## License

o2r-loader is licensed under Apache License, Version 2.0, see file LICENSE.

Copyright (C) 2016 - o2r project.
