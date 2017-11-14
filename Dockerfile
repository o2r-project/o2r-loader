# (C) Copyright 2017 o2r project. https://o2r.info
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
FROM node:8-alpine
# FROM alpine:3.6 does not work because of https://github.com/sonicdoe/detect-character-encoding/issues/8

# Python, based on frolvlad/alpine-python3
RUN apk add --no-cache \
  python2 \
  && python2 -m ensurepip \
  && rm -r /usr/lib/python*/ensurepip \
  && pip install --upgrade pip setuptools setuptools_scm \
  && if [ ! -e /usr/bin/pip ]; then ln -s pip /usr/bin/pip ; fi \
  && if [[ ! -e /usr/bin/python ]]; then ln -sf /usr/bin/python2 /usr/bin/python; fi \
  && rm -r /root/.cache

# Add Alpine mirrors, replacing default repositories with edge ones, based on https://github.com/jfloff/alpine-python/blob/master/3.4/Dockerfile
RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/testing" > /etc/apk/repositories \
  && echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories \
  && echo "http://dl-cdn.alpinelinux.org/alpine/edge/main" >> /etc/apk/repositories

RUN apk add --no-cache \
    unzip \
    dumb-init \
    # needed for loading from external http(s) sources
    wget \
    openssl \
    # needed for npm install gyp
    make \
    g++ \
  && pip install bagit

# Install app
WORKDIR /loader
COPY package.json package.json
RUN npm install --production

RUN apk del \
  make \
  g++ \
  && rm -rf /var/cache

COPY config config
COPY controllers controllers
COPY lib lib
COPY index.js index.js

# Metadata params provided with docker build command
ARG VERSION=dev
ARG VCS_URL
ARG VCS_REF
ARG BUILD_DATE

# Metadata http://label-schema.org/rc1/
LABEL org.label-schema.vendor="o2r project" \
      org.label-schema.url="http://o2r.info" \
      org.label-schema.name="o2r loader" \
      org.label-schema.description="compendium and workspace loading from uploaded files and cloud resources" \    
      org.label-schema.version=$VERSION \
      org.label-schema.vcs-url=$VCS_URL \
      org.label-schema.vcs-ref=$VCS_REF \
      org.label-schema.build-date=$BUILD_DATE \
      org.label-schema.docker.schema-version="rc1"

# If running in a container the app is root, so the second order container also must have root access, otherwise permission problems
ENV LOADER_META_TOOL_CONTAINER_USER=root

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "start" ]
