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
var c = {};
c.net = {};
c.mongo = {};
c.fs = {};
c.encoding = {};
c.webdav = {};
c.zenodo = {};
var env = process.env;

// Information about loader
c.api_version = 1;

// network & database
c.net.port = env.LOADER_PORT || 8088;
c.mongo.location = env.LOADER_MONGODB || 'mongodb://localhost/';
c.mongo.database = env.LOADER_MONGODB_DATABASE || 'muncher';
c.mongo.inital_connection_attempts = 30;
c.mongo.inital_connection_max_delay = 5000;
c.mongo.inital_connection_initial_delay = 1000;

// fix mongo location if trailing slash was omitted
if (c.mongo.location[c.mongo.location.length-1] !== '/') {
  c.mongo.location += '/';
}

// fs paths
c.fs.base       = env.LOADER_BASEPATH || '/tmp/o2r/';
c.fs.incoming   = c.fs.base + 'incoming/';
c.fs.compendium = c.fs.base + 'compendium/';
c.fs.keepIncomingArchive = false;

c.id_length = 5; // length of compendium ids [0-9,a-z,A-Z]

// session secret
c.sessionsecret = env.SESSION_SECRET || 'o2r';

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

// metadata extraction and brokering options
c.meta = {};
c.meta.cliPath = env.LOADER_META_TOOL_EXE || 'python3 ../o2r-meta/o2rmeta.py';
c.meta.versionFile = 'version';

c.meta.extract = {};
c.meta.extract.module = 'extract';
c.meta.extract.outputDir = '.erc';
c.meta.extract.targetElement = 'o2r';
c.meta.extract.bestCandidateFile = 'metadata_raw.json';
c.meta.extract.failOnNoMetadata = false;
c.meta.extract.stayOffline = true;

c.meta.broker = {};
c.meta.broker.enable = true;
c.meta.broker.module = 'broker';
c.meta.broker.mappings = {
  zenodo: {
    targetElement: 'zenodo.metadata',
    file: 'zenodo-map.json'
  },
  o2r: {
    targetElement: 'o2r',
    file: 'o2r-map.json'
  },
  dir: env.LOADER_META_EXTRACT_MAPPINGS_DIR || '../o2r-meta/broker/mappings'
};

c.encoding.supportedEncodings = ['ISO-8859-1' ,'UTF-8','UTF-16BE','UTF-16LE','UTF-32BE','UTF-32LE', 'windows-1252'];
c.encoding.textFileRegex = '\.(txt|rmd|r|tex|json|yml|yaml)$';
c.encoding.confidenceThreshold = 60;

c.webdav.allowedHosts = ['sciebo'];
c.webdav.urlString = 'public.php/webdav'; //end of webdav pubilc webdav url
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
c.slack.channel.loadEvents = process.env.SLACK_CHANNEL_LOAD ||'#monitoring';

module.exports = c;
