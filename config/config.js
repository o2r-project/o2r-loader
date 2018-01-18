/*
 * (C) Copyright 2017 o2r project.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
const yn = require('yn');
const debug = require('debug')('loader:config');

var c = {};
c.net = {};
c.mongo = {};
c.fs = {};
c.encoding = {};
c.webdav = {};
c.zenodo = {};
var env = process.env;

debug('Configuring loader with environment variables %s', Object
  .keys(env)
  .filter(k => k.startsWith("LOADER"))
  .map(k => { return k + "=" + env[k]; })
);

// Information about loader
c.api_version = 1;

// network & database
c.net.port = env.LOADER_PORT || 8088;
c.mongo.location = env.LOADER_MONGODB || 'mongodb://localhost/';
c.mongo.database = env.LOADER_MONGODB_DATABASE || 'muncher';
c.mongo.initial_connection_attempts = 30;
c.mongo.initial_connection_max_delay = 5000;
c.mongo.initial_connection_initial_delay = 1000;

// fix mongo location if trailing slash was omitted
if (c.mongo.location[c.mongo.location.length - 1] !== '/') {
  c.mongo.location += '/';
}

// fs paths
c.fs.base = env.LOADER_BASEPATH || '/tmp/o2r/';
c.fs.incoming = c.fs.base + 'incoming/';
c.fs.compendium = c.fs.base + 'compendium/';
c.fs.keepIncomingArchive = false;

c.fs.volume = env.LOADER_VOLUME || null;

c.id_length = 5; // length of compendium ids [0-9,a-z,A-Z]

// session secret
c.sessionSecret = env.SESSION_SECRET || 'o2r';

c.upload = {};
c.upload.timeout_seconds = 60 * 30; // 30 minutes

// authentication levels
c.user = {};
c.user.level = {};
c.user.level.create_compendium = 100;

// compendium configuration
c.compendium = {};
c.compendium.supportedContentTypes = ["compendium", "workspace"];
c.compendium.detectionFileName = 'erc.yml';
c.compendium.supportedVersions = ['0.1', '1'];

c.bagit = {};
c.bagit.detectionFileName = 'bagit.txt';
c.bagit.payloadDirectory = 'data';
c.bagit.validation = {};
c.bagit.validation.fast = false;
c.bagit.validation.failUpload = true;

// metadata extraction options
c.meta = {};
c.meta.container = {};
c.meta.container.image = env.LOADER_META_TOOL_CONTAINER || 'o2rproject/o2r-meta:latest';
c.meta.container.default_create_options = {
  CpuShares: 128,
  Env: ['O2R_LOADER=true'],
  Memory: 1073741824, // 1G
  MemorySwap: 2147483648, // double of 1G
  User: env.LOADER_META_TOOL_CONTAINER_USER || 'o2r' // or '1000', which works FOR LOCAL DEVELOPMENT.
};
c.meta.container.rm = yn(env.LOADER_META_TOOL_CONTAINER_RM) || true;

c.meta.extract = {};
c.meta.extract.module = 'extract';
c.meta.extract.outputDir = '.erc';
c.meta.extract.targetElement = 'o2r';
c.meta.extract.bestCandidateFile = 'metadata_raw.json';
c.meta.extract.failOnNoMetadata = true;
c.meta.extract.stayOffline = yn(env.LOADER_META_TOOL_OFFLINE) || false;

c.meta.broker = {};
c.meta.broker.module = 'broker';
c.meta.broker.mappings = {
  o2r: {
    targetElement: 'o2r',
    file: 'metadata_o2r.json',
    mappingFile: 'broker/mappings/o2r-map.json'
  }
};

// Encoding check settings
// A list of analyzed files can be found here: https://github.com/o2r-project/o2r-meta#supported-files-and-formats-for-the-metadata-extraction-process
c.encoding.supportedEncodings = ['ISO-8859-1', 'ISO-8859-2', 'UTF-8', 'UTF-16BE', 'UTF-16LE', 'UTF-32BE', 'UTF-32LE', 'windows-1252'];
c.encoding.textFileRegex = '\.(txt|rmd|r|json|yml|yaml)$';
c.encoding.confidenceThreshold = 60;

c.webdav.allowedHosts = ['sciebo'];
c.webdav.urlString = 'public.php/webdav'; //end of webdav public webdav url
//c.webdav.urlString = 'nextcloud/public.php/dav'; //nextcloud public webdav url

// Zenodo configuration
// default URL and host that is used to download files if the URL itself is not specified in the request (e.g. via DOI or zenodo_record_id parameter)
c.zenodo.default_url = 'https://sandbox.zenodo.org/';
c.zenodo.default_host = 'sandbox.zenodo.org';

// base urls for Zenodo and Zenodo sandbox
c.zenodo.zenodo_sandbox_url = 'https://sandbox.zenodo.org/';
c.zenodo.zenodo_url = 'https://zenodo.org/';

// Slack
c.slack = {};
c.slack.enable = true;
c.slack.bot_token = process.env.SLACK_BOT_TOKEN;
c.slack.verification_token = process.env.SLACK_VERIFICATION_TOKEN;
c.slack.channel = {};
c.slack.channel.status = process.env.SLACK_CHANNEL_STATUS || '#monitoring';
c.slack.channel.loadEvents = process.env.SLACK_CHANNEL_LOAD || '#monitoring';

debug('CONFIGURATION:\n%s', JSON.stringify(c));

module.exports = c;
