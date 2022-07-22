/// --- MistServer API calls ---
const axios = require('axios');
const md5 = require('md5');
const http = require('http');
const https = require('https');
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });


// Used to keep the connection to Mist open so that we don't have to reauthenticate every time
let mistApi;

function configure(mistHost) {
  mistApi = axios.create({
    baseURL: mistHost,
    httpAgent,
    httpsAgent,
  });
}


async function authMist(uname, pw) {
  try {
    mistApi('/api2?command={"authorize":{"username":"' + uname + '"}}', {
      method: "GET",
      headers: {
        'Content-Type': 'application/json'
      }
    }).then((res) => {
      var hashedPW = md5(pw + res.data.authorize.challenge);
      mistApi('/api2?command={"authorize":{"username":"' + uname + '", "password":"' + hashedPW + '"}}', {
        method: "GET"
      }).then((res) => {
        if (res.data.authorize.status == "OK") {
          console.log("auth successful");
        }
      });
    })
  }
  catch (err) {
    console.error(err);
  }
}

async function mistAddPush(stream, target) {
  try {
    await mistApi('/api2?command={"push_start":["' + stream + '", "' + target + '"]}', {
      method: "GET",
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  catch (err) {
    console.error(err);
  }
}

async function mistStopPush(push) {
  try {
    await mistApi('/api2?command={"push_stop":' + push + '}', {
      method: "GET",
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  catch (err) {
    console.error(err);
  }
}

async function mistAddStream(stream) {
  const script = encodeURIComponent("ts-exec:ffmpeg -hide_banner -re -f lavfi -i aevalsrc=if(eq(floor(t)\\\\,ld(2))\\\\,st(0\\\\,random(4)*3000+1000))\\\\;st(2\\\\,floor(t)+1)\\\\;st(1\\\\,mod(t\\\\,1))\\\\;(0.6*sin(1*ld(0)*ld(1))+0.4*sin(2*ld(0)*ld(1)))*exp(-4*ld(1))[out1];testsrc=s=640x480,drawtext=borderw=5:fontcolor=white:fontsize=30:text='%{localtime}/%{pts\\\\:hms}':x=w-text_w-w/8:y=\\\\(h-text_h-line_h\\\\)/4,drawtext=borderw=5:fontcolor=white:fontsize=30:text='640x480':x=w-text_w-w/8:y=\\\\(h-text_h-line_h\\\\)/4+text_h+line_h[out0] -f lavfi -i aevalsrc=if(eq(floor(t)\\\\,ld(2))\\\\,st(0\\\\,random(4)*3000+1000))\\\\;st(2\\\\,floor(t)+1)\\\\;st(1\\\\,mod(t\\\\,1))\\\\;(0.6*sin(1*ld(0)*ld(1))+0.4*sin(2*ld(0)*ld(1)))*exp(-4*ld(1))[out1];testsrc=s=800x600,drawtext=borderw=5:fontcolor=white:fontsize=30:text='%{localtime}/%{pts\\\\:hms}':x=w-text_w-w/8:y=\\\\(h-text_h-line_h\\\\)/4,drawtext=borderw=5:fontcolor=white:fontsize=30:text='800x600':x=w-text_w-w/8:y=\\\\(h-text_h-line_h\\\\)/4+text_h+line_h[out0] -f lavfi -i aevalsrc=if(eq(floor(t)\\\\,ld(2))\\\\,st(0\\\\,random(4)*3000+1000))\\\\;st(2\\\\,floor(t)+1)\\\\;st(1\\\\,mod(t\\\\,1))\\\\;(0.6*sin(1*ld(0)*ld(1))+0.4*sin(2*ld(0)*ld(1)))*exp(-4*ld(1))[out1];testsrc=s=1024x768,drawtext=borderw=5:fontcolor=white:fontsize=30:text='%{localtime}/%{pts\\\\:hms}':x=w-text_w-w/8:y=\\\\(h-text_h-line_h\\\\)/4,drawtext=borderw=5:fontcolor=white:fontsize=30:text='1024x768':x=w-text_w-w/8:y=\\\\(h-text_h-line_h\\\\)/4+text_h+line_h[out0] -map a:0 -c:a:0 aac -strict -2 -ac:0 2 -map 0:v -c:v:0 h264 -pix_fmt yuv420p -profile:v:0 baseline -g:v:0 125 -map 1:v -c:v:1 h264 -profile:v:1 baseline -g:v:1 125  -map 2:v -c:v:2 h264 -profile:v:2 baseline -g:v:2 125 -f mpegts -");
  try {
    await mistApi('/api2?command={"addstream":{"' + stream + '": {"source": "' + script + '"}}}', {
      method: "GET",
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  catch (err) {
    console.error(err);
  }
}

async function mistGetPushes() {
  try {
    let data = await mistApi('/api2?command={"push_list":""}', {
      method: "GET",
      headers: {
        'Content-Type': 'application/json'
      }
    }).then((res) => {
      return res.data;
    });
    return data.push_list;
  }
  catch (err) {
    console.error(err);
  }
}

async function mistGetStreamInfo(streamname) {
  try {
    let data = await mistApi('/api2?command={"active_streams":["fields":["status", "health", "outputs", "clients", "upbytes", "zerounix", "lastms", "firstms", "viewers", "inputs", "views", "viewseconds", "downbytes", "packsent", "packloss", "packretrans", "tracks"], "stream": "' + streamname + '","longform": true ]}', {
      method: "GET",
      headers: {
        'Content-Type': 'application/json'
      }
    }).then((res) => {
      return res.data;
    });
    return data.active_streams;
  }
  catch (err) {
    console.error(err);
  }
}


module.exports = {
  configure,
  authMist,
  mistAddPush,
  mistStopPush,
  mistAddStream,
  mistGetPushes,
  mistGetStreamInfo,
};

