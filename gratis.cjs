/*

  Gratis: load tester for a local Livepeer Broadcaster node or whatever

*/

const settings = require("./config.cjs");
const mistApi = require("./mistapi.cjs");
const { randomUUID } = require("crypto");

const boot = new Date().valueOf();
console.log("Booted at epoch " + Math.floor(boot / 1000));
const config = {
  sourceStream: "",
  targetStream: "",
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
  createdSourceStream: false,
  createdTargetStream: false,
  rtmpBase: "",
  genWidth: 800,
  genHeight: 600,
  profiles: [],
};
let pushInfo = null;
let streamInfo = {
  status: "", // Current stream status in human readable format
  health: {}, // Stream health object, identical to payload of STREAM_BUFFER health data
  outputs: [], // Current outputs count
  clients: 0, // Current count of connected clients (viewers+inputs+outputs)
  upbytes: 0, // Total bytes uploaded since stream start
  zerounix: 0, // Unix time in seconds of timestamp epoch (zero point), if known
  lastms: 0, // Newest/last (currently) available timestamp in milliseconds
  firstms: 0, // Oldest/first requestable timestamp in milliseconds
  viewers: 0, // Current viewers count
  inputs: 0, // Current inputs count
  views: 0, // Total viewer session count since stream start
  viewseconds: 0, // Total sum of seconds watched by viewers since stream start
  downbytes: 0, // Total bytes downloaded since stream start
  packsent: 0, // Total packets sent since stream start
  packloss: 0, // Total packets lost since stream start
  packretrans: 0, // Total packets retransmitted since stream start
  tracks: 0, // Count of currently valid tracks in this stream
};

const activeTargets = []; //< Target RTMP uri's we should be pushing to
const inactiveTargets = []; //< Target RTMP uri's we are currently not pushing to

// Store active push id's so that we can stop all pushes on error or interrupt
var activePushes = [];

// Stop all active pushes when we have to shutdown
const shutdown = async () => {
  // Refresh pushes in case we've shutdown just after adding a new push
  const mistPushesRaw = await mistApi.mistGetPushes();
  await parsePushInfo(mistPushesRaw);
  await refreshActivePushes();
  // Stop all active pushes
  for (var index = 0; index < activePushes.length; index++) {
    console.log("Stopping push id " + activePushes[index]);
    await mistApi.mistStopPush(activePushes[index]);
  }
  // Shutdown source stream
  // Remove generated stream
  if (config.createdSourceStream) {
    console.log(
      "Shutting down source test stream '" + config.sourceStream + "'"
    );
    await mistApi.mistNukeStream(config.sourceStream);
    console.log("Removing source test stream '" + config.sourceStream + "'");
    await mistApi.mistDelStream(config.sourceStream);
  }
  if (config.createdTargetStream) {
    console.log("Shutting down target stream '" + config.targetStream + "'");
    await mistApi.mistNukeStream(config.targetStream);
    console.log("Removing target stream '" + config.targetStream + "'");
    await mistApi.mistDelStream(config.targetStream);
  }
};
process.on("SIGTERM", async () => {
  console.info("SIGTERM signal received.");
  await shutdown();
  process.exit(0);
});
process.on("SIGINT", async () => {
  console.info("SIGINT signal received.");
  await shutdown();
  process.exit(0);
});

// Why is this not part of nodejs by default?
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Overrides default user config
function parseConfig() {
  return new Promise(async (resolve) => {
    config.sourceStream = settings.sourceStream;
    config.targetStream = settings.targetStream;
    config.mistHost = settings.mistHost;
    config.auth = settings.auth;
    config.mistUname = settings.mistUname;
    config.mistPw = settings.mistPw;
    config.sleepMS = settings.sleepMS;
    config.maxBandwidthMBPS = settings.maxBandwidthMBPS;
    config.initialPushes = settings.initialPushes;
    config.pushLimit = Math.min(settings.initialPushes, settings.pushLimit);
    config.pushHardLimit = settings.pushLimit;
    config.rtmpBase = settings.rtmpBase;
    config.genWidth = settings.genWidth;
    config.genHeight = settings.genHeight;
    config.profiles = settings.profiles;
    resolve(config);
  });
}

// Parses MistServer stream info object into tje streamInfo JSON object
function parseStreamInfo(streamInfoRaw) {
  streamInfo = null;
  return new Promise(async (resolve) => {
    if (streamInfoRaw && streamInfoRaw[config.sourceStream]) {
      streamInfo = {
        status: streamInfoRaw[config.sourceStream][1],
        health: streamInfoRaw[config.sourceStream][2],
        outputs: streamInfoRaw[config.sourceStream][3],
        clients: streamInfoRaw[config.sourceStream][4],
        upbytes: streamInfoRaw[config.sourceStream][5],
        zerounix: streamInfoRaw[config.sourceStream][6],
        lastms: streamInfoRaw[config.sourceStream][7],
        firstms: streamInfoRaw[config.sourceStream][8],
        viewers: streamInfoRaw[config.sourceStream][9],
        inputs: streamInfoRaw[config.sourceStream][10],
        views: streamInfoRaw[config.sourceStream][11],
        viewseconds: streamInfoRaw[config.sourceStream][12],
        downbytes: streamInfoRaw[config.sourceStream][13],
        packsent: streamInfoRaw[config.sourceStream][14],
        packloss: streamInfoRaw[config.sourceStream][15],
        packretrans: streamInfoRaw[config.sourceStream][16],
        tracks: streamInfoRaw[config.sourceStream][17],
      };
    }
    resolve("resolved");
  });
}

// Parses MistServer push info list into the pushInfo JSON object
function parsePushInfo(pushInfoRaw) {
  pushInfo = null;
  return new Promise(async (resolve) => {
    if (pushInfoRaw) {
      pushInfo = [];
      for (var index2 = 0; index2 < pushInfoRaw.length; index2++) {
        const newObj = {
          pushID: pushInfoRaw[index2][0],
          sourceStream: pushInfoRaw[index2][1],
          target: pushInfoRaw[index2][2],
          stats: pushInfoRaw[index2][5] || pushInfoRaw[index2][4], //< Livepeer's version has no logs, but some older version do @ index 4. So try both
        };
        pushInfo.push(newObj);
      }
    }
    resolve("resolved");
  });
}

// Refreshes set of active pushes we need to stop in case of an interrupt
function refreshActivePushes() {
  activePushes = [];
  return new Promise(async (resolve) => {
    if (pushInfo) {
      for (var index2 = 0; index2 < pushInfo.length; index2++) {
        // Skip pushes unrelated to gratis
        if (pushInfo[index2].sourceStream != config.sourceStream) {
          continue;
        }
        activePushes.push(pushInfo[index2].pushID);
      }
    }
    resolve("resolved");
  });
}

// If there's an active push for the target, stop it
function stopPushToTarget(target) {
  return new Promise(async (resolve) => {
    for (var index2 = 0; index2 < pushInfo.length; index2++) {
      // Skip pushes unrelated to gratis
      if (pushInfo[index2].sourceStream != config.sourceStream) {
        continue;
      }
      if (pushInfo[index2].target == target) {
        console.log(
          "Stopping push " + target + " with id " + pushInfo[index2].pushID
        );
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
  return new Promise(async (resolve) => {
    // Start one push in order to boot the stream
    console.log(
      "Starting push to " +
        inactiveTargets[0] +
        " to boot stream " +
        config.sourceStream
    );
    await mistApi.mistAddPush(config.sourceStream, inactiveTargets[0]);
    resolve("resolved");
  });
}

// Wait for the input stream to become active
function waitForInput() {
  return new Promise(async (resolve) => {
    {
      var mistStatsRaw = await mistApi.mistGetStreamInfo(config.sourceStream);
      while (true) {
        console.log(
          "Waiting for stream '" + config.sourceStream + "' to become active..."
        );
        if (mistStatsRaw && mistStatsRaw[config.sourceStream]) {
          if (mistStatsRaw[config.sourceStream][1] != "Online") {
            console.log(
              "Stream '" +
                config.sourceStream +
                "' is " +
                mistStatsRaw[config.sourceStream][1]
            );
          } else {
            resolve("resolved");
            return;
          }
        }
        await sleep(config.sleepMS);
        mistStatsRaw = await mistApi.mistGetStreamInfo(config.sourceStream);
      }
    }
  });
}

// Counts and prints push statistics for a specific target
function printPushStats(target, active, elapsed, lastMB) {
  let uploadedMB = 0;
  let uploadMBPS = 0;
  if (pushInfo) {
    for (var index2 = 0; index2 < pushInfo.length; index2++) {
      // Skip pushes unrelated to gratis
      if (pushInfo[index2].sourceStream != config.sourceStream) {
        continue;
      }
      const altTarget = target.replace("+", " "); //< TMP
      if (
        pushInfo[index2].target == target ||
        pushInfo[index2].target == altTarget
      ) {
        isFound = true;
        // Total byte counter
        if (pushInfo[index2].stats) {
          uploadedMB = parseInt(pushInfo[index2].stats["bytes"]) * 1e-6;
        }
        if (isNaN(uploadedMB)) {
          uploadedMB = 0;
        }
        // Current bitrate
        if (uploadedMB && lastMB) {
          uploadMBPS = (uploadedMB - lastMB) / elapsed;
        }
        break;
      }
    }
  }
  // Only show calculated mbps from mediatime for generated local test streams
  var mbpsString = "(" + uploadMBPS.toFixed(3) + " MB/s) ";
  // Add inactive tag if the target is not in activeTargets
  let inactiveStr = active ? "" : " (inactive)";
  console.log(
    "streamed " +
      uploadedMB.toFixed(2) +
      " MB " +
      mbpsString +
      "to " +
      target +
      inactiveStr
  );
  return [uploadedMB, uploadMBPS];
}

// Makes sure pushes are started/stopped and prints a summary
function managePushes(totalUpMBPS, averageMPBS, elapsed) {
  return new Promise(async (resolve) => {
    // Adjust pushLimit based on bandwidth usage and config
    if (totalUpMBPS > config.maxBandwidthMBPS && config.pushLimit > 1) {
      config.pushLimit = config.pushLimit - 1;
      console.log("Decreased limit of pushes to " + config.pushLimit);
    } else if (
      totalUpMBPS + averageMPBS < config.maxBandwidthMBPS &&
      config.pushLimit < config.pushHardLimit
    ) {
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
      if (!pushInfo) {
        break;
      }
      const thisTarget = activeTargets[index];
      let found = false;
      for (var index2 = 0; index2 < pushInfo.length; index2++) {
        const altTarget = thisTarget.replace("+", " "); //< TMP
        if (
          thisTarget == pushInfo[index2].target ||
          altTarget == pushInfo[index2].target
        ) {
          found = true;
          break;
        }
      }
      if (!found) {
        console.log("Starting push to " + thisTarget);
        await mistApi.mistAddPush(config.sourceStream, thisTarget);
      }
    }

    // Stop pushes in pushInfo which are not in activeTargets
    if (pushInfo) {
      for (var index = 0; index < pushInfo.length; index++) {
        // Skip pushes unrelated to gratis
        if (pushInfo[index].sourceStream != config.sourceStream) {
          continue;
        }
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
    resolve("resolved");
  });
}

/// --- Main ---

const run = async () => {
  const config = await parseConfig();

  // Get MistServer ready
  mistApi.configure(config.mistHost);
  // Authenticate with MistServer if it is not on localhost
  if (config.auth) {
    mistApi.setAcc(config.mistUname, config.mistPw);
  }
  // If no source stream has been configured, run an ffmpeg script to stream
  if (!config.sourceStream.length) {
    config.createdSourceStream = true;
    config.sourceStream = "videogen" + boot;
    console.log("Creating source stream " + config.sourceStream);
    await mistApi.mistAddTestStream(config.sourceStream, {
      width: config.genWidth,
      height: config.genHeight,
    });
  }

  if (!config.rtmpBase.endsWith("/")) {
    console.log(
      "Rewriting stream base " +
        config.rtmpBase +
        " -> " +
        config.rtmpBase +
        "/"
    );
    config.rtmpBase += "/";
  }

  // If no target stream has been configured, create one using a local Livepeer Broadcasting node for transcoding
  if (!config.targetStream.length) {
    config.createdTargetStream = true;
    config.targetStream = "target" + boot;
    console.log("Creating target stream " + config.targetStream);
    await mistApi.mistAddTargetStream(config.targetStream, {
      profiles: config.profiles,
    });
    // Create a set of inactivePushes
    for (var index = 0; index < config.pushHardLimit; index++) {
      inactiveTargets.push(
        encodeURI(config.rtmpBase + config.targetStream + "+" + randomUUID())
      );
    }
  } else {
    // Create a set of inactivePushes
    for (var index = 0; index < config.pushHardLimit; index++) {
      inactiveTargets.push(encodeURI(config.rtmpBase + randomUUID()));
    }
  }
  // Exit if we have no target url's
  if (!inactiveTargets.length) {
    console.log("No targets to push towards...");
    shutdown();
    return;
  }

  // Wait for the input stream to become available
  if (config.createdSourceStream) {
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
  const mbCounters = {};
  while (true) {
    console.log("\n");
    var totalUpMB = 0;
    var totalUpMBPS = 0;
    // Refresh data
    const mistStatsRaw = await mistApi.mistGetStreamInfo(config.streamName);
    const mistPushesRaw = await mistApi.mistGetPushes();
    await parseStreamInfo(mistStatsRaw);
    await parsePushInfo(mistPushesRaw);
    await refreshActivePushes();
    // Elapsed time since last API calls
    const now = new Date().valueOf();
    const thisElapsed = (now - prevTime) * 1e-3;
    const totalElapsed = (now - start) * 1e-3;

    // If the stream stopped existing, wait for it to become active again
    if (!streamInfo || streamInfo.status != "Online") {
      console.log(
        "Stream '" +
          config.streamName +
          "' is inactive. Manually check stream status in " +
          config.mistHost
      );
      prevTime = now;
      await sleep(config.sleepMS);
      continue;
    }
    // Print program stats
    console.log("Running for " + totalElapsed.toFixed(1) + " seconds");
    // Print stream stats
    console.log(
      "Stream " + config.streamName + " is " + streamInfo.status + "\n"
    );
    // Print push stats
    for (var idx = 0; idx < activeTargets.length; idx++) {
      const [thisMB, thisMPBS] = printPushStats(
        activeTargets[idx],
        true,
        thisElapsed,
        mbCounters[activeTargets[idx]]
      );
      mbCounters[activeTargets[idx]] = thisMB;
      totalUpMB += thisMB;
      totalUpMBPS += thisMPBS;
    }
    for (var idx = 0; idx < inactiveTargets.length; idx++) {
      const [thisMB, thisMPBS] = printPushStats(
        inactiveTargets[idx],
        false,
        thisElapsed,
        mbCounters[inactiveTargets[idx]]
      );
      mbCounters[inactiveTargets[idx]] = thisMB;
      totalUpMB += thisMB;
      totalUpMBPS += thisMPBS;
    }
    // Print summary stats
    const averageMPBS = totalUpMBPS / config.pushLimit;
    console.log(
      "Uploaded " +
        totalUpMB.toFixed(2) +
        " MB (rate " +
        totalUpMBPS.toFixed(3) +
        "/" +
        config.maxBandwidthMBPS.toFixed(3) +
        " MB/s, averaging " +
        averageMPBS.toFixed(3) +
        " MB/s per stream)\n"
    );
    // Check if any pushes need to be started or stopped
    await managePushes(totalUpMBPS, averageMPBS, thisElapsed);

    prevTime = now;
    await sleep(config.sleepMS);
  }
};

run();
