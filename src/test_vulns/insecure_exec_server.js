// Remote command execution via user input (insecure example)
const http = require("http");
const { exec } = require("child_process");
http.createServer((req, res) => {
  const cmd = new URL(req.url, "http://example").searchParams.get("cmd");
  if (cmd) {
    exec(cmd, (err, stdout) => {
      res.end(err ? err.message : stdout);
    });
  } else {
    res.end("ok");
  }
}).listen(3001);
