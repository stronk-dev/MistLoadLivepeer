/*
Gratis: load tester for a local Livepeer Broadcaster node or whatever
  It duplicates an existing stream to do this, if you didn't configure one it will generate a test stream

Prerequisites: 
  - MistServer running somewhere
    It is recommended to just run mistserver/MistController in a separate terminal
    Make sure to configure it for transcoding
  - (Optionally) a preconfigured stream in MistServer
    There's a webinterface to configure streams at mistHost (usually http://127.0.0.1:4242)
    If unset it will generate a test stream using ffmpeg on MistServer's host machine
    This generated stream is in 720p or something and a fairly low bitrate

Notes:
  - this is experimental software and it might be possible that a push to your does not get stopped on shutdown
    make sure to check your mistHost's push page every now and then to check on it

Todos:
  Config is just applied as is
  - Add sanity checks
  - Only apply if the setting exists, else use a default value

  Mist authorization is not checked on
  - Returns a authorize flag which we should check in case auth does not work 
  
*/


const settings = require('./config.cjs');
const mistApi = require('./mistapi.cjs');
const storage = require('node-persist');
const { randomUUID } = require('crypto');

const boot = new Date().valueOf();
console.log("Booted at epoch " + Math.floor(boot / 1000));
const config = {
  streamName: "",
  mistHost: "",
  auth: false,
  mistHost: "",
  mistUname: "",
  mistPw: "",
  sleepMS: 0,
  maxBandwidthMBPS: 0,
  initialPushes: 0,
  pushLimit: 0,
  pushHardLimit: 0,
  isGeneratedTestStream: false,
  rtmpBase: "",
};
let pushInfo = null;
let streamInfo = {
  status: "",      // Current stream status in human readable format
  health: {},      // Stream health object, identical to payload of STREAM_BUFFER health data
  outputs: [],     // Current outputs count
  clients: 0,      // Current count of connected clients (viewers+inputs+outputs)
  upbytes: 0,      // Total bytes uploaded since stream start
  zerounix: 0,     // Unix time in seconds of timestamp epoch (zero point), if known
  lastms: 0,       // Newest/last (currently) available timestamp in milliseconds
  firstms: 0,      // Oldest/first requestable timestamp in milliseconds
  viewers: 0,      // Current viewers count
  inputs: 0,       // Current inputs count
  views: 0,        // Total viewer session count since stream start
  viewseconds: 0,  // Total sum of seconds watched by viewers since stream start
  downbytes: 0,    // Total bytes downloaded since stream start
  packsent: 0,     // Total packets sent since stream start
  packloss: 0,     // Total packets lost since stream start
  packretrans: 0,  // Total packets retransmitted since stream start
  tracks: 0,       // Count of currently valid tracks in this stream
};

const activeTargets = []; //< Target RTMP uri's we should be pushing to
const inactiveTargets = []; //< Target RTMP uri's we are currently not pushing to

// Store active push id's so that we can stop all pushes on error or interrupt
var activePushes = [];

// Stop all active pushes when we have to shutdown
process.on('SIGTERM', async () => {
  console.info('SIGTERM signal received.');
  for (var index = 0; index < activePushes.length; index++) {
    console.log("Stopping push " + activePushes[index]);
    await mistApi.mistStopPush(activePushes[index]);
  }
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.info('SIGINT signal received.');
  for (var index = 0; index < activePushes.length; index++) {
    console.log("Stopping push " + activePushes[index]);
    await mistApi.mistStopPush(activePushes[index]);
  }
  process.exit(0);
});

// Why is this not part of nodejs by default?
function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

// Overrides default config user config
function parseConfig() {
  return new Promise(async resolve => {
    config.streamName = settings.streamName;
    config.mistHost = settings.mistHost;
    config.auth = settings.auth;
    config.mistUname = settings.mistUname;
    config.mistPw = settings.mistPw;
    config.sleepMS = settings.sleepMS;
    config.maxBandwidthMBPS = settings.maxBandwidthMBPS;
    config.initialPushes = settings.initialPushes;
    config.pushLimit = Math.min(settings.initialPushes, settings.pushLimit);;
    config.pushHardLimit = settings.pushLimit;
    config.rtmpBase = settings.rtmpBase;
    resolve(config);
  });
}

// Parses MistServer stream info object into streamInfo
function parseStreamInfo(streamInfoRaw) {
  streamInfo = null;
  return new Promise(async resolve => {
    if (streamInfoRaw && streamInfoRaw[config.streamName]) {
      streamInfo = {
        status: streamInfoRaw[config.streamName][1],
        health: streamInfoRaw[config.streamName][2],
        outputs: streamInfoRaw[config.streamName][3],
        clients: streamInfoRaw[config.streamName][4],
        upbytes: streamInfoRaw[config.streamName][5],
        zerounix: streamInfoRaw[config.streamName][6],
        lastms: streamInfoRaw[config.streamName][7],
        firstms: streamInfoRaw[config.streamName][8],
        viewers: streamInfoRaw[config.streamName][9],
        inputs: streamInfoRaw[config.streamName][10],
        views: streamInfoRaw[config.streamName][11],
        viewseconds: streamInfoRaw[config.streamName][12],
        downbytes: streamInfoRaw[config.streamName][13],
        packsent: streamInfoRaw[config.streamName][14],
        packloss: streamInfoRaw[config.streamName][15],
        packretrans: streamInfoRaw[config.streamName][16],
        tracks: streamInfoRaw[config.streamName][17]
      };
    }
    resolve('resolved');
  });
}

// Parses MistServer push info list into pushInfo
function parsePushInfo(pushInfoRaw) {
  pushInfo = null;
  return new Promise(async resolve => {
    if (pushInfoRaw) {
      pushInfo = [];
      for (var index2 = 0; index2 < pushInfoRaw.length; index2++) {
        const newObj = {
          pushID: pushInfoRaw[index2][0],
          streamName: pushInfoRaw[index2][1],
          target: pushInfoRaw[index2][2],
          stats: pushInfoRaw[index2][5] || pushInfoRaw[index2][4] //< Livepeer's version has no logs, some older version do @ index 4
        };
        pushInfo.push(newObj);
      }
    }
    resolve('resolved');
  });
}

// Refreshes set of active pushes we need to stop in case of an interrupt
function refreshActivePushes() {
  activePushes = [];
  return new Promise(async resolve => {
    if (pushInfo) {
      for (var index2 = 0; index2 < pushInfo.length; index2++) {
        // Skip pushes unrelated to gratis
        if (pushInfo[index2].streamName != config.streamName) { continue; }
        activePushes.push(pushInfo[index2].pushID);
      }
    }
    resolve('resolved');
  });
}

// If there's an active push for the target, stop it
function stopPushToTarget(target) {
  return new Promise(async resolve => {
    for (var index2 = 0; index2 < pushInfo.length; index2++) {
      // Skip pushes unrelated to gratis
      if (pushInfo[index2].streamName != config.streamName) { continue; }
      if (pushInfo[index2].target == target) {
        console.log("Stopping push " + target + " with id " + pushInfo[index2].pushID);
        await mistApi.mistStopPush(pushInfo[index2].pushID);
        resolve(true);
        return;
      }
    }
    resolve(false);
  });
}

// If we are using the generated stream, start it and wait for it to boot up
function bootTestStream() {
  return new Promise(async resolve => {
    // Start one push in order to boot the stream
    console.log("Starting push to " + inactiveTargets[0] + " to boot stream " + config.streamName);
    await mistApi.mistAddPush(config.streamName, inactiveTargets[0]);
    resolve('resolved');
  });
}

// Wait for the input stream to become active
function waitForInput() {
  return new Promise(async resolve => {
    {
      var mistStatsRaw = await mistApi.mistGetStreamInfo(config.streamName);
      while (true) {
        console.log("Waiting for stream '" + config.streamName + "' to become active...");
        if (mistStatsRaw && mistStatsRaw[config.streamName]) {
          if (mistStatsRaw[config.streamName][1] != "Online") {
            console.log("Stream '" + config.streamName + "' is " + mistStatsRaw[config.streamName][1]);
          } else {
            resolve('resolved');
            return;
          }
        }
        await sleep(config.sleepMS);
        mistStatsRaw = await mistApi.mistGetStreamInfo(config.streamName);
      }
    }
  });
}

// Counts and prints push statistics for a specific target
function printPushStats(target, active) {
  let uploadedMB = 0;
  let uploadMBPS = 0;
  if (pushInfo) {
    for (var index2 = 0; index2 < pushInfo.length; index2++) {
      // Skip pushes unrelated to gratis
      if (pushInfo[index2].streamName != config.streamName) { continue; }
      const altTarget = target.replace("+", " "); //< TMP
      if (pushInfo[index2].target == target || pushInfo[index2].target == altTarget) {
        isFound = true;
        if (pushInfo[index2].stats) {
          uploadedMB = parseInt(pushInfo[index2].stats["bytes"]) * 0.000001;
        }
        if (isNaN(uploadedMB)){
          uploadedMB = 0;
        }
        // Only calculate mbps from mediatime for generated local test streams
        if (pushInfo[index2].stats && config.isGeneratedTestStream) {
          uploadMBPS = uploadedMB / parseInt(pushInfo[index2].stats["mediatime"] / 1000);
        }
        break;
      }
    }
  }
  // Only show calculated mbps from mediatime for generated local test streams
  var mbpsString = "";
  if (uploadMBPS) {
    mbpsString = "(" + uploadMBPS.toFixed(2) + " MB/s) ";
  }
  // Add inactive tag if the target is not in activeTargets
  let inactiveStr = active ? "" : " (inactive)";
  console.log("streamed " + uploadedMB.toFixed(2) + " MB " + mbpsString + "to " + target + inactiveStr);
  return uploadedMB;
}

// 
function managePushes(totalUpMBPS, averageMPBS, elapsed) {
  return new Promise(async resolve => {
    // Adjust pushLimit based on bandwidth usage and config
    if (totalUpMBPS > config.maxBandwidthMBPS && config.pushLimit > 1) {
      config.pushLimit = config.pushLimit - 1;
      console.log("Decreased limit of pushes to " + config.pushLimit);
    } else if (totalUpMBPS + averageMPBS < config.maxBandwidthMBPS && config.pushLimit < config.pushHardLimit) {
      config.pushLimit = config.pushLimit + 1;
      console.log("Increased limit of pushes to " + config.pushLimit);
    }

    // Shuffle around activeTargets and inactiveTargets based on pushLimit
    while (config.pushLimit < activeTargets.length) {
      var randIndex = Math.floor(Math.random() * activeTargets.length);
      inactiveTargets.push(activeTargets[randIndex]);
      activeTargets.splice(randIndex, 1);
    }
    while (config.pushLimit > activeTargets.length && inactiveTargets.length) {
      var randIndex = Math.floor(Math.random() * inactiveTargets.length);
      activeTargets.push(inactiveTargets[randIndex]);
      inactiveTargets.splice(randIndex, 1);
    }

    // Start any push in activeTargets which is not in pushInfo
    for (var index = 0; index < activeTargets.length; index++) {
      if (!pushInfo) { break; }
      const thisTarget = activeTargets[index];
      let found = false;
      for (var index2 = 0; index2 < pushInfo.length; index2++) {
        const altTarget = thisTarget.replace("+", " "); //< TMP
        if (thisTarget == pushInfo[index2].target || altTarget == pushInfo[index2].target) {
          found = true;
          break;
        }
      }
      if (!found) {
        console.log("Starting push to " + thisTarget);
        await mistApi.mistAddPush(config.streamName, thisTarget);
      }
    }

    // Stop pushes in pushInfo which are not in activeTargets
    if (pushInfo) {
      for (var index = 0; index < pushInfo.length; index++) {
        // Skip pushes unrelated to gratis
        if (pushInfo[index].streamName != config.streamName) { continue; }
        // Check if its in activeTargets
        const thisTarget = pushInfo[index].target;
        let found = false;
        for (var index2 = 0; index2 < activeTargets.length; index2++) {
          const altTarget = activeTargets[index2].replace("+", " "); //< TMP
          if (thisTarget == activeTargets[index2] || thisTarget == altTarget) {
            found = true;
            break;
          }
        }
        if (!found) {
          await stopPushToTarget(thisTarget);
        }
      }
    }
    resolve('resolved');
  });
}


/// --- Main ---


const run = async () => {
  await storage.init({
    stringify: JSON.stringify,
    parse: JSON.parse,
    encoding: 'utf8',
    logging: false,
    ttl: false,
    forgiveParseErrors: false
  });
  // Parse config and init the list of available accounts
  const config = await parseConfig();

  // Create a set of inactivePushes
  for (var index = 0; index < config.pushHardLimit; index++) {
    inactiveTargets.push(encodeURI(config.rtmpBase + randomUUID()));
  }

  // Exit if we have no target url's
  if (!inactiveTargets.length) {
    console.log("No targets to push towards...");
    process.exit(0);
  }

  // Get MistServer ready
  mistApi.configure(config.mistHost);
  // Authenticate with MistServer if it is not on localhost
  if (config.auth) {
    await mistApi.authMist(config.mistUname, config.mistPw);
  }
  // If no streamName has been configured, run an ffmpeg script to stream
  if (!config.streamName.length) {
    config.isGeneratedTestStream = true;
    config.streamName = "videogen" + boot;
    console.log("Creating stream " + config.streamName);
    await mistApi.mistAddStream(config.streamName);
  }

  // Wait for the input stream to become available
  if (config.isGeneratedTestStream) {
    await bootTestStream();
  }
  await waitForInput();
  console.log();

  const start = new Date().valueOf();
  // Start initial set of pushes randomly based on pushLimit
  while (config.pushLimit > activeTargets.length && inactiveTargets.length) {
    var randIndex = Math.floor(Math.random() * inactiveTargets.length);
    var thisTarget = inactiveTargets[randIndex];
    inactiveTargets.splice(randIndex, 1);
    console.log("Starting push to " + thisTarget);
    activeTargets.push(thisTarget);
    await mistApi.mistAddPush(config.streamName, thisTarget);
  }
  
  // Run the main loop until someone kills the process
  let prevTime = new Date().valueOf();
  while (true) {
    console.log('\n');
    var totalUpMB = 0;
    const now = new Date().valueOf();
    const thisElapsed = (now - prevTime) / 1000;
    const totalElapsed = (now - start) / 1000;
    // Refresh data
    const mistStatsRaw = await mistApi.mistGetStreamInfo(config.streamName);
    const mistPushesRaw = await mistApi.mistGetPushes();
    await parseStreamInfo(mistStatsRaw);
    await parsePushInfo(mistPushesRaw);
    await refreshActivePushes();

    // If the stream stopped existing, wait for it to become active again
    if (!streamInfo || streamInfo.status != 'Online') {
      console.log("Stream '" + config.streamName + "' is inactive. Manually check stream status in " + config.mistHost);
      prevTime = now;
      await sleep(config.sleepMS);
      continue;
    }
    // Print program stats
    console.log("Running for " + totalElapsed.toFixed(1) + " seconds");
    // Print stream stats
    console.log("Stream " + config.streamName + " is " + streamInfo.status + "\n");
    // Print push stats
    for (var idx = 0; idx < activeTargets.length; idx++) {
      totalUpMB += printPushStats(activeTargets[idx], true);
    }
    for (var idx = 0; idx < inactiveTargets.length; idx++) {
      totalUpMB += printPushStats(inactiveTargets[idx], false);
    }
    // Print summary stats
    const totalUpMBPS = totalUpMB / totalElapsed;
    const averageMPBS = totalUpMBPS / config.pushLimit;
    console.log("Uploaded " + totalUpMB.toFixed(2) + " MB (rate " + totalUpMBPS.toFixed(2) + "/" + config.maxBandwidthMBPS.toFixed(2) + " MB/s, averaging " + averageMPBS.toFixed(2) + " MB/s per stream)\n");
    // Check if any pushes need to be started or stopped
    await managePushes(totalUpMBPS, averageMPBS, thisElapsed);

    prevTime = now;
    await sleep(config.sleepMS);
  }
};


run();


