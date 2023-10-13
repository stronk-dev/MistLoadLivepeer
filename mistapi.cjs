/// --- MistServer API calls ---
const axios = require("axios");
const md5 = require("md5");

// Used to keep the connection to Mist open so that we don't have to reauthenticate every time
let mistUser = "";
let mistPW = "";
let shouldAuth = false;

function configure(mistHost) {
  mistApi = axios.create({
    baseURL: mistHost,
    timeout: 5000,
  });
}

function setAcc(_mistUser, _mistPW) {
  mistUser = _mistUser;
  mistPW = md5(_mistPW);
  shouldAuth = true;
}

async function authMist() {
  if (!shouldAuth) {
    return;
  }
  try {
    mistApi
      .get('/api2?command={"authorize":{"username":"' + mistUser + '"}}', {})
      .then((res) => {
        var hashedPW = md5(mistPW + res.data.authorize.challenge);
        mistApi
          .get(
            '/api2?command={"authorize":{"username":"' +
              mistUser +
              '", "password":"' +
              hashedPW +
              '"}}',
            {}
          )
          .then((res) => {
            if (res.data.authorize.status == "OK") {
              console.log("auth successful");
            }
          });
      });
  } catch (err) {
    console.error(err);
  }
}

async function get(target) {
  try {
    const ret = await mistApi.get(target, {});
    return ret;
  } catch (err) {
    console.error(err);
  }
}

async function mistAddPush(stream, target) {
  await get(
    '/api2?command={"push_start":["' + stream + '", "' + target + '"]}'
  );
}

async function mistStopPush(push) {
  await get('/api2?command={"push_stop":' + push + "}");
}

async function mistAddStream(stream) {
  const script = encodeURIComponent(
    "ts-exec:ffmpeg -hide_banner -re -f lavfi -i aevalsrc=if(eq(floor(t)\\\\,ld(2))\\\\,st(0\\\\,random(4)*3000+1000))\\\\;st(2\\\\,floor(t)+1)\\\\;st(1\\\\,mod(t\\\\,1))\\\\;(0.6*sin(1*ld(0)*ld(1))+0.4*sin(2*ld(0)*ld(1)))*exp(-4*ld(1))[out1];testsrc=s=640x480,drawtext=borderw=5:fontcolor=white:fontsize=30:text='%{localtime}/%{pts\\\\:hms}':x=w-text_w-w/8:y=\\\\(h-text_h-line_h\\\\)/4,drawtext=borderw=5:fontcolor=white:fontsize=30:text='640x480':x=w-text_w-w/8:y=\\\\(h-text_h-line_h\\\\)/4+text_h+line_h[out0] -f lavfi -i aevalsrc=if(eq(floor(t)\\\\,ld(2))\\\\,st(0\\\\,random(4)*3000+1000))\\\\;st(2\\\\,floor(t)+1)\\\\;st(1\\\\,mod(t\\\\,1))\\\\;(0.6*sin(1*ld(0)*ld(1))+0.4*sin(2*ld(0)*ld(1)))*exp(-4*ld(1))[out1];testsrc=s=800x600,drawtext=borderw=5:fontcolor=white:fontsize=30:text='%{localtime}/%{pts\\\\:hms}':x=w-text_w-w/8:y=\\\\(h-text_h-line_h\\\\)/4,drawtext=borderw=5:fontcolor=white:fontsize=30:text='800x600':x=w-text_w-w/8:y=\\\\(h-text_h-line_h\\\\)/4+text_h+line_h[out0] -f lavfi -i aevalsrc=if(eq(floor(t)\\\\,ld(2))\\\\,st(0\\\\,random(4)*3000+1000))\\\\;st(2\\\\,floor(t)+1)\\\\;st(1\\\\,mod(t\\\\,1))\\\\;(0.6*sin(1*ld(0)*ld(1))+0.4*sin(2*ld(0)*ld(1)))*exp(-4*ld(1))[out1];testsrc=s=1024x768,drawtext=borderw=5:fontcolor=white:fontsize=30:text='%{localtime}/%{pts\\\\:hms}':x=w-text_w-w/8:y=\\\\(h-text_h-line_h\\\\)/4,drawtext=borderw=5:fontcolor=white:fontsize=30:text='1024x768':x=w-text_w-w/8:y=\\\\(h-text_h-line_h\\\\)/4+text_h+line_h[out0] -map a:0 -c:a:0 aac -strict -2 -ac:0 2 -map 0:v -c:v:0 h264 -pix_fmt yuv420p -profile:v:0 baseline -g:v:0 125 -map 1:v -c:v:1 h264 -profile:v:1 baseline -g:v:1 125  -map 2:v -c:v:2 h264 -profile:v:2 baseline -g:v:2 125 -f mpegts -"
  );
  await get(
    '/api2?command={"addstream":{"' +
      stream +
      '": {"source": "' +
      script +
      '"}}}'
  );
}

async function mistDelStream(stream) {
  await get('/api2?command={"deletestream":"' + stream + '"}');
}

async function mistGetPushes() {
  const ret = await get('/api2?command={"push_list":""}');
  if (!ret?.data?.push_list) {
    console.log("invalid response", ret);
    return [];
  }
  return ret.data.push_list;
}

async function mistGetStreamInfo(streamname) {
  const ret = await get(
    '/api2?command={"active_streams":["fields":["status", "health", "outputs", "clients", "upbytes", "zerounix", "lastms", "firstms", "viewers", "inputs", "views", "viewseconds", "downbytes", "packsent", "packloss", "packretrans", "tracks"], "stream": "' +
      streamname +
      '","longform": true ]}'
  );
  if (!ret?.data?.active_streams) {
    console.log("invalid response", ret);
    return [];
  }
  return ret.data.active_streams;
}

module.exports = {
  configure,
  setAcc,
  mistAddPush,
  mistStopPush,
  mistAddStream,
  mistDelStream,
  mistGetPushes,
  mistGetStreamInfo,
};
